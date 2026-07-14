import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const profilePattern = /^[a-z0-9][a-z0-9_-]*$/;

function configuredKeys(filePath) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1])
    .filter(Boolean);
}

export function loadEnvironmentProfile({ required = true } = {}) {
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
    return Object.freeze({ name: profile, source: profilePath });
  }
  if (process.env.CI) {
    return Object.freeze({ name: profile, source: "process.env" });
  }

  throw new Error(
    `Perfil ${profile} nao encontrado. Crie .env.${profile}.local a partir de .env.example.`,
  );
}
