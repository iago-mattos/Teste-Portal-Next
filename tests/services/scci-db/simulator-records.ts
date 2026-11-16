import type { ScciDbConfig } from "../../config/scci-db-config";
import { queryScci, type ScciQueryOptions, type ScciQueryRunner } from "./scci-db-client";
import type { InsurerRegistryRow } from "./insurer-registry";
import { waitFor, type WaitForClock } from "./poll";
import { sqlCpfVariants, sqlDocumentVariants, sqlInteger, type ScciDbRow } from "./sqlplus-script";

/**
 * O que o Simulador grava no SCCI (levantado no DDL e no SQL do `woriginacao`):
 *
 *  - GravaSimulacaoOriginacao → SIMULACAO_ORIGINACAO (NU_SIMULACAO + NU_SESSAO);
 *  - OperacaoSalvaSimulacaoInternet (envio da proposta) → PRETENDENTE,
 *    PESSOA_PRETENDENTE, OPERACAO_CREDITO, IMOVEL_OPERACAO; depois
 *    `UPDATE OPERACAO_CREDITO SET NU_SIMULACAO` liga a operação à simulação.
 *
 * Valores numéricos chegam com ponto decimal; datas como 'YYYY-MM-DD HH24:MI:SS'.
 */

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error(`Valor numerico inesperado do SCCI: ${value}`);
  return parsed;
}

function requireNumber(value: string | null, column: string): number {
  const parsed = toNumber(value);
  if (parsed === null) throw new Error(`Coluna ${column} veio vazia do SCCI.`);
  return parsed;
}

// ---------------------------------------------------------------- simulação

const SIMULATION_COLUMNS = [
  "NU_SIMULACAO",
  "NU_SESSAO",
  "DT_REFERENCIA",
  "CO_GRUPO_TIPO_OPERACAO",
  "CO_TIPO_OPERACAO",
  "CO_ENQUADRAMENTO",
  "CO_SEGURADORA",
  "CO_SEGURADORA_DFI",
  "CO_APOLICE",
  "CO_APOLICE_DFI",
  "DT_NASCIMENTO_1",
  "VA_OPERACAO",
  "VA_FINANCIAMENTO",
  "VA_PRECO_IMOVEL",
  "VA_RENDA_FAMILIAR",
  "NU_PRAZO_MESES_OPERACAO",
  "CO_SISTEMA_AMORTIZACAO",
  "CO_PLANO",
  "PE_TX_ANUAL_JUROS",
  "NU_CPFCNPJ",
  "CO_INDICE",
  "VA_MIP",
  "VA_DFI",
  "VA_TARIFA_ADMINISTRACAO",
  "VA_AMAISJ_1A_PRESTACAO",
  "IN_TIPO_IMOVEL",
  "CO_TIPO_IMOVEL",
  "NO_IMOVEL_NOVO",
  "VA_AREA_UTIL",
] as const;

/** Chave primária de SIMULACAO_ORIGINACAO: NU_SIMULACAO sozinho pode ter mais de uma sessão. */
export interface ScciSimulationKey {
  readonly nuSimulacao: number | string;
  readonly nuSessao: number | string;
}

export interface ScciSimulation {
  readonly nuSimulacao: number;
  readonly nuSessao: number;
  readonly dtReferencia: string | null;
  readonly coGrupoTipoOperacao: string | null;
  readonly coTipoOperacao: string | null;
  readonly coEnquadramento: number | null;
  readonly coSeguradora: number | null;
  readonly coSeguradoraDfi: number | null;
  readonly coApolice: string | null;
  readonly coApoliceDfi: string | null;
  readonly dtNascimento1: string | null;
  readonly vaOperacao: number | null;
  readonly vaFinanciamento: number | null;
  readonly vaPrecoImovel: number | null;
  readonly vaRendaFamiliar: number | null;
  readonly nuPrazoMesesOperacao: number | null;
  readonly coSistemaAmortizacao: number | null;
  readonly coPlano: number | null;
  readonly peTxAnualJuros: number | null;
  readonly nuCpfCnpj: string | null;
  readonly coIndice: number | null;
  readonly vaMip: number | null;
  readonly vaDfi: number | null;
  readonly vaTarifaAdministracao: number | null;
  readonly vaAmaisj1aPrestacao: number | null;
  readonly inTipoImovel: string | null;
  readonly coTipoImovel: number | null;
  readonly noImovelNovo: string | null;
  readonly vaAreaUtil: number | null;
}

