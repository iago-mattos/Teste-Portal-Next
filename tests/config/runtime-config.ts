import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

export type PortalEnvironment = "dev" | "ht";

export interface LocalPortalCompatibilityConfig {
  portalUrl?: string;
  accessUrl?: string;
  externalSimulationUrl?: string;
  caseProposalIds?: Record<string, string>;
  paths?: {
    login?: string;
    propostas?: string;
  };
  testData?: {
    cpfComPropostas?: string;
    cpfInvalido?: string;
    propostaExpiradaId?: string;
    propostaExpiradaMais30DiasId?: string;
    propostaCanceladaId?: string;
    expectedProposal?: {
      visibleNumber?: string;
      proponentName?: string;
      cpfEnding?: string;
      registrationDate?: string;
      propertyValue?: string;
      financedValue?: string;
      term?: string;
      currentPhase?: string;
      interestType?: string;
    };
  };
}

export interface PortalRuntimeConfig {
  readonly environment: PortalEnvironment;
  readonly portalUrl: string;
  readonly externalSimulationUrl: string;
  readonly caseProposalIds: Readonly<Record<string, string>>;
  readonly paths: Readonly<{
    authMe: "/api/auth/me";
    login: string;
    proposals: string;
  }>;
  readonly testData: Readonly<{
    invalidCpf: string;
    operationCpfs: Readonly<Record<string, string>>;
    propostaExpiradaId: string;
    propostaExpiradaMais30DiasId: string;
    propostaCanceladaId: string;
    propostaCreditoReprovadoId: string;
    propostaCreditoAprovadoId: string;
    corePersistenceOperation: string;
    coreDocumentOperation: string;
    coreDocumentMaxSizeBytes: number;
    expectedProposal: Readonly<{
      visibleNumber: string;
      proponentName: string;
      cpfEnding: string;
      registrationDate: string;
      propertyValue: string;
      financedValue: string;
      term: string;
      currentPhase: string;
      interestType: string;
    }>;
  }>;
  readonly pageErrors: Readonly<{
    allowReact418Quarantine: boolean;
  }>;
}

const loadLocalModule = createRequire(resolve("package.json"));

export function resolvePortalEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): PortalEnvironment {
  return env.PORTAL_ENV?.trim().toLowerCase() === "ht" ? "ht" : "dev";
}

export function loadLocalPortalCompatibilityConfig(
  env: NodeJS.ProcessEnv = process.env,
): LocalPortalCompatibilityConfig | undefined {
  const environment = resolvePortalEnvironment(env);
  const configPath = resolve(
    environment === "ht"
      ? "cypress/config/connect.ht.ts"
      : "cypress/config/connect.ts",
  );

  if (!existsSync(configPath)) return undefined;

  const localModule = loadLocalModule(configPath) as {
    portalConnect?: LocalPortalCompatibilityConfig;
  };
  return localModule.portalConnect;
}

