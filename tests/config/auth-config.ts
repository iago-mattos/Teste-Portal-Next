import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  loadLocalPortalCompatibilityConfig,
  loadPortalRuntimeConfig,
} from "./runtime-config";

export interface PortalAdminAuthConfig {
  url: string;
  username: string;
  password: string;
  cpf: string;
}

export interface PortalAuthConfig {
  portalUrl: string;
  authPath: "/api/auth/me";
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
  const safeEnvironment = /(^|[.-])(dev|desenv|hml|homolog|localhost)([.-]|$)/i.test(
    adminUrl.hostname,
  );

  if (!safeEnvironment || adminUrl.hostname !== portal.hostname) {
    throw new Error(
      `Geracao automatica de acesso bloqueada para o host ${adminUrl.hostname}.`,
    );
  }

  return admin;
}

export function loadPortalAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): PortalAuthConfig {
  const local = loadLocalPortalCompatibilityConfig(env);
  const runtime = loadPortalRuntimeConfig(env);

  const accessUrl = env.PORTAL_ACCESS_URL?.trim() || local?.accessUrl?.trim();
  const testCpf = (
    env.PORTAL_TEST_CPF ?? local?.testData?.cpfComPropostas ?? ""
  ).replace(/\D/g, "");

  return {
    portalUrl: runtime.portalUrl,
    authPath: runtime.paths.authMe,
    proposalsPath: runtime.paths.proposals,
    accessUrl: accessUrl || undefined,
    testCpf,
    admin: loadAdminConfig(env, runtime.portalUrl, testCpf),
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