function toSimulation(row: ScciDbRow<(typeof SIMULATION_COLUMNS)[number]>): ScciSimulation {
  return {
    nuSimulacao: requireNumber(row.NU_SIMULACAO, "NU_SIMULACAO"),
    nuSessao: requireNumber(row.NU_SESSAO, "NU_SESSAO"),
    dtReferencia: row.DT_REFERENCIA,
    coGrupoTipoOperacao: row.CO_GRUPO_TIPO_OPERACAO,
    coTipoOperacao: row.CO_TIPO_OPERACAO,
    coEnquadramento: toNumber(row.CO_ENQUADRAMENTO),
    coSeguradora: toNumber(row.CO_SEGURADORA),
    coSeguradoraDfi: toNumber(row.CO_SEGURADORA_DFI),
    coApolice: row.CO_APOLICE,
    coApoliceDfi: row.CO_APOLICE_DFI,
    dtNascimento1: row.DT_NASCIMENTO_1,
    vaOperacao: toNumber(row.VA_OPERACAO),
    vaFinanciamento: toNumber(row.VA_FINANCIAMENTO),
    vaPrecoImovel: toNumber(row.VA_PRECO_IMOVEL),
    vaRendaFamiliar: toNumber(row.VA_RENDA_FAMILIAR),
    nuPrazoMesesOperacao: toNumber(row.NU_PRAZO_MESES_OPERACAO),
    coSistemaAmortizacao: toNumber(row.CO_SISTEMA_AMORTIZACAO),
    coPlano: toNumber(row.CO_PLANO),
    peTxAnualJuros: toNumber(row.PE_TX_ANUAL_JUROS),
    nuCpfCnpj: row.NU_CPFCNPJ,
    coIndice: toNumber(row.CO_INDICE),
    vaMip: toNumber(row.VA_MIP),
    vaDfi: toNumber(row.VA_DFI),
    vaTarifaAdministracao: toNumber(row.VA_TARIFA_ADMINISTRACAO),
    vaAmaisj1aPrestacao: toNumber(row.VA_AMAISJ_1A_PRESTACAO),
    inTipoImovel: row.IN_TIPO_IMOVEL,
    coTipoImovel: toNumber(row.CO_TIPO_IMOVEL),
    noImovelNovo: row.NO_IMOVEL_NOVO,
    vaAreaUtil: toNumber(row.VA_AREA_UTIL),
  };
}

// ----------------------------------------------------------------- proposta

const PROPOSAL_COLUMNS = [
  "NU_OPERACAO",
  "NU_PRETENDENTE",
  "NU_SIMULACAO",
  "NU_FASE_ATUAL",
  "DT_CADASTRAMENTO_OPERACAO",
  "CO_TIPO_OPERACAO",
  "CO_ENQUADRAMENTO",
  "CO_SEGURADORA",
  "CO_PLANO",
  "CO_SISTEMA_AMORTIZACAO",
  "VA_OPERACAO",
  "VA_FINANCIAMENTO",
  "VA_PRECO_IMOVEL",
  "VA_RENDA_FAMILIAR",
  "NU_PRAZO_MESES_OPERACAO",
  "VA_MIP",
  "VA_DFI",
  "VA_TARIFA_ADMINISTRACAO",
  "IN_CARENCIA_AMORTIZACAO",
  "IN_TIPO_JUROS_CARENCIA",
  "NU_PRAZO_CARENCIA_AMAISJ",
  "VA_AMAISJ_1A_PREST_POSCAR",
] as const;

export interface ScciProposal {
  readonly nuOperacao: number;
  readonly nuPretendente: number | null;
  /** null = operação ainda não ligada a uma simulação. */
  readonly nuSimulacao: number | null;
  readonly nuFaseAtual: number | null;
  readonly dtCadastramentoOperacao: string | null;
  readonly coTipoOperacao: string | null;
  readonly coEnquadramento: number | null;
  readonly coSeguradora: number | null;
  readonly coPlano: number | null;
  readonly coSistemaAmortizacao: number | null;
  readonly vaOperacao: number | null;
  readonly vaFinanciamento: number | null;
  readonly vaPrecoImovel: number | null;
  readonly vaRendaFamiliar: number | null;
  readonly nuPrazoMesesOperacao: number | null;
  readonly vaMip: number | null;
  readonly vaDfi: number | null;
  readonly vaTarifaAdministracao: number | null;
  /** Carência: gravada no envio da proposta (SIMULACAO_ORIGINACAO não tem coluna de carência). */
  readonly inCarenciaAmortizacao: string | null;
  readonly inTipoJurosCarencia: number | null;
  readonly nuPrazoCarenciaAmaisj: number | null;
  readonly vaAmaisj1aPrestPoscar: number | null;
}

