import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

export type PortalEnvironment = "dev" | "ht";

export interface LocalPortalCompatibilityConfig {
  portalUrl?: string;
  accessUrl?: string;
  paths?: {
    propostas?: string;
  };
  testData?: {
    cpfComPropostas?: string;
  };
}

export interface PortalRuntimeConfig {
  readonly environment: PortalEnvironment;
  readonly portalUrl: string;
  readonly paths: Readonly<{
    authMe: "/api/auth/me";
    proposals: string;
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

  return Object.freeze({
    environment: resolvePortalEnvironment(env),
    portalUrl,
    paths: Object.freeze({
      authMe: "/api/auth/me" as const,
      proposals: proposalsPath.startsWith("/")
        ? proposalsPath
        : `/${proposalsPath}`,
    }),
    pageErrors: Object.freeze({
      allowReact418Quarantine:
        env.ALLOW_REACT_418_QUARANTINE === "true",
    }),
  });
}
