import { OBSERVED_SIMULATOR_JOURNEYS } from "../test-data/simulator-journeys";
import type { SimulationFinancialInput } from "../types/simulator";
import { expect, test } from "./simulator.fixture";

/**
 * SIM-DATA-16 — a Tabela Price é oferecida na tela Dados e deve produzir
 * seguradoras (simulação aceita), como o SAC. Natureza: backend real, leitura
 * (consulta de cálculo, sem proposta).
 *
 * ACHADO (portal-desenv, 09/11/2026): em PF/TR, PJ, Crédito Garantia e PF/IPCA
 * o backend recusa a Price com HTTP 422 "O valor de financiamento solicitado
 * ultrapassou o percentual máximo permitido para esta operação", mesmo com 33%
 * de financiamento; com SAC, nas mesmas condições, a simulação é aceita. No SCCI
 * (Tabelas > Originação > Faixa LTV por tipo de operação) as 59 faixas das 24
 * jornadas existem só para o sistema 2 (SAC); não há faixa para Price (1).
 * O teste descreve o comportamento esperado (Price aceita) e FALHA enquanto o
 * backend recusar; Produto ainda precisa confirmar se a recusa é o contrato.
 */
const JOURNEY_IDS = [
  "Financiamento Imobiliário > Pessoa Física > Imóvel Residencial > Imóvel da Esteira Digital > Taxa Referencial (TR)",
  "Financiamento Imobiliário > Pessoa Jurídica > Imóvel Comercial > Imóvel Particular",
  "Crédito Garantia de Imóvel > Pessoa Física > Imóvel",
  "Financiamento Imobiliário > Pessoa Física > Imóvel Residencial > Imóvel Particular > Índice de Preços ao Consumidor Amplo (IPCA)",
] as const;

for (const journeyId of JOURNEY_IDS) {
  const journey = OBSERVED_SIMULATOR_JOURNEYS.find((item) => item.id === journeyId);
  if (!journey) throw new Error(`Jornada inexistente: ${journeyId}.`);

  test(
    `Tabela Price é aceita no cálculo: ${journey.id}`,
    {
      // @pendente-produto: Produto não confirmou que a Price deve calcular em todas as
      // jornadas; o vermelho é divergência a confirmar, não defeito comprovado.
      tag: ["@readonly", "@simulator", "@pendente-produto"],
      annotation: [
        { type: "matriz", description: "SIM-DATA-16" },
        {
          type: "issue",
          description:
            "Price recusada (422, 'percentual máximo') em todas as jornadas testadas; o SCCI só tem faixa de LTV para SAC. Decisão de Produto pendente.",
        },
      ],
    },
    async ({ simulator }) => {
      const corporate = journey.selection.borrowerType === "Pessoa Jurídica";
      const financial: SimulationFinancialInput = {
        propertyValueCents: "150000000",
        financingValueCents: "50000000",
        termMonths: 120,
        amortizationSystem: "TP - Tabela Price",
        gracePeriodDays: 30,
        birthDateDigits: "01012001",
        netIncomeCents: corporate ? "50000000" : "5000000",
        composeIncome: false,
      };

      await simulator.chooseJourney(journey.selection);
      await simulator.fillSimulationData(financial, journey.dataScreen);
      await simulator.submitDataStep();
      const outcome = await simulator.waitForInsurerOutcome();

      expect(
        outcome.error,
        "Com Tabela Price o cálculo deve ser aceito, como no SAC.",
      ).toBeUndefined();
      expect(outcome.insurerCount).toBeGreaterThan(0);
    },
  );
}