function toProposal(row: ScciDbRow<(typeof PROPOSAL_COLUMNS)[number]>): ScciProposal {
  return {
    nuOperacao: requireNumber(row.NU_OPERACAO, "NU_OPERACAO"),
    nuPretendente: toNumber(row.NU_PRETENDENTE),
    nuSimulacao: toNumber(row.NU_SIMULACAO),
    nuFaseAtual: toNumber(row.NU_FASE_ATUAL),
    dtCadastramentoOperacao: row.DT_CADASTRAMENTO_OPERACAO,
    coTipoOperacao: row.CO_TIPO_OPERACAO,
    coEnquadramento: toNumber(row.CO_ENQUADRAMENTO),
    coSeguradora: toNumber(row.CO_SEGURADORA),
    coPlano: toNumber(row.CO_PLANO),
    coSistemaAmortizacao: toNumber(row.CO_SISTEMA_AMORTIZACAO),
    vaOperacao: toNumber(row.VA_OPERACAO),
    vaFinanciamento: toNumber(row.VA_FINANCIAMENTO),
    vaPrecoImovel: toNumber(row.VA_PRECO_IMOVEL),
    vaRendaFamiliar: toNumber(row.VA_RENDA_FAMILIAR),
    nuPrazoMesesOperacao: toNumber(row.NU_PRAZO_MESES_OPERACAO),
    vaMip: toNumber(row.VA_MIP),
    vaDfi: toNumber(row.VA_DFI),
    vaTarifaAdministracao: toNumber(row.VA_TARIFA_ADMINISTRACAO),
    inCarenciaAmortizacao: row.IN_CARENCIA_AMORTIZACAO,
    inTipoJurosCarencia: toNumber(row.IN_TIPO_JUROS_CARENCIA),
    nuPrazoCarenciaAmaisj: toNumber(row.NU_PRAZO_CARENCIA_AMAISJ),
    vaAmaisj1aPrestPoscar: toNumber(row.VA_AMAISJ_1A_PREST_POSCAR),
  };
}

const PROPOSAL_SELECT = `SELECT ${PROPOSAL_COLUMNS.map((column) => `OC.${column}`).join(", ")} FROM OPERACAO_CREDITO OC`;

// --------------------------------------------------------------- pretendentes

const APPLICANT_COLUMNS = [
  "NU_PRETENDENTE",
  "NU_PESSOA",
  "NO_PESSOA",
  "NU_CPFCNPJ",
  "DT_NASCIMENTO",
  "NO_EMAIL",
  "NU_DDD_CEL",
  "NU_CELULAR",
  "VA_RENDA",
  "NO_PESSOA_COMPLETO",
  "NO_PESSOA_CONTATO_PJ",
  "NU_DDD_TEL_CONTATO_PJ",
  "NU_TEL_CONTATO_PJ",
] as const;

/**
 * Dados pessoais: leia SÓ pretendentes criados pelo teste (CPF/CNPJ sintético) e
 * nunca anexe a linha inteira a relatório, trace ou PDF.
 */
export interface ScciApplicant {
  readonly nuPretendente: number;
  readonly nuPessoa: number | null;
  readonly noPessoa: string | null;
  readonly nuCpfCnpj: string | null;
  readonly dtNascimento: string | null;
  readonly noEmail: string | null;
  readonly nuDddCel: string | null;
  readonly nuCelular: string | null;
  readonly vaRenda: number | null;
  readonly noPessoaCompleto: string | null;
  readonly noPessoaContatoPj: string | null;
  readonly nuDddTelContatoPj: string | null;
  readonly nuTelContatoPj: string | null;
}

