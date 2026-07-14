import type { DigitalMortgageSimulationScenario } from "../types/simulator";

/**
 * Contrato oficial para gerar propostas descartáveis pelo simulador público.
 *
 * Valores monetários ficam em centavos porque os inputs aplicam máscara durante
 * a digitação. O nome completo e o protocolo são gerados por execução e serão
 * registrados pelo provisionador, sem transformar dados dinâmicos em contrato.
 */
export const DIGITAL_MORTGAGE_SIMULATION = Object.freeze({
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
  applicantSeed: {
    cpfDigits: "75940275311",
    namePrefix: "Play --",
    email: "Teste@prognum.com.br",
    mobileDigits: "21998078467",
  },
} satisfies DigitalMortgageSimulationScenario);
