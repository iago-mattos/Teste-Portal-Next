import { expect, test } from "@playwright/test";
import { uniqueSimulationInput } from "../test-data/simulation-database-input";

/**
 * Valores únicos por execução para tests/simulator/simulation-database.spec.ts.
 * O IMÓVEL fica fixo em R$ 1.500.000,00: acima disso o Simulador troca o tipo de
 * operação (060 -> 100, medido em 12/11/2026), e a jornada deixaria de ser a mesma.
 */
test.describe("simulation-input | valores únicos sem mudar o tipo de operação", () => {
  test("o imóvel é sempre exatamente R$ 1.500.000,00 (limite do tipo de operação)", () => {
    for (let index = 0; index < 500; index += 1) {
      const { input, expected } = uniqueSimulationInput("Pessoa Física");
      expect(input.propertyValueCents).toBe("150000000");
      expect(expected.property).toBe(1_500_000);
    }
  });

  test("financiamento varia só em até R$ 999,99 acima de R$ 500.000,00", () => {
    for (let index = 0; index < 500; index += 1) {
      const { expected } = uniqueSimulationInput("Pessoa Física");
      expect(expected.financing).toBeGreaterThanOrEqual(500_000);
      expect(expected.financing).toBeLessThan(501_000);
    }
  });

  test("renda varia só em centavos: PF 50.000 e PJ 500.000", () => {
    for (let index = 0; index < 200; index += 1) {
      const pf = uniqueSimulationInput("Pessoa Física").expected.income;
      const pj = uniqueSimulationInput("Pessoa Jurídica").expected.income;
      expect(pf).toBeGreaterThanOrEqual(50_000);
      expect(pf).toBeLessThan(50_001);
      expect(pj).toBeGreaterThanOrEqual(500_000);
      expect(pj).toBeLessThan(500_001);
    }
  });

  test("o esperado em reais é exatamente o que foi digitado em centavos", () => {
    const { input, expected } = uniqueSimulationInput("Pessoa Física");
    expect(Number(input.financingValueCents) / 100).toBe(expected.financing);
    expect(Number(input.netIncomeCents) / 100).toBe(expected.income);
  });

  test("duas chamadas quase nunca repetem o par (financiamento, renda)", () => {
    const seen = new Set<string>();
    for (let index = 0; index < 300; index += 1) {
      const { expected } = uniqueSimulationInput("Pessoa Física");
      seen.add(`${expected.financing}/${expected.income}`);
    }
    expect(seen.size).toBeGreaterThan(290);
  });
});
