/**
 * Referência de domínio lida do SCCI (Manutenção > Tabelas > Originação e
 * Terceiros), por jornada do Simulador. É independente do Simulador: serve de
 * oráculo para limites e seguradoras. Os valores monetários estão em reais.
 */
export interface ScciInsurerLink {
  readonly code: string;
  readonly name: string;
  /** Código da apólice vinculada ao tipo (linhas repetidas indicam cadastro duplicado). */
  readonly policy: string;
}

/** Regra de carência do tipo (Tipo de operação > Carências). */
export interface ScciGraceRule {
  /** Nº máximo de meses de carência. */
  readonly maxMonths: number;
  /** Meses de carência na 1ª prestação. */
  readonly firstInstallmentMonths: number;
  readonly interestType: string;
}

export interface ScciOperationType {
  readonly code: string;
  readonly description: string;
  readonly minOperation: number;
  readonly maxOperation: number;
  readonly maxProperty: number;
  readonly minTermMonths: number;
  readonly maxTermMonths: number;
  /** 0 significa "sem regra". */
  readonly minAge: number;
  readonly maxAge: number;
  readonly agePlusTermMax: number;
  /** Fração em meses somada à idade máxima (ex.: 80 anos e 3 meses → 3). */
  readonly maxAgeMonths: number;
  /** Fração em meses somada a "idade + prazo" (ex.: 80 anos e 3 meses → 3). */
  readonly agePlusTermMaxMonths: number;
  readonly minInstallment: number;
  readonly insurers: readonly ScciInsurerLink[];
  /** Vazio = o tipo não tem carência cadastrada. */
  readonly graceRules: readonly ScciGraceRule[];
}

/** Faixa de LTV (Tabelas > Originação > Faixa LTV por tipo de operação). */
export interface ScciLtvBand {
  /** Vazio quando a faixa vale para o grupo inteiro. */
  readonly operationTypeCode: string;
  /** Percentual máximo de financiamento sobre o imóvel. */
  readonly maxLtvPercent: number;
  readonly incomeCommitmentPercent: number;
  /** Código do sistema de amortização no SCCI: 2 = SAC, 1 = Price. */
  readonly amortizationSystem: string;
  readonly inactive: boolean;
}

export interface ScciJourneyReference {
  readonly journeyId: string;
  readonly groupCode: string;
  /** Grupos da cadeia da jornada marcados como "Modalidade suspensa" no SCCI ("código nome"). */
  readonly suspendedGroups: readonly string[];
  readonly operationTypes: readonly ScciOperationType[];
  readonly ltvBands: readonly ScciLtvBand[];
}

/** Estado inicial de uma proposta criada pelo Simulador (Originação > Configurações). */
export interface ScciInitialProcess {
  /** `NU_FASE_SIMULACAO`. */
  readonly initialPhaseCode: string;
  /** Nome da fase em "Fases da operação". */
  readonly initialPhaseName: string;
  /** `CO_TAREFA_ENVIO_PROPOSTA`. */
  readonly initialTaskCode: string;
}

export interface ScciReference {
  readonly source: string;
  readonly readAt: string;
  readonly process: ScciInitialProcess;
  readonly journeys: readonly ScciJourneyReference[];
}
