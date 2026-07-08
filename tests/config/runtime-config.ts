import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

export type PortalEnvironment = "dev" | "ht";

export interface LocalPortalCompatibilityConfig {
  portalUrl?: string;
  accessUrl?: string;
  paths?: {
    login?: string;
    propostas?: string;
  };
  testData?: {
    cpfComPropostas?: string;
    cpfInvalido?: string;
    expectedProposal?: {
      visibleNumber?: string;
    };
  };
}

export interface PortalRuntimeConfig {
  readonly environment: PortalEnvironment;
  readonly portalUrl: string;
  readonly paths: Readonly<{
    authMe: "/api/auth/me";
    login: string;
    proposals: string;
  }>;
  readonly testData: Readonly<{
    invalidCpf: string;
    expectedProposal: Readonly<{
      visibleNumber: string;
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

function resolveExpectedProposalNumber(
  env: NodeJS.ProcessEnv,
  local: LocalPortalCompatibilityConfig | undefined,
): string {
  const rawExpectedProposal = env.PORTAL_EXPECTED_PROPOSAL_JSON?.trim();
  if (!rawExpectedProposal) {
    return local?.testData?.expectedProposal?.visibleNumber?.trim() ?? "";
  }

  try {
    const parsed = JSON.parse(rawExpectedProposal) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("o valor precisa ser um objeto JSON");
    }

    const visibleNumber = (parsed as { visibleNumber?: unknown }).visibleNumber;
    if (visibleNumber !== undefined && typeof visibleNumber !== "string") {
      throw new Error("visibleNumber precisa ser texto");
    }

    return visibleNumber?.trim() ?? "";
  } catch (error) {
    throw new Error("PORTAL_EXPECTED_PROPOSAL_JSON possui JSON invalido.", {
      cause: error,
    });
  }
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
    paths: Object.freeze({
      authMe: "/api/auth/me" as const,
      login: loginPath.startsWith("/") ? loginPath : `/${loginPath}`,
      proposals: proposalsPath.startsWith("/")
        ? proposalsPath
        : `/${proposalsPath}`,
    }),
    testData: Object.freeze({
      invalidCpf: resolveInvalidCpf(env, local),
      expectedProposal: Object.freeze({
        visibleNumber: resolveExpectedProposalNumber(env, local),
      }),
    }),
    pageErrors: Object.freeze({
      allowReact418Quarantine:
        env.ALLOW_REACT_418_QUARANTINE === "true",
    }),
  });
}