function toApplicant(row: ScciDbRow<(typeof APPLICANT_COLUMNS)[number]>): ScciApplicant {
  return {
    nuPretendente: requireNumber(row.NU_PRETENDENTE, "NU_PRETENDENTE"),
    nuPessoa: toNumber(row.NU_PESSOA),
    noPessoa: row.NO_PESSOA,
    nuCpfCnpj: row.NU_CPFCNPJ,
    dtNascimento: row.DT_NASCIMENTO,
    noEmail: row.NO_EMAIL,
    nuDddCel: row.NU_DDD_CEL,
    nuCelular: row.NU_CELULAR,
    vaRenda: toNumber(row.VA_RENDA),
    noPessoaCompleto: row.NO_PESSOA_COMPLETO,
    noPessoaContatoPj: row.NO_PESSOA_CONTATO_PJ,
    nuDddTelContatoPj: row.NU_DDD_TEL_CONTATO_PJ,
    nuTelContatoPj: row.NU_TEL_CONTATO_PJ,
  };
}

// --------------------------------------------------------------------- API

export interface ScciWaitOptions {
  /** Tempo total da espera (padrão 30 s). */
  readonly timeoutMs?: number;
  /** Intervalo entre tentativas (padrão 2,5 s; mínimo 1 s). */
  readonly intervalMs?: number;
  /** Limite de CADA tentativa (ssh + sqlplus; padrão 20 s). */
  readonly queryTimeoutMs?: number;
}

export interface ScciSimulationRef {
  readonly nuSimulacao: number;
  readonly nuSessao: number;
}

export interface ScciLinkedProposalKeys {
  readonly nuOperacao: number;
  readonly nuPretendente: number | null;
  readonly nuSimulacao: number | null;
}

/** Consultas somente leitura do Simulador, presas a uma configuração. */
export class ScciSimulatorRecords {
  constructor(
    private readonly config: ScciDbConfig,
    private readonly options: ScciQueryOptions = {},
    private readonly runQuery: ScciQueryRunner = queryScci,
  ) {}

  /** Teste de vida da conexão (ssh + sqlplus + login no Oracle). */
  async ping(): Promise<boolean> {
    const rows = await this.runQuery(this.config, "SELECT 1 AS UM FROM DUAL", ["UM"], this.options);
    return rows[0]?.UM === "1";
  }

  /**
   * Maior NU_SIMULACAO do ambiente. Só para teste de vida da leitura: num ambiente
   * compartilhado, com workers em paralelo, "a última" pode ser de outra pessoa.
   * Para conferir uma simulação do teste, use a chave (nuSimulacao + nuSessao) da
   * resposta de /api/simulacao/evolucao.
   */
  async latestSimulationNumber(): Promise<number | null> {
    const rows = await this.runQuery(
      this.config,
      "SELECT MAX(NU_SIMULACAO) AS ULTIMA FROM SIMULACAO_ORIGINACAO",
      ["ULTIMA"],
      this.options,
    );
    return toNumber(rows[0]?.ULTIMA ?? null);
  }

  /** Uma simulação pela chave completa. `undefined` = ainda não gravada. */
  async getSimulation(
    key: ScciSimulationKey,
    query: ScciQueryOptions = this.options,
  ): Promise<ScciSimulation | undefined> {
    const rows = await this.runQuery(
      this.config,
      `SELECT ${SIMULATION_COLUMNS.join(", ")} FROM SIMULACAO_ORIGINACAO WHERE NU_SIMULACAO = ${sqlInteger(key.nuSimulacao)} AND NU_SESSAO = ${sqlInteger(key.nuSessao)}`,
      SIMULATION_COLUMNS,
      query,
    );
    if (rows.length > 1) {
      throw new Error(
        `A chave ${String(key.nuSimulacao)}/${String(key.nuSessao)} devolveu mais de uma linha em SIMULACAO_ORIGINACAO.`,
      );
    }
    return rows[0] ? toSimulation(rows[0]) : undefined;
  }

  /** Todas as sessões gravadas para um NU_SIMULACAO (há simulações com mais de uma). */
  async findSimulationSessions(nuSimulacao: number | string): Promise<ScciSimulation[]> {
    const rows = await this.runQuery(
      this.config,
      `SELECT ${SIMULATION_COLUMNS.join(", ")} FROM SIMULACAO_ORIGINACAO WHERE NU_SIMULACAO = ${sqlInteger(nuSimulacao)} ORDER BY NU_SESSAO`,
      SIMULATION_COLUMNS,
      this.options,
    );
    return rows.map(toSimulation);
  }

