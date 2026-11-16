import type { SimulationFinancialInput } from "../types/simulator";

/**
 * Cenários de criação real de proposta pelo Simulador (esteira-ht). Cada um
 * cobre uma família de jornada com tipo de operação, índice ou modalidade
 * distintos; não são todas as combinações. Valores monetários em centavos.
 *
 * `expectedOperationTypeCode` é HIPÓTESE vinda do snapshot do SCCI
 * (tests/test-data/scci-reference.esteira-ht.json) e do teto de valor do tipo;
 * quando ausente, a execução só registra o tipo escolhido pelo SCCI.
 */
export interface SimulatorProposalScenario {
  readonly id: string;
  readonly purpose: string;
  /** Identificador da jornada em OBSERVED_SIMULATOR_JOURNEYS. */
  readonly journeyId: string;
  readonly financial: SimulationFinancialInput;
  /** Prefixo do nome da seguradora a selecionar. */
  readonly insurer: string;
  readonly expectedOperationTypeCode?: string;
  /** Prazo digitado no campo livre (os botões só têm 120–420); substitui `financial.termMonths`. */
  readonly customTermMonths?: number;
  /**
   * Cenário de investigação: o resultado correto ainda não foi definido por
   * Produto. O teste registra o que o Portal e o SCCI fazem (anotação), sem
   * afirmar certo/errado, e fica fora do conjunto que vale como validador
   * (tag @investigacao). O texto explica a decisão pendente.
   */
  readonly investigation?: string;
  /** A carência pedida é o propósito do cenário: sem o campo na tela, a criação é abortada. */
  readonly requireGracePeriod?: boolean;
}

const SAC = "SAC - Sistema de amortizacao constante" as const;

export const SIMULATOR_PROPOSAL_SCENARIOS: readonly SimulatorProposalScenario[] =
  Object.freeze([
    {
      id: "PF-SFI-ACIMA-TETO-SFH",
      purpose:
        "Imóvel de R$ 1.600.000 (acima do teto de R$ 1.500.000 do tipo SFH 060): o SCCI deve classificar no tipo SFI 100. Testa a hipótese SFH×SFI por valor.",
      journeyId:
        "Financiamento Imobiliário > Pessoa Física > Imóvel Residencial > Imóvel da Esteira Digital > Taxa Referencial (TR)",
      financial: {
        propertyValueCents: "160000000",
        financingValueCents: "50000000",
        termMonths: 120,
        amortizationSystem: SAC,
        gracePeriodDays: 30,
        birthDateDigits: "01012001",
        netIncomeCents: "5000000",
        composeIncome: false,
      },
      insurer: "MAPFRE",
      expectedOperationTypeCode: "100",
    },
    {
      id: "PJ-COMERCIAL-PARTICULAR",
      purpose:
        "Pessoa Jurídica sem etapa de indexador, com rótulos e reflexão próprios (SIM-INT-08).",
      journeyId:
        "Financiamento Imobiliário > Pessoa Jurídica > Imóvel Comercial > Imóvel Particular",
      financial: {
        propertyValueCents: "150000000",
        financingValueCents: "50000000",
        termMonths: 120,
        amortizationSystem: SAC,
        gracePeriodDays: 30,
        birthDateDigits: "01012001",
        netIncomeCents: "50000000",
        composeIncome: false,
      },
      insurer: "MAPFRE",
      expectedOperationTypeCode: "198",
    },
    {
      id: "CREDITO-GARANTIA-PF",
      purpose:
        "Modalidade Crédito Garantia de Imóvel (SIM-INT-09). O tipo (LTV 30/50/60%) é só registrado nesta primeira execução.",
      journeyId: "Crédito Garantia de Imóvel > Pessoa Física > Imóvel",
      financial: {
        propertyValueCents: "150000000",
        financingValueCents: "50000000",
        termMonths: 120,
        amortizationSystem: SAC,
        gracePeriodDays: 30,
        birthDateDigits: "01012001",
        netIncomeCents: "5000000",
        composeIncome: false,
      },
      insurer: "MAPFRE",
    },
    {
      id: "PF-IPCA-CARENCIA60",
      purpose:
        "IPCA e carência de 60 dias (SIM-INT-03, SIM-DATA-18) com imóvel de R$ 1.200.000 dentro do teto SFH (tipo 567). Usa SAC: a Tabela Price é recusada pelo backend nas jornadas testadas (ver tests/simulator/amortization.spec.ts).",
      journeyId:
        "Financiamento Imobiliário > Pessoa Física > Imóvel Residencial > Imóvel Particular > Índice de Preços ao Consumidor Amplo (IPCA)",
      financial: {
        propertyValueCents: "120000000",
        financingValueCents: "40000000",
        termMonths: 120,
        amortizationSystem: SAC,
        gracePeriodDays: 60,
        birthDateDigits: "01012001",
        netIncomeCents: "5000000",
        composeIncome: false,
      },
      requireGracePeriod: true,
      insurer: "MAPFRE",
      expectedOperationTypeCode: "567",
    },
    {
      id: "PF-IPCA-SEM-CARENCIA",
      purpose:
        "Mesmas condições de PF-IPCA-CARENCIA60, sem carência: no SCCI os valores (Evolução da Simulação) devem sair iguais aos da operação com carência 60 (conferência pedida pelo Castilho).",
      journeyId:
        "Financiamento Imobiliário > Pessoa Física > Imóvel Residencial > Imóvel Particular > Índice de Preços ao Consumidor Amplo (IPCA)",
      financial: {
        propertyValueCents: "120000000",
        financingValueCents: "40000000",
        termMonths: 120,
        amortizationSystem: SAC,
        gracePeriodDays: 0,
        birthDateDigits: "01012001",
        netIncomeCents: "5000000",
        composeIncome: false,
      },
      insurer: "MAPFRE",
      expectedOperationTypeCode: "567",
    },
    {
      id: "PF-PRAZO-35",
      purpose:
        "Prazo de 35 meses (mínimo do tipo no SCCI = 36): conferir se a proposta é aceita no envio e o que o SCCI grava (SIM-DATA-13).",
      journeyId:
        "Financiamento Imobiliário > Pessoa Física > Imóvel Residencial > Imóvel da Esteira Digital > Taxa Referencial (TR)",
      financial: {
        propertyValueCents: "150000000",
        financingValueCents: "50000000",
        termMonths: 120,
        amortizationSystem: SAC,
        gracePeriodDays: 0,
        birthDateDigits: "01012001",
        netIncomeCents: "50000000",
        composeIncome: false,
      },
      customTermMonths: 35,
      investigation:
        "Produto ainda não definiu se o prazo mínimo do tipo (36) deve ser exigido ou vale só o do admin (12): o teste registra se o envio é recusado ou o que o SCCI grava.",
      insurer: "MAPFRE",
      expectedOperationTypeCode: "060",
    },
  ]);
