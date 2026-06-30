export const integrationData = {
  scenarios: {
    "INT-CONFIRM-PJ": {
      proposalId: "000436021",
      visibleNumber: "436021",
      profile: "spouse-pj",
      description: "CENARIO PJ CONJUGE E DOIS SOCIOS",
    },
    "INT-CONFIRM-PF": {
      proposalId: "000436020",
      visibleNumber: "436020",
      profile: "third-party-pf",
      description: "CENARIO PF COM TERCEIRO NA RENDA",
    },
    "INT-CONFIRM-QUITADO": {
      proposalId: "000436019",
      visibleNumber: "436019",
      profile: "single-quitado",
      description: "CENARIO SEM COMPOSICAO IMOVEL QUITADO",
    },
    "INT-CONFIRM-WORKFLOW": {
      proposalId: "000436018",
      visibleNumber: "436018",
      profile: "workflow",
      description: "CENARIO FLUXO DOCUMENTOS E CANCELAMENTO",
    },
  },
  titular: {
    renda: "1234567",
    estadoCivil: "2",
    nacionalidade: "Brasileira",
    ufNaturalidade: "RJ",
    ufIdentidade: "RJ",
    profissao: "ADMINISTRADOR",
    tipoProfissao: "ASSALARIADO",
    resideNoImovel: "T",
  },
  conjuge: {
    nome: "CONJUGE CYPRESS INTEGRACAO",
    cpf: "63976666033",
    dataNascimento: "01012001",
    nacionalidade: "Brasileira",
    ufNaturalidade: "RJ",
    ufIdentidade: "RJ",
    dataComunhao: "01012025",
    regimeComunhao: "Comunhão Universal de Bens",
    ddd: "21",
    celular: "998071033",
    email: "conjuge.integracao@teste.com",
    renda: "1400000",
    profissao: "ADMINISTRADOR",
    tipoProfissao: "ASSALARIADO",
  },
  terceiro: {
    nome: "TERCEIRO CYPRESS INTEGRACAO",
    cpf: "39053344705",
    dataNascimento: "03031993",
    renda: "900000",
    profissao: "ADMINISTRADOR",
    tipoProfissao: "ASSALARIADO",
    ddd: "31",
    celular: "998765432",
    email: "terceiro.integracao@teste.com",
  },
  motivo: {
    finalidade: "Investir",
    descricao:
      "Pretendo organizar minhas finanças familiares e investir em melhorias importantes para nossa residência",
  },
  imovel: {
    uso: "Casa",
    tipo: "Residencial",
    condicao: "6",
    saldoDevedor: "25000000",
    interveniente: "Banco C6 S.A.",
  },
  empresa: {
    razaoSocial: "EMPRESA CYPRESS INTEGRACAO LTDA",
    cnpj: "11222333000181",
    dataFundacao: "01012010",
    telefone: "987654321",
    email: "empresa.integracao@teste.com",
    cep: "01001000",
    endereco: "Praça da Sé",
    numero: "100",
    complemento: "SALA 10",
    bairro: "Sé",
    uf: "SP",
    municipio: "SÃO PAULO",
  },
  garantidorPf: {
    nome: "GARANTIDOR PF CYPRESS",
    cpf: "93541134780",
    estadoCivil: "1",
    dataNascimento: "04041985",
    ddd: "11",
    celular: "987654321",
    email: "garantidor.pf@teste.com",
    cep: "01001000",
    endereco: "Praca da Se",
    numero: "200",
    complemento: "CASA 2",
    bairro: "Se",
    uf: "SP",
    municipio: "SÃO PAULO",
  },
  socios: [
    {
      nome: "SOCIO CYPRESS UM",
      cpf: "52998224725",
      dataNascimento: "01011990",
      ddd: "11",
      celular: "987654321",
      email: "socio.um@teste.com",
    },
    {
      nome: "SOCIO CYPRESS DOIS",
      cpf: "11144477735",
      dataNascimento: "02021992",
      ddd: "21",
      celular: "998765432",
      email: "socio.dois@teste.com",
    },
  ],
  cancelamento: {
    justificativa:
      "Cancelamento controlado para validacao automatizada das integracoes em desenvolvimento",
  },
} as const;

export type IntegrationCaseId = keyof typeof integrationData.scenarios;
export type IntegrationProfile =
  (typeof integrationData.scenarios)[IntegrationCaseId]["profile"];

export interface ResolvedIntegrationScenario {
  caseId: IntegrationCaseId;
  proposalId: string;
  visibleNumber: string;
  profile: IntegrationProfile;
  description: string;
}

export interface IntegrationRunContext extends ResolvedIntegrationScenario {
  environment: string;
  preparedAt: string;
}

export function resolveIntegrationScenario(
  caseId: IntegrationCaseId,
  operationOverride?: string,
): ResolvedIntegrationScenario {
  const configured = integrationData.scenarios[caseId];
  const operation = String(
    operationOverride?.trim() || configured.proposalId,
  ).replace(/\D/g, "");

  if (!operation) {
    throw new Error(`Operacao nao informada para ${caseId}.`);
  }

  const proposalId = operation.padStart(9, "0");
  return {
    caseId,
    proposalId,
    visibleNumber: proposalId.replace(/^0+/, ""),
    profile: configured.profile,
    description: configured.description,
  };
}