  /**
   * Só as chaves das sessões de um NU_SIMULACAO (sem CPF, nascimento nem renda):
   * para o smoke, que lê a simulação de qualquer pessoa do ambiente.
   */
  async findSimulationSessionKeys(nuSimulacao: number | string): Promise<ScciSimulationRef[]> {
    const columns = ["NU_SIMULACAO", "NU_SESSAO"] as const;
    const rows = await this.runQuery(
      this.config,
      `SELECT NU_SIMULACAO, NU_SESSAO FROM SIMULACAO_ORIGINACAO WHERE NU_SIMULACAO = ${sqlInteger(nuSimulacao)} ORDER BY NU_SESSAO`,
      columns,
      this.options,
    );
    return rows.map((row) => ({
      nuSimulacao: requireNumber(row.NU_SIMULACAO, "NU_SIMULACAO"),
      nuSessao: requireNumber(row.NU_SESSAO, "NU_SESSAO"),
    }));
  }

  /**
   * Espera, com limite, a simulação aparecer. A gravação pode ser posterior à tela.
   * Cada tentativa custa 1 a 2 s (ssh + sqlplus); o intervalo mínimo é 1 s.
   */
  async waitForSimulation(
    key: ScciSimulationKey,
    wait: ScciWaitOptions = {},
    clock?: WaitForClock,
  ): Promise<ScciSimulation> {
    const perAttempt: ScciQueryOptions = { ...this.options, timeoutMs: wait.queryTimeoutMs ?? 20_000 };
    return waitFor(
      () => this.getSimulation(key, perAttempt),
      {
        description: `a simulacao ${String(key.nuSimulacao)}/${String(key.nuSessao)} no SCCI`,
        timeoutMs: wait.timeoutMs ?? 30_000,
        intervalMs: wait.intervalMs ?? 2_500,
      },
      clock,
    );
  }

  /**
   * Simulações gravadas depois de `afterNuSimulacao`.
   * @deprecated Não use para asserção: pega simulações de outras pessoas e de outros workers.
   */
  async simulationsAfter(afterNuSimulacao: number | string): Promise<ScciSimulation[]> {
    const rows = await this.runQuery(
      this.config,
      `SELECT ${SIMULATION_COLUMNS.join(", ")} FROM SIMULACAO_ORIGINACAO WHERE NU_SIMULACAO > ${sqlInteger(afterNuSimulacao)} ORDER BY NU_SIMULACAO, NU_SESSAO`,
      SIMULATION_COLUMNS,
      this.options,
    );
    return rows.map(toSimulation);
  }

  async getProposal(nuOperacao: number | string): Promise<ScciProposal | undefined> {
    const rows = await this.runQuery(
      this.config,
      `${PROPOSAL_SELECT} WHERE OC.NU_OPERACAO = ${sqlInteger(nuOperacao)}`,
      PROPOSAL_COLUMNS,
      this.options,
    );
    return rows[0] ? toProposal(rows[0]) : undefined;
  }

  /** Proposta mais recente já ligada a uma simulação (OPERACAO_CREDITO.NU_SIMULACAO). */
  async latestProposalWithSimulation(): Promise<ScciProposal | undefined> {
    const inner = `${PROPOSAL_SELECT} WHERE OC.NU_SIMULACAO IS NOT NULL ORDER BY OC.NU_OPERACAO DESC`;
    const rows = await this.runQuery(
      this.config,
      `SELECT * FROM (${inner}) WHERE ROWNUM <= 1`,
      PROPOSAL_COLUMNS,
      this.options,
    );
    return rows[0] ? toProposal(rows[0]) : undefined;
  }

  /** Chaves da proposta mais recente ligada a uma simulação (sem valores nem pessoas). */
  async latestLinkedProposalKeys(): Promise<ScciLinkedProposalKeys | undefined> {
    const columns = ["NU_OPERACAO", "NU_PRETENDENTE", "NU_SIMULACAO"] as const;
    const inner =
      "SELECT OC.NU_OPERACAO, OC.NU_PRETENDENTE, OC.NU_SIMULACAO FROM OPERACAO_CREDITO OC" +
      " WHERE OC.NU_SIMULACAO IS NOT NULL ORDER BY OC.NU_OPERACAO DESC";
    const rows = await this.runQuery(
      this.config,
      `SELECT * FROM (${inner}) WHERE ROWNUM <= 1`,
      columns,
      this.options,
    );
    const row = rows[0];
    if (!row) return undefined;
    return {
      nuOperacao: requireNumber(row.NU_OPERACAO, "NU_OPERACAO"),
      nuPretendente: toNumber(row.NU_PRETENDENTE),
      nuSimulacao: toNumber(row.NU_SIMULACAO),
    };
  }

