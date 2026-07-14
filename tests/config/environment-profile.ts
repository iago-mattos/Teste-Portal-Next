import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface LoadedEnvironmentProfile {
  readonly name: string;
  readonly source: string;
}

const selectorFileName = ".env.local";
const profileNamePattern = /^[a-z0-9][a-z0-9_-]*$/;

function getConfiguredKeys(filePath: string): string[] {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1])
    .filter((key): key is string => Boolean(key));
}

function validateSelectorFile(filePath: string): void {
  const unexpectedKeys = getConfiguredKeys(filePath).filter(
    (key) => key !== "PW_PROFILE",
  );
  if (unexpectedKeys.length === 0) return;

  throw new Error(
    `${selectorFileName} deve conter somente PW_PROFILE. Mova ${unexpectedKeys.join(", ")} para o perfil selecionado.`,
  );
}

export function loadEnvironmentProfile(
  cwd: string = process.cwd(),
): LoadedEnvironmentProfile | undefined {
  const selectorPath = resolve(cwd, selectorFileName);
  if (existsSync(selectorPath)) {
    validateSelectorFile(selectorPath);
    process.loadEnvFile(selectorPath);
  }

  const profileName = process.env.PW_PROFILE?.trim().toLowerCase();
  if (!profileName) return undefined;
  if (!profileNamePattern.test(profileName)) {
    throw new Error(
      "PW_PROFILE deve conter apenas letras minusculas, numeros, _ ou -.",
    );
  }

  const profilePath = resolve(cwd, `.env.${profileName}.local`);
  if (existsSync(profilePath)) {
    process.loadEnvFile(profilePath);
    return Object.freeze({ name: profileName, source: profilePath });
  }

  if (process.env.CI) {
    return Object.freeze({ name: profileName, source: "process.env" });
  }

  throw new Error(
    `Perfil ${profileName} nao encontrado. Crie .env.${profileName}.local a partir de .env.example.`,
  );
}
