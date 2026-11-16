import { OBSERVED_SIMULATOR_JOURNEYS } from "../test-data/simulator-journeys";
import { scciJourney } from "../test-data/scci-reference";
import type { SimulationFinancialInput } from "../types/simulator";
import { expect, PF_RESIDENTIAL_ESTEIRA_TR, test } from "./simulator.fixture";

/**
 * SIM-DATA-08 — qual tipo de operação o backend escolhe. O tipo escolhido vem na
 * resposta do cálculo (POST /api/simulacao/evolucao → resumo.codigoTipoOperacao),
 * então a regra é validada sem criar proposta. Natureza: backend real, leitura.
 *
 * Expectativa (HIPÓTESE a confirmar com Produto; Iago Mattos: "temos que validar
 * perfeitamente"): vale o tipo de MENOR teto que comporta a operação, lido do
 * cadastro do SCCI — por valor do imóvel (maxProperty) nas jornadas SFH×SFI e por
 * teto de LTV (menor percentual das faixas do tipo) no Crédito Garantia.
 * Os testes FALHAM quando o backend escolhe outro tipo.
 */
const tags = ["@readonly", "@simulator"];
// Crédito Garantia: o teto por tipo é interpretação do cadastro (o tipo 400 tem
// duas faixas, 30 e 40, e usamos a menor); Produto ainda não confirmou a regra.
const creditTags = [...tags, "@pendente-produto"];
const SAC = "SAC - Sistema de amortizacao constante" as const;
const CREDIT_PF = "Crédito Garantia de Imóvel > Pessoa Física > Imóvel";

function journeyOf(id: string) {
  const journey = OBSERVED_SIMULATOR_JOURNEYS.find((item) => item.id === id);
  if (!journey) throw new Error(`Jornada inexistente: ${id}.`);
  return journey;
}

function financial(overrides: Partial<SimulationFinancialInput>): SimulationFinancialInput {
  return {
    propertyValueCents: "100000000",
    financingValueCents: "30000000",
    termMonths: 120,
    amortizationSystem: SAC,
    gracePeriodDays: 0,
    birthDateDigits: "01012001",
    netIncomeCents: "50000000",
    composeIncome: false,
    ...overrides,
  };
}

interface Selection {
  readonly typeCode?: string;
  readonly status: number;
  readonly message?: string;
}

async function chosenType(
  simulator: Parameters<Parameters<typeof test>[2]>[0]["simulator"],
  page: Parameters<Parameters<typeof test>[2]>[0]["page"],
  journeyId: string,
  input: SimulationFinancialInput,
): Promise<Selection> {
  const journey = journeyOf(journeyId);
  await simulator.chooseJourney(journey.selection);
  await simulator.fillSimulationData(input, journey.dataScreen);
  // Timeout curto e mensagem própria: se o cálculo nunca é chamado, o diagnóstico
  // deve dizer isso, não esperar 60 s por um timeout genérico.
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/api/simulacao/evolucao",
    { timeout: 20_000 },
  );
  await simulator.submitDataStep();
  const evolution = await response.catch(() => {
    throw new Error(
      "O Simulador não chamou /api/simulacao/evolucao em 20 s depois de Avançar (a tela pode ter bloqueado o envio ou o ambiente falhou).",
    );
  });
  if (evolution.status() >= 500) {
    throw new Error(
      `AMBIENTE: o cálculo respondeu HTTP ${evolution.status()}; o resultado não prova a regra testada.`,
    );
  }
  let body: { resumo?: { codigoTipoOperacao?: string }; message?: string; detail?: string } = {};
  try {
    body = (await evolution.json()) as typeof body;
  } catch {
    body = { message: (await evolution.text()).slice(0, 200) };
  }
  return {
    typeCode: body.resumo?.codigoTipoOperacao,
    status: evolution.status(),
    message: body.message ?? body.detail,
  };
}

