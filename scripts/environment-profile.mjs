import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const profilePattern = /^[a-z0-9][a-z0-9_-]*$/;
const allowedMassKeyPatterns = [
  /^PORTAL_TEST_CPF$/,
  /^PORTAL_PROPOSAL_/,
  /^PORTAL_INTEGRATION_/,
  /^PORTAL_CORE_(?:[A-Z0-9_]+_OPERATION|[A-Z0-9_]+_EXPECTED_NAME)$/,
  /^PORTAL_EXPECTED_/,
  /^PORTAL_MASS_/,
];

function configuredKeys(filePath) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1])
    .filter(Boolean);
}

function loadMassesOverlay(filePath, initialEnvironmentKeys) {
  const values = parseEnv(readFileSync(filePath, "utf8"));
  const unexpectedKeys = Object.keys(values).filter(
    (key) => !allowedMassKeyPatterns.some((pattern) => pattern.test(key)),
  );
  if (unexpectedKeys.length > 0) {
    throw new Error(
      `${filePath} deve conter somente massas e expectativas do Portal. Remova ${unexpectedKeys.join(", ")}.`,
    );
  }

  for (const [key, value] of Object.entries(values)) {
    if (!initialEnvironmentKeys.has(key)) process.env[key] = value;
  }
}

export function loadEnvironmentProfile({ required = true } = {}) {
  const initialEnvironmentKeys = new Set(Object.keys(process.env));
  const selectorPath = resolve(".env.local");
  if (existsSync(selectorPath)) {
    const unexpectedKeys = configuredKeys(selectorPath).filter(
      (key) => key !== "PW_PROFILE",
    );
    if (unexpectedKeys.length > 0) {
      throw new Error(
        `.env.local deve conter somente PW_PROFILE. Mova ${unexpectedKeys.join(", ")} para o perfil.`,
      );
    }
    process.loadEnvFile(selectorPath);
  }

  const profile = process.env.PW_PROFILE?.trim().toLowerCase();
  if (!profile) {
    if (!required) return undefined;
    throw new Error(
      "Defina PW_PROFILE com um perfil valido, por exemplo desenv, ht ou esteira.",
    );
  }
  if (!profilePattern.test(profile)) {
    throw new Error(
      "PW_PROFILE deve conter apenas letras minusculas, numeros, _ ou -.",
    );
  }

  const profilePath = resolve(`.env.${profile}.local`);
  if (existsSync(profilePath)) {
    process.loadEnvFile(profilePath);
    const massesPath = resolve(`.env.${profile}.masses.local`);
    if (existsSync(massesPath)) {
      loadMassesOverlay(massesPath, initialEnvironmentKeys);
      return Object.freeze({
        name: profile,
        source: profilePath,
        massesSource: massesPath,
      });
    }

    return Object.freeze({ name: profile, source: profilePath });
  }
  if (process.env.CI) {
    return Object.freeze({ name: profile, source: "process.env" });
  }

  throw new Error(
    `Perfil ${profile} nao encontrado. Crie .env.${profile}.local a partir de .env.example.`,
  );
}
