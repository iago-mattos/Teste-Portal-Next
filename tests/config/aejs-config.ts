import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

export interface AejsRuntimeConfig {
  readonly baseUrl: string;
  readonly username: string;
  readonly password: string;
  readonly path: string;
  readonly usePlatformAccess: boolean;
}

const loadLocalModule = createRequire(resolve("package.json"));

function normalizeUrl(value: string, field: string): string {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${field} precisa conter uma URL valida.`);
  }
}

function parseBoolean(value: string, field: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  throw new Error(`${field} precisa ser true ou false.`);
}

export function loadAejsRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AejsRuntimeConfig {
  let localConfig: {
    aejsConnect?: {
      baseUrl?: string;
      username?: string;
      password?: string;
      path?: string;
      usePlatformAccess?: boolean;
    };
  } = {};

  const localConfigPath = resolve("tests/config/aejs.ts");

  if (existsSync(localConfigPath)) {
    try {
      localConfig = loadLocalModule(localConfigPath);
    } catch {
      // Ignora erro de importacao do modulo local opcional
    }
  }

  const local = localConfig.aejsConnect ?? {};
  const rawBaseUrl = env.AEJS_URL?.trim() || local.baseUrl?.trim() || "";
  const path =
    env.AEJS_PATH !== undefined
      ? env.AEJS_PATH.trim()
      : (local.path?.trim() ?? "");
  const explicitPlatformAccess = env.AEJS_USE_PLATFORM_ACCESS?.trim();
  const configuredPlatformAccess = explicitPlatformAccess
    ? parseBoolean(explicitPlatformAccess, "AEJS_USE_PLATFORM_ACCESS")
    : local.usePlatformAccess;

  return Object.freeze({
    baseUrl: rawBaseUrl ? normalizeUrl(rawBaseUrl, "AEJS_URL") : "",
    username: env.AEJS_USERNAME ?? local.username ?? "",
    password: env.AEJS_PASSWORD ?? local.password ?? "",
    path,
    usePlatformAccess: path ? false : (configuredPlatformAccess ?? true),
  });
}

export function assertAejsRuntimeConfig(config: AejsRuntimeConfig): void {
  if (config.baseUrl && config.username && config.password) return;

  throw new Error(
    "Execucao bloqueada: configure AEJS_URL, AEJS_USERNAME e AEJS_PASSWORD nas variaveis de ambiente para executar os testes de integracao.",
  );
}
