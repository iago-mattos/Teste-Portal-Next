import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

export interface AejsRuntimeConfig {
  readonly baseUrl: string;
  readonly username: string;
  readonly password: string;
  readonly path: string;
}

export const AEJS_AUTH_STATE_PATH = resolve("playwright", ".auth", "aejs.json");
export const AEJS_AUTH_METADATA_PATH = resolve("playwright", ".auth", "aejs.meta.json");

const loadLocalModule = createRequire(resolve("package.json"));

function normalizeUrl(value: string, field: string): string {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${field} precisa conter uma URL valida.`);
  }
}

export function loadAejsRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AejsRuntimeConfig {
  let localConfig: {
    aejsConnect?: {
      baseUrl?: string;
      username?: string;
      password?: string;
      path?: string;
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

  return Object.freeze({
    baseUrl: rawBaseUrl ? normalizeUrl(rawBaseUrl, "AEJS_URL") : "",
    username: env.AEJS_USERNAME ?? local.username ?? "",
    password: env.AEJS_PASSWORD ?? local.password ?? "",
    path: env.AEJS_PATH ?? local.path ?? "",
  });
}

export function aejsAuthFingerprint(config: AejsRuntimeConfig): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        baseUrl: config.baseUrl,
        username: config.username,
        path: config.path,
      }),
    )
    .digest("hex");
}
