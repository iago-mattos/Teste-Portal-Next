import { scciJourney } from "../test-data/scci-reference";
import { OBSERVED_SIMULATOR_JOURNEYS } from "../test-data/simulator-journeys";
import type { ScciJourneyReference } from "../types/scci-reference";
import type { SimulationFinancialInput } from "../types/simulator";
import { expect, PF_RESIDENTIAL_ESTEIRA_TR, test } from "./simulator.fixture";

/**
 * SIM-DATA-05 / 08 / 10 / 19 — limites de valor, idade e LTV por tipo de
 * operação, lidos do SCCI (snapshot em tests/test-data/scci-reference.esteira-ht.json).
 * Natureza: backend real, leitura (consulta de cálculo, sem proposta).
 *
 * Esperado: o valor igual ao limite é aceito e o valor fora do limite é
 * recusado pelo backend (HTTP 422, sem seguradoras). Os testes FALHAM quando o
 * Simulador não respeita o cadastro do SCCI.
 */
const tags = ["@readonly", "@simulator"];
const SAC = "SAC - Sistema de amortizacao constante" as const;
const PJ_RESIDENTIAL_ESTEIRA =
  "Financiamento Imobiliário > Pessoa Jurídica > Imóvel Residencial > Imóvel Esteira Digital";
const PJ_COMMERCIAL_PRIVATE =
  "Financiamento Imobiliário > Pessoa Jurídica > Imóvel Comercial > Imóvel Particular";

function journeyOf(id: string) {
  const journey = OBSERVED_SIMULATOR_JOURNEYS.find((item) => item.id === id);
  if (!journey) throw new Error(`Jornada inexistente: ${id}.`);
  return journey;
}

/** Reais (do SCCI) para centavos inteiros. */
function cents(reais: number): number {
  return Math.round(reais * 100);
}

function base(
  overrides: Partial<SimulationFinancialInput> = {},
): SimulationFinancialInput {
  return {
    propertyValueCents: "150000000",
    financingValueCents: "50000000",
    termMonths: 120,
    amortizationSystem: SAC,
    gracePeriodDays: 30,
    birthDateDigits: "01012001",
    // Renda alta isola a regra testada da regra de renda mínima.
    netIncomeCents: "50000000",
    composeIncome: false,
    ...overrides,
  };
}

