import { OBSERVED_SIMULATOR_JOURNEYS } from "../test-data/simulator-journeys";
import { scciJourney } from "../test-data/scci-reference";
import type { SimulationFinancialInput } from "../types/simulator";
import { expect, test } from "./simulator.fixture";

/**
 * SIM-DATA-13 — prazo mínimo e máximo por tipo de operação, lidos do SCCI
 * (Tipo de operação > Prazo mínimo/máximo em meses; snapshot em
 * tests/test-data/scci-reference.esteira-ht.json). Natureza: backend real,
 * leitura (consulta de cálculo, sem proposta).
 *
 * Esperado: o prazo igual ao limite é aceito e o prazo fora do limite é
 * recusado pelo backend (HTTP 422, sem seguradoras). Os testes FALHAM quando o
 * Simulador aceita um prazo fora do cadastro do SCCI.
 */
const tags = ["@readonly", "@simulator"];

const JOURNEY_IDS = [
  "Financiamento Imobiliário > Pessoa Jurídica > Imóvel Comercial > Imóvel Particular",
  "Financiamento Imobiliário > Pessoa Jurídica > Imóvel Residencial > Empreendimento Financiado pela Esteira Digital",
  "Financiamento Imobiliário > Pessoa Física > Imóvel Residencial > Imóvel da Esteira Digital > Taxa Referencial (TR)",
] as const;

function financialInput(): SimulationFinancialInput {
  return {
    propertyValueCents: "150000000",
    financingValueCents: "50000000",
    termMonths: 120,
    amortizationSystem: "SAC - Sistema de amortizacao constante",
    gracePeriodDays: 30,
    birthDateDigits: "01012001",
    // Renda alta isola a regra de prazo da regra de renda mínima.
    netIncomeCents: "50000000",
    composeIncome: false,
  };
}

for (const journeyId of JOURNEY_IDS) {
  const journey = OBSERVED_SIMULATOR_JOURNEYS.find((item) => item.id === journeyId);
  if (!journey) throw new Error(`Jornada inexistente: ${journeyId}.`);
  const reference = scciJourney(journey.id);
  const mins = new Set(reference.operationTypes.map((t) => t.minTermMonths));
  const maxs = new Set(reference.operationTypes.map((t) => t.maxTermMonths));
  if (mins.size !== 1 || maxs.size !== 1) {
    throw new Error(`Jornada ${journey.id}: tipos com limites de prazo diferentes.`);
  }
  const [minTerm] = [...mins] as [number];
  const [maxTerm] = [...maxs] as [number];

  const cases = [
    { name: `prazo máximo do tipo (${maxTerm} meses) é aceito`, term: maxTerm, accepted: true },
    { name: `prazo acima do máximo (${maxTerm + 1} meses) é recusado`, term: maxTerm + 1, accepted: false },
    { name: `prazo mínimo do tipo (${minTerm} meses) é aceito`, term: minTerm, accepted: true },
    { name: `prazo abaixo do mínimo (${minTerm - 1} meses) é recusado`, term: minTerm - 1, accepted: false },
  ] as const;

  for (const item of cases) {
    // O formulário já recusa prazo fora de 12–420 (admin; admin-rules.spec.ts);
    // este teste mira o backend, então o caso fora dessa janela fica explícito
    // como ignorado, e não some da contagem.
    const outsideForm = item.term < 12 || item.term > 420;
    // O limite mínimo do tipo (36) vs. o do admin (12) é decisão pendente de Produto.
    const belowMinimum = !item.accepted && item.term < minTerm;

    test(
      `${item.name}: ${journey.id}`,
      {
        tag: belowMinimum ? [...tags, "@pendente-produto"] : tags,
        annotation: belowMinimum
          ? [
              { type: "matriz", description: "SIM-DATA-13" },
              {
                type: "issue",
                description:
                  "Prazo mínimo do tipo no SCCI (36) não é exigido pelo Simulador (aceita 35). Produto ainda não confirmou qual limite vale.",
              },
            ]
          : { type: "matriz", description: "SIM-DATA-13" },
      },
      async ({ simulator }) => {
        test.skip(
          outsideForm,
          `Prazo ${item.term} fora de 12–420: o formulário o recusa antes do backend (coberto em admin-rules.spec.ts).`,
        );
        await simulator.chooseJourney(journey.selection);
        await simulator.fillSimulationData(financialInput(), journey.dataScreen);
        await simulator.customTermInput.fill(String(item.term));

        await simulator.submitDataStep();
        const outcome = await simulator.waitForInsurerOutcome();

        if (item.accepted) {
          expect(
            outcome.error,
            `Prazo ${item.term} está dentro do cadastro do SCCI (${minTerm}–${maxTerm}) e deve ser aceito.`,
          ).toBeUndefined();
          expect(outcome.insurerCount).toBeGreaterThan(0);
        } else {
          expect(
            outcome.status,
            `Prazo ${item.term} está fora do cadastro do SCCI (${minTerm}–${maxTerm}): o backend deve recusar (HTTP 422).`,
          ).toBe(422);
          expect(
            outcome.error,
            "A recusa precisa ser pelo prazo, não por outra regra.",
          ).toMatch(/prazo/i);
          expect(outcome.insurerCount).toBe(0);
          // Observação (não é regra): em PJ a mensagem de prazo cita a idade do proponente.
          if (/idade/i.test(outcome.error ?? "")) {
            test.info().annotations.push({
              type: "observacao",
              description: `Mensagem de prazo cita idade do proponente: "${outcome.error}".`,
            });
          }
        }
      },
    );
  }
}