  /** Propostas mais recentes de um CPF (proponente em PESSOA_PRETENDENTE). */
  async latestProposalsByCpf(cpf: string, limit = 5): Promise<ScciProposal[]> {
    const inner =
      `${PROPOSAL_SELECT} WHERE EXISTS (SELECT 1 FROM PESSOA_PRETENDENTE PP` +
      ` WHERE PP.NU_PRETENDENTE = OC.NU_PRETENDENTE AND PP.NU_CPFCNPJ IN (${sqlCpfVariants(cpf)}))` +
      " ORDER BY OC.DT_CADASTRAMENTO_OPERACAO DESC, OC.NU_OPERACAO DESC";
    const rows = await this.runQuery(
      this.config,
      `SELECT * FROM (${inner}) WHERE ROWNUM <= ${sqlInteger(limit)}`,
      PROPOSAL_COLUMNS,
      this.options,
    );
    return rows.map(toProposal);
  }

  /**
   * Cadastro de seguradoras de um tipo de operação, como o Simulador o lê
   * (SEGURADORA_TIPO_OPERACAO + SEGURA), na ordem de NU_SEQ. Só dados de cadastro.
   * Todas as linhas do tipo: o enquadramento usado na simulação não é gravado na
   * avaliação, então quem compara deve tratar o resultado como o limite superior.
   */
  async insurerRegistryForType(coTipoOperacao: string): Promise<InsurerRegistryRow[]> {
    if (!/^\d{3}$/.test(coTipoOperacao)) {
      throw new Error("Codigo do tipo de operacao invalido (esperado 3 digitos).");
    }
    const columns = ["CO_SEGURADORA", "CO_APOLICE", "CO_ENQUADRAMENTO", "NU_SEQ", "NOME"] as const;
    const rows = await this.runQuery(
      this.config,
      "SELECT STO.CO_SEGURADORA, STO.CO_APOLICE, STO.CO_ENQUADRAMENTO, STO.NU_SEQ, S.NOME" +
        " FROM SEGURADORA_TIPO_OPERACAO STO LEFT JOIN SEGURA S ON STO.CO_SEGURADORA = S.CODIGO" +
        ` WHERE STO.CO_TIPO_OPERACAO = '${coTipoOperacao}' ORDER BY STO.NU_SEQ`,
      columns,
      this.options,
    );
    return rows.map((row) => ({
      coSeguradora: toNumber(row.CO_SEGURADORA),
      coApolice: row.CO_APOLICE,
      coEnquadramento: toNumber(row.CO_ENQUADRAMENTO),
      nuSeq: requireNumber(row.NU_SEQ, "NU_SEQ"),
      nome: row.NOME,
    }));
  }

  /** Quantas pessoas há no pretendente. Não lê nenhum dado pessoal. */
  async countApplicants(nuPretendente: number | string): Promise<number> {
    const rows = await this.runQuery(
      this.config,
      `SELECT COUNT(*) AS TOTAL FROM PESSOA_PRETENDENTE WHERE NU_PRETENDENTE = ${sqlInteger(nuPretendente)}`,
      ["TOTAL"],
      this.options,
    );
    return requireNumber(rows[0]?.TOTAL ?? null, "TOTAL");
  }

  /**
   * Pessoas de um pretendente, SÓ se alguma delas tiver o CPF/CNPJ informado (o
   * sintético do teste). Assim o teste não lê dados pessoais de outras pessoas.
   */
  async getApplicantsByDocument(
    nuPretendente: number | string,
    document: string,
  ): Promise<ScciApplicant[]> {
    const pretendente = sqlInteger(nuPretendente);
    const rows = await this.runQuery(
      this.config,
      `SELECT ${APPLICANT_COLUMNS.join(", ")} FROM PESSOA_PRETENDENTE WHERE NU_PRETENDENTE = ${pretendente}` +
        ` AND EXISTS (SELECT 1 FROM PESSOA_PRETENDENTE X WHERE X.NU_PRETENDENTE = ${pretendente}` +
        ` AND X.NU_CPFCNPJ IN (${sqlDocumentVariants(document)})) ORDER BY NU_PESSOA`,
      APPLICANT_COLUMNS,
      this.options,
    );
    return rows.map(toApplicant);
  }
}
