/**
 * Copie os valores necessarios para connect.ts.
 *
 * connect.ts e local e ignorado pelo Git para evitar publicar links
 * tokenizados, CPFs e outras massas de teste.
 */
export const portalConnect = {
  portalUrl: "",
  accessUrl: "",
  caseAccessUrls: {
    PROP_06: "",
    PROP_07: "",
    PROP_08: "",
    PROP_09: "",
    PROP_10: "",
    PROP_11: "",
    PROP_12: "",
    PROP_17: "",
    PROP_18: "",
    TIMELINE_04: "",
    TIMELINE_05: "",
    TIMELINE_06: "",
    TIMELINE_10: "",
  },
  caseProposalIds: {
    TIMELINE_04_CADASTRO: "",
    TIMELINE_04_DOCUMENTOS: "",
  },
  paths: {
    login: "/login",
    propostas: "/propostas",
  },
  externalSimulationUrl: "https://c6imobiliario.com.br",
  testData: {
    cpfComPropostas: "",
    cpfSemPropostas: "",
    cpfInvalido: "11111111111",
    propostaPadraoId: "",
    propostaExpiradaId: "",
    propostaCanceladaId: "",
    propostaComConjugeId: "",
    propostaComTerceiroId: "",
    propostaGarantidorPfId: "",
    propostaGarantidorPjId: "",
    expectedProposal: {
      visibleNumber: "",
      proponentName: "",
      cpfEnding: "",
      registrationDate: "",
      propertyValue: "",
      financedValue: "",
      term: "",
      currentPhase: "",
      deadline: "",
    },
  },
} as const;
