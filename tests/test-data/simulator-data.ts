import type { DigitalMortgageSimulationScenario } from "../types/simulator";

/**
 * Contrato oficial para gerar propostas descartáveis pelo simulador público.
 *
 * Valores monetários ficam em centavos porque os inputs aplicam máscara durante
 * a digitação. O nome completo e o protocolo são gerados por execução e serão
 * registrados pelo provisionador, sem transformar dados dinâmicos em contrato.
 */
const DIGITAL_MORTGAGE_SIMULATION_BASE = Object.freeze({
  journey: {
    modality: "Financiamento Imobiliário",
    borrowerType: "Pessoa Física",
    propertyType: "Imóvel Residencial",
    propertyOrigin: "Imóvel da Esteira Digital",
    indexer: "Taxa Referencial (TR)",
  },
  financial: {
    propertyValueCents: "150000000",
    financingValueCents: "50000000",
    termMonths: 120,
    amortizationSystem: "SAC - Sistema de amortizacao constante",
    gracePeriodDays: 30,
    birthDateDigits: "01012001",
    netIncomeCents: "5000000",
    composeIncome: false,
  },
  insurer: "MAPFRE",
  scciReflection: {
    financingModality: "Nova Operação",
    conditions: "Cliente da Esteira Digital",
    familyIncomeCents: "5000000",
    constructionFinancingValueCents: "0",
    amortizationSystem: "2 - SAC",
  },
} as const);

function requiredEnvironmentValue(
  env: NodeJS.ProcessEnv,
  key: string,
): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Configuração obrigatória ausente: ${key}.`);
  return value;
}

export function getDigitalMortgageSimulation(
  env: NodeJS.ProcessEnv = process.env,
): DigitalMortgageSimulationScenario {
  return Object.freeze({
    ...DIGITAL_MORTGAGE_SIMULATION_BASE,
    applicantSeed: Object.freeze({
      email: requiredEnvironmentValue(env, "PORTAL_SIMULATOR_EMAIL"),
      mobileDigits: requiredEnvironmentValue(
        env,
        "PORTAL_SIMULATOR_MOBILE",
      ).replace(/\D/g, ""),
    }),
  }) satisfies DigitalMortgageSimulationScenario;
}