// ------------------------------------------------ SFH × SFI por valor do imóvel (PF/Residencial/Esteira/TR)
{
  const types = scciJourney(PF_RESIDENTIAL_ESTEIRA_TR).operationTypes;
  const byCeiling = [...types].sort((a, b) => a.maxProperty - b.maxProperty);
  const smallest = byCeiling[0];
  const largest = byCeiling[byCeiling.length - 1];
  if (!smallest || !largest) throw new Error("Jornada sem tipos.");
  const ceiling = Math.round(smallest.maxProperty * 100);

  test(
    `imóvel no teto do tipo menor (${smallest.maxProperty}) usa o tipo ${smallest.code}`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-08" } },
    async ({ simulator, page }) => {
      const result = await chosenType(simulator, page, PF_RESIDENTIAL_ESTEIRA_TR, financial({
        propertyValueCents: String(ceiling),
        financingValueCents: "50000000",
      }));
      expect(result.typeCode, "Tipo escolhido pelo backend").toBe(smallest.code);
    },
  );

  test(
    `imóvel um centavo acima do teto do tipo menor usa o tipo ${largest.code}`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-08" } },
    async ({ simulator, page }) => {
      const result = await chosenType(simulator, page, PF_RESIDENTIAL_ESTEIRA_TR, financial({
        propertyValueCents: String(ceiling + 1),
        financingValueCents: "50000000",
      }));
      expect(result.typeCode, "Tipo escolhido pelo backend").toBe(largest.code);
    },
  );
}

// ------------------------------------------------ Crédito Garantia PF: tipo por teto de LTV
{
  const reference = scciJourney(CREDIT_PF);
  // Teto de cada tipo = menor percentual de LTV entre as suas faixas (SAC).
  const ceilings = reference.operationTypes
    .map((type) => {
      const bands = reference.ltvBands.filter(
        (band) =>
          band.operationTypeCode === type.code &&
          band.amortizationSystem === "2" &&
          !band.inactive,
      );
      return { code: type.code, ltv: Math.min(...bands.map((band) => band.maxLtvPercent)) };
    })
    .sort((a, b) => a.ltv - b.ltv);
  const highest = ceilings[ceilings.length - 1];
  if (!highest) throw new Error("Crédito Garantia PF sem tetos de LTV.");

  const expectedFor = (ltv: number): string | undefined =>
    ceilings.find((type) => ltv <= type.ltv)?.code;

  const property = 100_000_000; // R$ 1.000.000
  const cases = [10, 30, 31, 40, 50, 51, 60];
  for (const ltv of cases) {
    const expected = expectedFor(ltv);
    test(
      `LTV de ${ltv}% usa o tipo ${expected ?? "(nenhum)"} (menor teto de LTV que comporta)`,
      { tag: creditTags, annotation: { type: "matriz", description: "SIM-DATA-08" } },
      async ({ simulator, page }) => {
        test.skip(
          !expected,
          `LTV de ${ltv}% está acima do maior teto cadastrado (${highest.ltv}%): coberto pelo teste de recusa acima do teto.`,
        );
        if (!expected) return;
        const result = await chosenType(simulator, page, CREDIT_PF, financial({
          propertyValueCents: String(property),
          financingValueCents: String((property * ltv) / 100),
        }));
        expect(result.typeCode, `Tipo escolhido pelo backend (tetos: ${JSON.stringify(ceilings)})`).toBe(expected);
      },
    );
  }

  test(
    `LTV acima do maior teto (${highest.ltv}%) é recusado citando o percentual correto`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-08" } },
    async ({ simulator, page }) => {
      const result = await chosenType(simulator, page, CREDIT_PF, financial({
        propertyValueCents: String(property),
        financingValueCents: String((property * (highest.ltv + 1)) / 100),
      }));
      expect(result.status, "Deve ser recusado").toBe(422);
      expect(
        result.message,
        `A mensagem deve citar o teto real do cadastro (${highest.ltv}%), pois ${highest.ltv}% é aceito.`,
      ).toContain(`${highest.ltv}.00%`);
    },
  );
}