function normalizeUrl(value: string, field: string): string {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${field} precisa conter uma URL valida.`);
  }
}

function resolveExpectedProposal(
  env: NodeJS.ProcessEnv,
  local: LocalPortalCompatibilityConfig | undefined,
): Readonly<{
  visibleNumber: string;
  proponentName: string;
  cpfEnding: string;
  registrationDate: string;
  propertyValue: string;
  financedValue: string;
  term: string;
  currentPhase: string;
  interestType: string;
}> {
  const rawExpectedProposal = env.PORTAL_EXPECTED_PROPOSAL_JSON?.trim();
  let parsed: Record<string, unknown> = {};

  if (rawExpectedProposal) {
    try {
      const parsedJson = JSON.parse(rawExpectedProposal) as unknown;
      if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
        parsed = parsedJson as Record<string, unknown>;
      } else {
        throw new Error("o valor precisa ser um objeto JSON");
      }
    } catch (error) {
      throw new Error("PORTAL_EXPECTED_PROPOSAL_JSON possui JSON invalido.", {
        cause: error,
      });
    }
  }

  const localExpected = local?.testData?.expectedProposal ?? {};

  const getString = (
    key: string,
    envKey: string,
    fallback: string | undefined,
  ): string => {
    const explicitValue = env[envKey]?.trim();
    const val = explicitValue || (parsed[key] !== undefined ? parsed[key] : fallback);
    return val !== undefined ? String(val).trim() : "";
  };

  return Object.freeze({
    visibleNumber: getString(
      "visibleNumber",
      "PORTAL_PROPOSAL_DEFAULT",
      localExpected.visibleNumber,
    ),
    proponentName: getString(
      "proponentName",
      "PORTAL_EXPECTED_PROPONENT_NAME",
      localExpected.proponentName,
    ),
    cpfEnding: getString(
      "cpfEnding",
      "PORTAL_EXPECTED_CPF_ENDING",
      localExpected.cpfEnding,
    ),
    registrationDate: getString(
      "registrationDate",
      "PORTAL_EXPECTED_REGISTRATION_DATE",
      localExpected.registrationDate,
    ),
    propertyValue: getString(
      "propertyValue",
      "PORTAL_EXPECTED_PROPERTY_VALUE",
      localExpected.propertyValue,
    ),
    financedValue: getString(
      "financedValue",
      "PORTAL_EXPECTED_FINANCED_VALUE",
      localExpected.financedValue,
    ),
    term: getString("term", "PORTAL_EXPECTED_TERM", localExpected.term),
    currentPhase: getString(
      "currentPhase",
      "PORTAL_EXPECTED_CURRENT_PHASE",
      localExpected.currentPhase,
    ),
    interestType: getString(
      "interestType",
      "PORTAL_EXPECTED_INTEREST_TYPE",
      localExpected.interestType,
    ),
  });
}

function resolveCaseProposalIds(
  env: NodeJS.ProcessEnv,
  local: LocalPortalCompatibilityConfig | undefined,
): Readonly<Record<string, string>> {
  let parsedRecord: Record<string, string> = {};
  const rawRecord = env.PORTAL_CASE_PROPOSAL_IDS_JSON?.trim();
  if (rawRecord) {
    try {
      const parsed = JSON.parse(rawRecord) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parsedRecord = Object.fromEntries(
          Object.entries(parsed).map(([key, entry]) => [key, String(entry)]),
        );
      } else {
        throw new Error("o valor precisa ser um objeto JSON");
      }
    } catch (error) {
      throw new Error("PORTAL_CASE_PROPOSAL_IDS_JSON possui JSON invalido.", {
        cause: error,
      });
    }
  }

  const configured = {
    ...(local?.caseProposalIds ?? {}),
    ...parsedRecord,
  };
  const timelineCadastro = env.PORTAL_PROPOSAL_TIMELINE_CADASTRO?.trim();
  const timelineDocuments = env.PORTAL_PROPOSAL_TIMELINE_DOCUMENTS?.trim();
  if (timelineCadastro) configured.TIMELINE_04_CADASTRO = timelineCadastro;
  if (timelineDocuments) configured.TIMELINE_04_DOCUMENTOS = timelineDocuments;

  return Object.freeze(configured);
}

function resolveExternalSimulationUrl(
  env: NodeJS.ProcessEnv,
  local: LocalPortalCompatibilityConfig | undefined,
): string {
  return (
    env.PORTAL_EXTERNAL_SIMULATION_URL?.trim() ||
    local?.externalSimulationUrl?.trim() ||
    "https://c6imobiliario.com.br"
  );
}

function resolveInvalidCpf(
  env: NodeJS.ProcessEnv,
  local: LocalPortalCompatibilityConfig | undefined,
): string {
  const rawTestData = env.PORTAL_TEST_DATA_JSON?.trim();
  if (!rawTestData) {
    return local?.testData?.cpfInvalido?.replace(/\D/g, "") || "11111111111";
  }

  try {
    const parsed = JSON.parse(rawTestData) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("o valor precisa ser um objeto JSON");
    }

    const invalidCpf = (parsed as { cpfInvalido?: unknown }).cpfInvalido;
    if (invalidCpf !== undefined && typeof invalidCpf !== "string") {
      throw new Error("cpfInvalido precisa ser texto");
    }

    return invalidCpf?.replace(/\D/g, "") || "11111111111";
  } catch (error) {
    throw new Error("PORTAL_TEST_DATA_JSON possui JSON invalido.", {
      cause: error,
    });
  }
}

function resolvePropostaExpiradaId(
  env: NodeJS.ProcessEnv,
  local: LocalPortalCompatibilityConfig | undefined,
): string {
  const explicitValue = env.PORTAL_PROPOSAL_EXPIRED?.trim();
  if (explicitValue) return explicitValue;

  const rawTestData = env.PORTAL_TEST_DATA_JSON?.trim();
  if (!rawTestData) {
    return local?.testData?.propostaExpiradaId?.trim() || "";
  }

  try {
    const parsed = JSON.parse(rawTestData) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("o valor precisa ser um objeto JSON");
    }

    const propostaExpiradaId = (parsed as { propostaExpiradaId?: unknown }).propostaExpiradaId;
    if (propostaExpiradaId !== undefined && typeof propostaExpiradaId !== "string") {
      throw new Error("propostaExpiradaId precisa ser texto");
    }

    return propostaExpiradaId?.trim() || "";
  } catch (error) {
    throw new Error("PORTAL_TEST_DATA_JSON possui JSON invalido.", {
      cause: error,
    });
  }
}

function resolvePropostaExpiradaMais30DiasId(
  env: NodeJS.ProcessEnv,
  local: LocalPortalCompatibilityConfig | undefined,
): string {
  const explicitValue = env.PORTAL_PROPOSAL_EXPIRED_OVER_30_DAYS?.trim();
  if (explicitValue) return explicitValue;

  const rawTestData = env.PORTAL_TEST_DATA_JSON?.trim();
  if (!rawTestData) {
    return local?.testData?.propostaExpiradaMais30DiasId?.trim() || "";
  }

  try {
    const parsed = JSON.parse(rawTestData) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("o valor precisa ser um objeto JSON");
    }

    const propostaExpiradaMais30DiasId = (
      parsed as { propostaExpiradaMais30DiasId?: unknown }
    ).propostaExpiradaMais30DiasId;
    if (
      propostaExpiradaMais30DiasId !== undefined &&
      typeof propostaExpiradaMais30DiasId !== "string"
    ) {
      throw new Error("propostaExpiradaMais30DiasId precisa ser texto");
    }

    return propostaExpiradaMais30DiasId?.trim() || "";
  } catch (error) {
    throw new Error("PORTAL_TEST_DATA_JSON possui JSON invalido.", {
      cause: error,
    });
  }
}

function resolveConfiguredProposalId(
  env: NodeJS.ProcessEnv,
  envKey: string,
  fallback = "",
): string {
  return env[envKey]?.trim() || fallback.trim();
}

function resolveOptionalPositiveInteger(
  env: NodeJS.ProcessEnv,
  envKey: string,
): number {
  const raw = env[envKey]?.trim();
  if (!raw) return 0;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${envKey} precisa ser um inteiro positivo.`);
  }
  return value;
}