/** Data DDMMAAAA com `years` anos exatos antes de hoje (mesmo dia e mês). */
function birthYearsAgo(years: number): string {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${day}${month}${today.getFullYear() - years}`;
}

function minOperation(reference: ScciJourneyReference): number {
  return Math.max(...reference.operationTypes.map((type) => type.minOperation));
}

function maxProperty(reference: ScciJourneyReference): number {
  return Math.max(...reference.operationTypes.map((type) => type.maxProperty));
}

type Quote = Readonly<{
  journeyId: string;
  financial: SimulationFinancialInput;
  /** Prazo digitado no campo livre (os botões só têm 120–420). */
  customTerm?: number;
}>;

async function runQuote(
  simulator: Parameters<Parameters<typeof test>[2]>[0]["simulator"],
  quote: Quote,
) {
  const journey = journeyOf(quote.journeyId);
  await simulator.chooseJourney(journey.selection);
  await simulator.fillSimulationData(quote.financial, journey.dataScreen);
  if (quote.customTerm !== undefined) {
    await simulator.customTermInput.fill(String(quote.customTerm));
  }
  await simulator.submitDataStep();
  return simulator.waitForInsurerOutcome();
}

// ---------------------------------------------------------------- valor mínimo da operação
for (const journeyId of [PF_RESIDENTIAL_ESTEIRA_TR, PJ_RESIDENTIAL_ESTEIRA]) {
  const min = cents(minOperation(scciJourney(journeyId)));
  // O imóvel precisa respeitar o mínimo do admin (R$ 50.000) e superar o financiamento.
  const property = "10000000";

  test(
    `financiamento igual ao mínimo do tipo (${min / 100}) é aceito: ${journeyId}`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-05" } },
    async ({ simulator }) => {
      const outcome = await runQuote(simulator, {
        journeyId,
        financial: base({
          propertyValueCents: property,
          financingValueCents: String(min),
        }),
      });
      expect(outcome.error, "Valor igual ao mínimo do SCCI deve ser aceito.").toBeUndefined();
      expect(outcome.insurerCount).toBeGreaterThan(0);
    },
  );

  test(
    `financiamento um centavo abaixo do mínimo do tipo é recusado: ${journeyId}`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-05" } },
    async ({ simulator }) => {
      const outcome = await runQuote(simulator, {
        journeyId,
        financial: base({
          propertyValueCents: property,
          financingValueCents: String(min - 1),
        }),
      });
      expect(
        outcome.error,
        `Valor abaixo do mínimo do SCCI (${min / 100}) deve ser recusado.`,
      ).toMatch(/inferior ao valor m[ií]nimo/i);
      expect(outcome.insurerCount).toBe(0);
    },
  );
}

// ---------------------------------------------------------------- valor máximo do imóvel
for (const journeyId of [PF_RESIDENTIAL_ESTEIRA_TR, PJ_RESIDENTIAL_ESTEIRA]) {
  const reference = scciJourney(journeyId);
  const max = cents(maxProperty(reference));

  test(
    `imóvel igual ao máximo do tipo (${max / 100}) é aceito: ${journeyId}`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-10" } },
    async ({ simulator }) => {
      const outcome = await runQuote(simulator, {
        journeyId,
        financial: base({
          propertyValueCents: String(max),
          financingValueCents: "100000000",
        }),
      });
      expect(outcome.error, "Imóvel igual ao máximo do SCCI deve ser aceito.").toBeUndefined();
      expect(outcome.insurerCount).toBeGreaterThan(0);
    },
  );

  test(
    `imóvel um centavo acima do máximo do tipo é recusado: ${journeyId}`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-10" } },
    async ({ simulator }) => {
      const outcome = await runQuote(simulator, {
        journeyId,
        financial: base({
          propertyValueCents: String(max + 1),
          financingValueCents: "100000000",
        }),
      });
      expect(
        outcome.error,
        `Imóvel acima do máximo do SCCI (${max / 100}) deve ser recusado.`,
      ).toMatch(/superior ao m[aá]ximo/i);
      expect(outcome.insurerCount).toBe(0);
    },
  );
}

// ---------------------------------------------------------------- idade (somente PF; PJ não tem regra)
{
  const journeyId = PF_RESIDENTIAL_ESTEIRA_TR;
  const types = scciJourney(journeyId).operationTypes;
  const maxAgeMonths = Math.max(...types.map((t) => t.maxAge * 12 + t.maxAgeMonths));
  const agePlusTermMonths = Math.max(
    ...types.map((t) => t.agePlusTermMax * 12 + t.agePlusTermMaxMonths),
  );
  const ageYears = 70;
  const boundaryTerm = agePlusTermMonths - ageYears * 12; // idade + prazo = limite

  test(
    `idade acima da máxima do tipo (${Math.floor(maxAgeMonths / 12)} anos e ${maxAgeMonths % 12} meses) é recusada`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-19" } },
    async ({ simulator }) => {
      const outcome = await runQuote(simulator, {
        journeyId,
        financial: base({
          birthDateDigits: birthYearsAgo(Math.floor(maxAgeMonths / 12) + 1),
        }),
        customTerm: 12,
      });
      expect(
        outcome.error,
        "Idade acima do limite do SCCI deve ser recusada.",
      ).toMatch(/idade/i);
      expect(outcome.insurerCount).toBe(0);
    },
  );

  test(
    `idade ${ageYears} anos + prazo ${boundaryTerm} meses (= limite idade+prazo do tipo) é aceito`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-19" } },
    async ({ simulator }) => {
      const outcome = await runQuote(simulator, {
        journeyId,
        financial: base({ birthDateDigits: birthYearsAgo(ageYears) }),
        customTerm: boundaryTerm,
      });
      expect(outcome.error, "Idade + prazo igual ao limite do SCCI deve ser aceito.").toBeUndefined();
      expect(outcome.insurerCount).toBeGreaterThan(0);
    },
  );

  test(
    `idade ${ageYears} anos + prazo ${boundaryTerm + 1} meses (acima do limite idade+prazo) é recusado`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-19" } },
    async ({ simulator }) => {
      const outcome = await runQuote(simulator, {
        journeyId,
        financial: base({ birthDateDigits: birthYearsAgo(ageYears) }),
        customTerm: boundaryTerm + 1,
      });
      expect(
        outcome.error,
        "Idade + prazo acima do limite do SCCI deve ser recusado.",
      ).toMatch(/idade|prazo/i);
      expect(outcome.insurerCount).toBe(0);
    },
  );
}

// ---------------------------------------------------------------- LTV (SAC)
for (const journeyId of [PF_RESIDENTIAL_ESTEIRA_TR, PJ_COMMERCIAL_PRIVATE]) {
  const sacLtv = new Set(
    scciJourney(journeyId)
      .ltvBands.filter((band) => band.amortizationSystem === "2" && !band.inactive)
      .map((band) => band.maxLtvPercent),
  );
  if (sacLtv.size !== 1) {
    throw new Error(`Jornada ${journeyId}: faixas de LTV SAC ambíguas (${[...sacLtv]}).`);
  }
  const [ltv] = [...sacLtv] as [number];
  const property = 100_000_000; // R$ 1.000.000, dentro dos limites de todos os tipos
  const atLimit = (property * ltv) / 100;

  test(
    `financiamento no LTV máximo do tipo (${ltv}%) é aceito: ${journeyId}`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-08" } },
    async ({ simulator }) => {
      const outcome = await runQuote(simulator, {
        journeyId,
        financial: base({
          propertyValueCents: String(property),
          financingValueCents: String(atLimit),
        }),
      });
      expect(outcome.error, `LTV de ${ltv}% (limite do SCCI) deve ser aceito.`).toBeUndefined();
      expect(outcome.insurerCount).toBeGreaterThan(0);
    },
  );

  test(
    `financiamento um centavo acima do LTV máximo do tipo (${ltv}%) é recusado: ${journeyId}`,
    { tag: tags, annotation: { type: "matriz", description: "SIM-DATA-08" } },
    async ({ simulator }) => {
      const outcome = await runQuote(simulator, {
        journeyId,
        financial: base({
          propertyValueCents: String(property),
          financingValueCents: String(atLimit + 1),
        }),
      });
      expect(
        outcome.error,
        `LTV acima de ${ltv}% (limite do SCCI) deve ser recusado.`,
      ).toMatch(/percentual m[aá]ximo/i);
      expect(outcome.insurerCount).toBe(0);
    },
  );
}
