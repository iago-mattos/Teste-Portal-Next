import { randomInt } from "node:crypto";
import type { SimulationFinancialInput } from "../types/simulator";

export interface UniqueSimulationInput {
  readonly input: SimulationFinancialInput;
  /** Os três valores digitados, em reais, para conferir no banco. */
  readonly expected: { property: number; financing: number; income: number };
}

/** Limite do tipo de operação: acima de R$ 1.500.000,00 o Simulador troca o tipo (060 -> 100). */
const PROPERTY_CENTS = 150_000_000;
const BASE_FINANCING_CENTS = 50_000_000;

/**
 * Valores digitados por uma execução de tests/simulator/simulation-database.spec.ts.
 * Centavos ALEATÓRIOS (10^7 combinações) no financiamento (até R$ 999,99) e na
 * renda (até R$ 0,99) tornam a simulação gravada reconhecível como desta execução.
 * O imóvel NÃO varia: ele fica exatamente no limite do tipo de operação, e qualquer
 * centavo a mais mudaria a jornada.
 */
export function uniqueSimulationInput(
  borrowerType: "Pessoa Física" | "Pessoa Jurídica",
): UniqueSimulationInput {
  const financingCents = BASE_FINANCING_CENTS + randomInt(0, 100_000);
  const incomeBaseCents = borrowerType === "Pessoa Jurídica" ? 50_000_000 : 5_000_000;
  const incomeCents = incomeBaseCents + randomInt(0, 100);
  return {
    input: {
      propertyValueCents: String(PROPERTY_CENTS),
      financingValueCents: String(financingCents),
      termMonths: 120,
      amortizationSystem: "SAC - Sistema de amortizacao constante",
      gracePeriodDays: 30,
      birthDateDigits: "01012001",
      // PJ informa faturamento: valor alto evita bloqueio por renda mínima.
      netIncomeCents: String(incomeCents),
      composeIncome: false,
    },
    expected: {
      property: PROPERTY_CENTS / 100,
      financing: financingCents / 100,
      income: incomeCents / 100,
    },
  };
}
