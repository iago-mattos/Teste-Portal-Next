export interface SimulationJourneyInput {
  readonly modality: "Financiamento Imobiliário";
  readonly borrowerType: "Pessoa Física";
  readonly propertyType: "Imóvel Residencial";
  readonly propertyOrigin: "Imóvel da Esteira Digital";
  readonly indexer: "Taxa Referencial (TR)";
}

export interface SimulationFinancialInput {
  /** Dígitos em centavos, no formato aceito pela máscara monetária do Portal. */
  readonly propertyValueCents: string;
  /** Dígitos em centavos, no formato aceito pela máscara monetária do Portal. */
  readonly financingValueCents: string;
  readonly termMonths: 120 | 180 | 240 | 300 | 360 | 420;
  readonly amortizationSystem:
    | "SAC - Sistema de amortizacao constante"
    | "TP - Tabela Price";
  readonly gracePeriodDays: 30 | 60 | 90;
  /** Data em dígitos; a máscara do Portal aplica DD/MM/AAAA. */
  readonly birthDateDigits: string;
  /** Dígitos em centavos, no formato aceito pela máscara monetária do Portal. */
  readonly netIncomeCents: string;
  readonly composeIncome: boolean;
}

export interface SimulationApplicantSeed {
  readonly email: string;
  readonly mobileDigits: string;
}

export interface SimulationApplicantInput {
  readonly cpfDigits: string;
  readonly name: string;
  readonly email: string;
  readonly mobileDigits: string;
}

export interface SimulationScciReflectionExpectation {
  readonly financingModality: "Nova Operação";
  readonly conditions: "Cliente da Esteira Digital";
  readonly familyIncomeCents: string;
  readonly constructionFinancingValueCents: string;
  readonly amortizationSystem: "2 - SAC";
}

export interface DigitalMortgageSimulationScenario {
  readonly journey: SimulationJourneyInput;
  readonly financial: SimulationFinancialInput;
  readonly insurer: "MAPFRE";
  readonly applicantSeed: SimulationApplicantSeed;
  readonly scciReflection: SimulationScciReflectionExpectation;
}
