import { OBSERVED_SIMULATOR_JOURNEYS } from "../test-data/simulator-journeys";
import { scciJourney } from "../test-data/scci-reference";
import type { ScciJourneyReference } from "../types/scci-reference";
import type { SimulationFinancialInput } from "../types/simulator";
import { expect, test } from "./simulator.fixture";

/**
 * SIM-INS-13 / SIM-INS-04 / SIM-INS-05 — seguradoras exibidas por jornada
 * contra o cadastro do SCCI (Tipo de operação > Seguradoras; snapshot em
 * tests/test-data/scci-reference.esteira-ht.json). Natureza: backend real,
 * leitura (consulta de cálculo, sem proposta).
 *
 * O Simulador escolhe o tipo de operação conforme o valor do imóvel, e uma
 * jornada pode ter 2–3 tipos; por isso a regra é: toda seguradora exibida
 * existe em algum tipo da jornada, e toda seguradora comum a TODOS os tipos
 * é exibida. Todo card precisa ter nome acessível: card sem nome (causa
 * observada: o cadastro do SCCI repete a mesma seguradora e o Simulador exibe
 * a linha repetida como card extra) REPROVA o teste.
 */
const tags = ["@readonly", "@simulator"];

function financialInputFor(
  borrowerType: "Pessoa Física" | "Pessoa Jurídica",
): SimulationFinancialInput {
  return {
    propertyValueCents: "150000000",
    financingValueCents: "50000000",
    termMonths: 120,
    amortizationSystem: "SAC - Sistema de amortizacao constante",
    gracePeriodDays: 30,
    birthDateDigits: "01012001",
    // PJ informa faturamento: valor alto evita bloqueio por renda mínima.
    netIncomeCents: borrowerType === "Pessoa Jurídica" ? "50000000" : "5000000",
    composeIncome: false,
  };
}

interface InsurerExpectation {
  readonly union: readonly string[];
  readonly common: readonly string[];
  readonly maxRows: number;
  /** Maior número de linhas em um tipo que repetem a seguradora (mesmo com apólice diferente) ou não a informam. */
  readonly maxRepeatedRows: number;
}

function expectationFor(reference: ScciJourneyReference): InsurerExpectation {
  const namedSets = reference.operationTypes.map(
    (type) =>
      new Set(
        type.insurers
          .filter((insurer) => insurer.code !== "")
          .map((insurer) => insurer.name),
      ),
  );
  const union = new Set(namedSets.flatMap((set) => [...set]));
  const common = [...union].filter((name) =>
    namedSets.every((set) => set.has(name)),
  );
  const repeated = reference.operationTypes.map((type) => {
    const seen = new Set<string>();
    let repeats = 0;
    for (const insurer of type.insurers) {
      if (insurer.code === "" || seen.has(insurer.code)) repeats += 1;
      seen.add(insurer.code);
    }
    return repeats;
  });
  return {
    union: [...union],
    common,
    maxRows: Math.max(...reference.operationTypes.map((t) => t.insurers.length)),
    maxRepeatedRows: Math.max(...repeated),
  };
}

test.describe("Simulador | seguradoras por jornada", () => {
  for (const journey of OBSERVED_SIMULATOR_JOURNEYS) {
    test(
      `exibe as seguradoras do cadastro do SCCI: ${journey.id}`,
      {
        tag: tags,
        annotation: {
          type: "matriz",
          description: "SIM-INS-13 / SIM-INS-04 / SIM-INS-05",
        },
      },
      async ({ simulator }, testInfo) => {
        const expected = expectationFor(scciJourney(journey.id));
        await simulator.chooseJourney(journey.selection);
        await simulator.fillSimulationData(
          financialInputFor(journey.selection.borrowerType),
          journey.dataScreen,
        );

        await simulator.submitDataStep();
        const outcome = await simulator.waitForInsurerOutcome();
        expect(
          outcome.error,
          "O cálculo deve ser aceito para valores válidos da jornada.",
        ).toBeUndefined();
        const cards = await simulator.visibleInsurerNames();
        const named = cards.filter((card) => card !== "");
        const unnamed = cards.length - named.length;

        await testInfo.attach("seguradoras-exibidas", {
          body: JSON.stringify(
            { cards: cards.map((card) => card.slice(0, 50)), expected },
            null,
            2,
          ),
          contentType: "application/json",
        });

        // Toda seguradora exibida existe no cadastro de algum tipo da jornada.
        for (const card of named) {
          expect
            .soft(
              expected.union.some((name) => card.startsWith(name)),
              `Seguradora exibida fora do cadastro do SCCI: "${card.slice(0, 40)}".`,
            )
            .toBe(true);
        }
        // Toda seguradora comum a todos os tipos da jornada é exibida.
        for (const name of expected.common) {
          expect
            .soft(
              named.some((card) => card.startsWith(name)),
              `Seguradora do cadastro ausente na tela: ${name}.`,
            )
            .toBe(true);
        }
        // Nenhum card pode ficar sem nome acessível.
        expect
          .soft(
            unnamed,
            `Há ${unnamed} card(s) sem nome acessível. Causa provável: o cadastro do SCCI repete a mesma seguradora (até ${expected.maxRepeatedRows} linha(s) repetida(s) nos tipos desta jornada) e o Simulador a exibe como card extra.`,
          )
          .toBe(0);
        expect.soft(cards.length).toBeLessThanOrEqual(expected.maxRows);
        if (unnamed > 0) {
          testInfo.annotations.push({
            type: "issue",
            description:
              `${unnamed} card(s) sem nome acessível; o SCCI repete a mesma seguradora em tipos desta jornada. ` +
              "Decisão de Produto: corrigir o cadastro ou deduplicar no Simulador.",
          });
        }
      },
    );
  }
});

/**
 * Hipótese de Produto (fora do conjunto validador): uma seguradora não aparece
 * em dois cards. O que conta como "mesma oferta" (só a seguradora, ou seguradora
 * + apólice) não foi definido. Só roda nas jornadas em que o cadastro do SCCI
 * repete a seguradora num tipo; nas demais não há duplicidade a esperar.
 */
test.describe("Simulador | seguradoras | nome repetido (hipótese de Produto)", () => {
  for (const journey of OBSERVED_SIMULATOR_JOURNEYS) {
    const expected = expectationFor(scciJourney(journey.id));
    if (expected.maxRepeatedRows === 0) continue;
    test(
      `não repete o nome de uma seguradora em dois cards: ${journey.id}`,
      {
        tag: [...tags, "@pendente-produto"],
        annotation: { type: "matriz", description: "SIM-INS-13" },
      },
      async ({ simulator }) => {
        await simulator.chooseJourney(journey.selection);
        await simulator.fillSimulationData(
          financialInputFor(journey.selection.borrowerType),
          journey.dataScreen,
        );
        await simulator.submitDataStep();
        const outcome = await simulator.waitForInsurerOutcome();
        expect(
          outcome.error,
          "O cálculo deve ser aceito para valores válidos da jornada.",
        ).toBeUndefined();
        const named = (await simulator.visibleInsurerNames()).filter((card) => card !== "");
        const duplicated = named.filter((card, index) => named.indexOf(card) !== index);
        expect(
          duplicated,
          "Há card(s) com nome repetido; o que conta como mesma oferta ainda não foi definido por Produto.",
        ).toEqual([]);
      },
    );
  }
});