function resolveOperationCpfs(
  env: NodeJS.ProcessEnv,
): Readonly<Record<string, string>> {
  const raw = env.PORTAL_MASS_OPERATION_CPFS_JSON?.trim();
  if (!raw) return Object.freeze({});

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("o valor precisa ser um objeto JSON");
    }

    const entries = Object.entries(parsed).map(([operation, cpf]) => {
      const normalizedOperation = operation.replace(/\D/g, "");
      const normalizedCpf = String(cpf).replace(/\D/g, "");
      if (!normalizedOperation || normalizedCpf.length !== 11) {
        throw new Error(
          `mapeamento invalido para a operacao ${operation}`,
        );
      }
      return [normalizedOperation, normalizedCpf] as const;
    });

    return Object.freeze(Object.fromEntries(entries));
  } catch (error) {
    throw new Error("PORTAL_MASS_OPERATION_CPFS_JSON possui JSON invalido.", {
      cause: error,
    });
  }
}

export function resolvePortalBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const local = loadLocalPortalCompatibilityConfig(env);
  const value = env.PORTAL_URL?.trim() || local?.portalUrl?.trim();

  return value ? normalizeUrl(value, "PORTAL_URL") : undefined;
}

export function loadPortalRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): PortalRuntimeConfig {
  const local = loadLocalPortalCompatibilityConfig(env);
  const portalUrl = resolvePortalBaseUrl(env);

  if (!portalUrl) {
    throw new Error(
      "Configure PORTAL_URL ou o arquivo local de compatibilidade antes de executar o Portal.",
    );
  }

  const proposalsPath = local?.paths?.propostas?.trim() || "/propostas";
  const loginPath = local?.paths?.login?.trim() || "/login";

  return Object.freeze({
    environment: resolvePortalEnvironment(env),
    portalUrl,
    externalSimulationUrl: resolveExternalSimulationUrl(env, local),
    caseProposalIds: resolveCaseProposalIds(env, local),
    paths: Object.freeze({
      authMe: "/api/auth/me" as const,
      login: loginPath.startsWith("/") ? loginPath : `/${loginPath}`,
      proposals: proposalsPath.startsWith("/")
        ? proposalsPath
        : `/${proposalsPath}`,
    }),
    testData: Object.freeze({
      invalidCpf: resolveInvalidCpf(env, local),
      operationCpfs: resolveOperationCpfs(env),
      propostaExpiradaId: resolvePropostaExpiradaId(env, local),
      propostaExpiradaMais30DiasId: resolvePropostaExpiradaMais30DiasId(
        env,
        local,
      ),
      propostaCanceladaId: resolveConfiguredProposalId(
        env,
        "PORTAL_PROPOSAL_CANCELED",
        local?.testData?.propostaCanceladaId,
      ),
      propostaCreditoReprovadoId: resolveConfiguredProposalId(
        env,
        "PORTAL_PROPOSAL_CREDIT_REJECTED",
      ),
      propostaCreditoAprovadoId: resolveConfiguredProposalId(
        env,
        "PORTAL_PROPOSAL_CREDIT_APPROVED",
      ),
      corePersistenceOperation: resolveConfiguredProposalId(
        env,
        "PORTAL_CORE_PERSISTENCE_OPERATION",
      ),
      coreDocumentOperation: resolveConfiguredProposalId(
        env,
        "PORTAL_CORE_DOCUMENT_OPERATION",
      ),
      coreDocumentMaxSizeBytes: resolveOptionalPositiveInteger(
        env,
        "PORTAL_CORE_DOCUMENT_MAX_SIZE_BYTES",
      ),
      expectedProposal: resolveExpectedProposal(env, local),
    }),
    pageErrors: Object.freeze({
      allowReact418Quarantine:
        env.ALLOW_REACT_418_QUARANTINE === "true",
    }),
  });
}
