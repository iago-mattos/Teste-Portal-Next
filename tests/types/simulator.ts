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
  /** 0 = sem carência (opção "Selecione"). */
  readonly gracePeriodDays: 0 | 30 | 60 | 90;
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

/**
 * Contratos das jornadas de NAVEGAÇÃO do Simulador, observados em
 * portal-desenv em 09/11/2026 (leitura, sem envio de proposta).
 *
 * Eles descrevem o que a interface oferece em cada ramo; não afirmam regra de
 * negócio. A matriz de combinações permitidas ainda aguarda confirmação de
 * Produto (ver PLAYWRIGHT_SIMULATOR_COVERAGE_AUDIT.md, seção 9, item 1).
 * `SimulationJourneyInput` continua restrito à jornada com cálculo e reflexão
 * validados no SCCI e é atribuível a `SimulationJourneySelection`.
 */
export type FinancingIndexer =
  | "Taxa Referencial (TR)"
  | "Índice de Preços ao Consumidor Amplo (IPCA)"
  | "Poupança";

export type FinancingPfOrigin =
  | "Empreendimento Financiado pela Esteira Digital"
  | "Imóvel da Esteira Digital"
  | "Imóvel Particular";

export type FinancingPjOrigin =
  | "Empreendimento Financiado pela Esteira Digital"
  | "Imóvel Esteira Digital"
  | "Imóvel Particular";

export type BorrowerType = "Pessoa Física" | "Pessoa Jurídica";

export type FinancingPfJourney =
  | {
      readonly modality: "Financiamento Imobiliário";
      readonly borrowerType: "Pessoa Física";
      readonly propertyType: "Imóvel Residencial";
      readonly propertyOrigin: FinancingPfOrigin;
      readonly indexer: FinancingIndexer;
    }
  | {
      readonly modality: "Financiamento Imobiliário";
      readonly borrowerType: "Pessoa Física";
      readonly propertyType: "Imóvel Comercial";
      readonly propertyOrigin: FinancingPfOrigin;
      readonly indexer: Exclude<FinancingIndexer, "Poupança">;
    };

/** Pessoa Jurídica não tem a etapa de indexador: a origem leva aos Dados. */
export type FinancingPjJourney =
  | {
      readonly modality: "Financiamento Imobiliário";
      readonly borrowerType: "Pessoa Jurídica";
      readonly propertyType: "Imóvel Comercial";
      readonly propertyOrigin: FinancingPjOrigin;
      readonly indexer?: undefined;
    }
  | {
      readonly modality: "Financiamento Imobiliário";
      readonly borrowerType: "Pessoa Jurídica";
      readonly propertyType: "Imóvel Residencial";
      readonly propertyOrigin: FinancingPjOrigin | "Holding Familiar";
      readonly indexer?: undefined;
    };

export interface HomeEquityJourney {
  readonly modality: "Crédito Garantia de Imóvel";
  readonly borrowerType: BorrowerType;
  readonly propertyType: "Imóvel";
  readonly propertyOrigin?: undefined;
  readonly indexer?: undefined;
}

export type SimulationJourneySelection =
  | FinancingPfJourney
  | FinancingPjJourney
  | HomeEquityJourney;

/** Textos exibidos na tela Dados para uma jornada (acentuação como na interface). */
export interface SimulationDataScreenExpectation {
  /** Rótulo acima do título "Dados da simulacao". Comparado sem diferenciar caixa. */
  readonly eyebrow: string;
  readonly propertyValueLabel: "Valor do imovel";
  readonly financingValueLabel: "Valor do financiamento" | "Valor do emprestimo";
  readonly incomeLabel: "Renda liquida" | "Faturamento liquido";
}

export interface ObservedJourney {
  readonly id: string;
  readonly selection: SimulationJourneySelection;
  readonly dataScreen: SimulationDataScreenExpectation;
}
