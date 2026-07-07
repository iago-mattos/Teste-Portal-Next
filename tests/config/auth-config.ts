import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

interface LocalPortalConfig {
  portalUrl?: string;
  accessUrl?: string;
  paths?: {
    propostas?: string;
  };
  testData?: {
    cpfComPropostas?: string;
  };
}

export interface PortalAdminAuthConfig {
  url: string;
  username: string;
  password: string;
  cpf: string;
}

export interface PortalAuthConfig {
  portalUrl: string;
  proposalsPath: string;
  accessUrl?: string;
  testCpf: string;
  admin?: PortalAdminAuthConfig;
}

export const PORTAL_AUTH_STATE_PATH = resolve(
  "playwright",
  ".auth",
  "portal.json",
);
export const PORTAL_AUTH_METADATA_PATH = resolve(
  "playwright",
  ".auth",
  "portal.meta.json",
);

const loadLocalModule = createRequire(resolve("package.json"));

function loadLocalPortalConfig(
  env: NodeJS.ProcessEnv,
): LocalPortalConfig | undefined {
  const environment = env.PORTAL_ENV?.trim().toLowerCase() === "ht" ? "ht" : "dev";
  const configPath = resolve(
    environment === "ht"
      ? "cypress/config/connect.ht.ts"
      : "cypress/config/connect.ts",
  );

  if (!existsSync(configPath)) return undefined;

  const localModule = loadLocalModule(configPath) as {
    portalConnect?: LocalPortalConfig;
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

function loadAdminConfig(
  env: NodeJS.ProcessEnv,
  portalUrl: string,
  fallbackCpf: string,
): PortalAdminAuthConfig | undefined {
  const admin = {
    url: env.PORTAL_ADMIN_URL?.trim() ?? "",
    username: env.PORTAL_ADMIN_USER ?? "",
    password: env.PORTAL_ADMIN_PASSWORD ?? "",
    cpf: (env.PORTAL_TEST_CPF ?? fallbackCpf).replace(/\D/g, ""),
  };
  const configuredValues = [admin.url, admin.username, admin.password].filter(
    Boolean,
  ).length;

  if (configuredValues === 0) return undefined;
  if (configuredValues !== 3 || !admin.cpf) {
    throw new Error(
      "Preencha PORTAL_ADMIN_URL, PORTAL_ADMIN_USER, PORTAL_ADMIN_PASSWORD e PORTAL_TEST_CPF para gerar o acesso do Portal.",
    );
  }

  admin.url = normalizeUrl(admin.url, "PORTAL_ADMIN_URL");
  const adminUrl = new URL(admin.url);
  const portal = new URL(portalUrl);
  const safeEnvironment = /(^|[.-])(dev|hml|homolog|localhost)([.-]|$)/i.test(
    adminUrl.hostname,
  );

  if (!safeEnvironment || adminUrl.hostname !== portal.hostname) {
    throw new Error(
      `Geracao automatica de acesso bloqueada para o host ${adminUrl.hostname}.`,
    );
  }

  return admin;
}

export function resolvePortalBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const local = loadLocalPortalConfig(env);
  const value = env.PORTAL_URL?.trim() || local?.portalUrl?.trim();

  return value ? normalizeUrl(value, "PORTAL_URL") : undefined;
}

export function loadPortalAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): PortalAuthConfig {
  const local = loadLocalPortalConfig(env);
  const portalUrl = resolvePortalBaseUrl(env);

  if (!portalUrl) {
    throw new Error(
      "Configure PORTAL_URL ou o arquivo local de compatibilidade antes de autenticar no Portal.",
    );
  }

  const accessUrl = env.PORTAL_ACCESS_URL?.trim() || local?.accessUrl?.trim();
  const testCpf = (
    env.PORTAL_TEST_CPF ?? local?.testData?.cpfComPropostas ?? ""
  ).replace(/\D/g, "");
  const proposalsPath = local?.paths?.propostas?.trim() || "/propostas";

  return {
    portalUrl,
    proposalsPath: proposalsPath.startsWith("/")
      ? proposalsPath
      : `/${proposalsPath}`,
    accessUrl: accessUrl || undefined,
    testCpf,
    admin: loadAdminConfig(env, portalUrl, testCpf),
  };
}

export function portalAuthFingerprint(config: PortalAuthConfig): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        portalOrigin: new URL(config.portalUrl).origin,
        proposalsPath: config.proposalsPath,
        testCpf: config.testCpf,
      }),
    )
    .digest("hex");
}
