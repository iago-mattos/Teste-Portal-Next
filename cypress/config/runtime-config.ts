export type PortalEnvironment = "dev" | "ht";

export interface PortalConnect {
  portalUrl: string;
  accessUrl: string;
  caseAccessUrls: Record<string, string>;
  caseProposalIds: Record<string, string>;
  paths: {
    login: string;
    propostas: string;
  };
  externalSimulationUrl: string;
  testData: {
    cpfComPropostas: string;
    cpfSemPropostas: string;
    cpfInvalido: string;
    propostaPadraoId: string;
    propostaExpiradaId: string;
    propostaCanceladaId: string;
    propostaComConjugeId: string;
    propostaComTerceiroId: string;
    propostaGarantidorPfId: string;
    propostaGarantidorPjId: string;
    expectedProposal: {
      visibleNumber: string;
      proponentName: string;
      cpfEnding: string;
      registrationDate: string;
      propertyValue: string;
      financedValue: string;
      term: string;
      currentPhase: string;
      deadline: string;
    };
  };
}

export interface AejsConnect {
  baseUrl: string;
  username: string;
  password: string;
  path: string;
}

const emptyPortalConnect: PortalConnect = {
  portalUrl: "",
  accessUrl: "",
  caseAccessUrls: {},
  caseProposalIds: {},
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
};

function parseRecord(value: string | undefined, name: string): Record<string, string> {
  if (!value?.trim()) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("o valor precisa ser um objeto JSON");
    }
    return Object.fromEntries(
      Object.entries(parsed).map(([key, entry]) => [key, String(entry)]),
    );
  } catch (error) {
    throw new Error(`${name} possui JSON invalido.`, { cause: error });
  }
}

export function resolvePortalEnvironment(
  env: NodeJS.ProcessEnv,
): PortalEnvironment {
  return env.PORTAL_ENV?.trim().toLowerCase() === "ht" ? "ht" : "dev";
}

export function loadPortalConnect(
  env: NodeJS.ProcessEnv,
  localConfig?: Partial<PortalConnect>,
): PortalConnect {
  const local = localConfig ?? {};
  const localTestData = local.testData ?? emptyPortalConnect.testData;

  return {
    ...emptyPortalConnect,
    ...local,
    portalUrl: env.PORTAL_URL?.trim() || local.portalUrl || "",
    accessUrl: env.PORTAL_ACCESS_URL?.trim() || local.accessUrl || "",
    externalSimulationUrl:
      env.PORTAL_EXTERNAL_SIMULATION_URL?.trim() ||
      local.externalSimulationUrl ||
      emptyPortalConnect.externalSimulationUrl,
    caseAccessUrls: {
      ...emptyPortalConnect.caseAccessUrls,
      ...local.caseAccessUrls,
      ...parseRecord(env.PORTAL_CASE_ACCESS_URLS_JSON, "PORTAL_CASE_ACCESS_URLS_JSON"),
    },
    caseProposalIds: {
      ...emptyPortalConnect.caseProposalIds,
      ...local.caseProposalIds,
      ...parseRecord(env.PORTAL_CASE_PROPOSAL_IDS_JSON, "PORTAL_CASE_PROPOSAL_IDS_JSON"),
    },
    paths: {
      ...emptyPortalConnect.paths,
      ...local.paths,
    },
    testData: {
      ...emptyPortalConnect.testData,
      ...localTestData,
      ...parseRecord(env.PORTAL_TEST_DATA_JSON, "PORTAL_TEST_DATA_JSON"),
      expectedProposal: {
        ...emptyPortalConnect.testData.expectedProposal,
        ...localTestData.expectedProposal,
        ...parseRecord(
          env.PORTAL_EXPECTED_PROPOSAL_JSON,
          "PORTAL_EXPECTED_PROPOSAL_JSON",
        ),
      },
    },
  };
}

export function loadAejsConnect(
  env: NodeJS.ProcessEnv,
  localConfig?: Partial<AejsConnect>,
): AejsConnect {
  return {
    baseUrl: env.AEJS_URL?.trim() || localConfig?.baseUrl || "",
    username: env.AEJS_USERNAME ?? localConfig?.username ?? "",
    password: env.AEJS_PASSWORD ?? localConfig?.password ?? "",
    path: env.AEJS_PATH ?? localConfig?.path ?? "",
  };
}
