import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const specsDirectory = new URL("../cypress/e2e/cliente/", import.meta.url);
const playwrightDirectory = fileURLToPath(
  new URL("../tests/functional/", import.meta.url),
);
const pending = JSON.parse(
  readFileSync(new URL("../cypress/config/known-pending.json", import.meta.url)),
);
const ids = new Map();
const implementations = new Map();
const migratedImplementations = new Map();

function listFiles(directory, suffix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? listFiles(path, suffix)
      : entry.name.endsWith(suffix)
        ? [path]
        : [];
  });
}

for (const file of readdirSync(specsDirectory).filter((name) => name.endsWith(".cy.ts"))) {
  const source = readFileSync(join(specsDirectory.pathname, file), "utf8");
  for (const match of source.matchAll(/\bid:\s*"([A-Z0-9_-]+)"/g)) {
    if (ids.has(match[1])) throw new Error(`Caso duplicado: ${match[1]}`);
    ids.set(match[1], file);
  }
  for (const match of source.matchAll(/^\s*"([A-Z0-9_-]+)":\s*\(\)\s*=>/gm)) {
    if (implementations.has(match[1])) {
      throw new Error(`Implementacao duplicada: ${match[1]}`);
    }
    implementations.set(match[1], file);
  }
}

const unknownImplementations = [...implementations.keys()].filter((id) => !ids.has(id));
const missing = [...ids.keys()].filter((id) => !implementations.has(id));
const declaredPending = Object.keys(pending);

if (unknownImplementations.length) {
  throw new Error(`Implementacoes sem caso: ${unknownImplementations.join(", ")}`);
}
if (missing.sort().join(",") !== declaredPending.sort().join(",")) {
  throw new Error(
    `Pendencias divergentes. Sem implementacao: ${missing.join(", ") || "nenhuma"}; ` +
      `declaradas: ${declaredPending.join(", ") || "nenhuma"}.`,
  );
}

for (const [id, metadata] of Object.entries(pending)) {
  if (!metadata.reason || !metadata.reviewBy) {
    throw new Error(`Pendencia ${id} precisa de reason e reviewBy.`);
  }
}

for (const file of listFiles(playwrightDirectory, ".spec.ts")) {
  const source = readFileSync(file, "utf8");
  let fileCaseCount = 0;

  for (const match of source.matchAll(
    /\btest(?:\.(?:fail|fixme|skip))?\s*\(\s*["'`]([A-Z0-9_-]+)\s*\|/g,
  )) {
    const id = match[1];
    fileCaseCount += 1;

    if (!ids.has(id)) {
      throw new Error(`Caso Playwright desconhecido: ${id}`);
    }
    if (migratedImplementations.has(id)) {
      throw new Error(`Caso Playwright duplicado: ${id}`);
    }
    migratedImplementations.set(id, file);
  }

  if (fileCaseCount === 0) {
    throw new Error(`Spec funcional Playwright sem ID reconhecido: ${file}`);
  }
}

console.log(
  `Contrato de testes valido: ${ids.size} casos, ${implementations.size} implementados, ` +
    `${missing.length} pendente conhecido; ` +
    `${migratedImplementations.size}/${ids.size} migrados para Playwright.`,
);
