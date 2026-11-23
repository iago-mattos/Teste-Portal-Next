import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./casos-de-teste/lib.mjs";

/**
 * Contrato entre os testes funcionais e o catálogo de casos
 * (Docs/CasosDeTeste/catalogo.json):
 * - todo spec funcional tem ao menos um teste com título "ID | regra";
 * - todo ID usado num título existe no catálogo e aparece uma vez só;
 * - todo caso automatizado das regras da planilha que é coberto por título
 *   "ID | ..." tem o teste correspondente.
 */

const playwrightDirectory = fileURLToPath(
  new URL("../tests/functional/", import.meta.url),
);

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

const catalog = loadCatalog("portal");
const caseIds = new Set(catalog.casos.map((testCase) => testCase.id));
const implementations = new Map();

for (const file of listFiles(playwrightDirectory, ".spec.ts")) {
  const source = readFileSync(file, "utf8");
  let fileCaseCount = 0;

  for (const match of source.matchAll(
    /\btest(?:\.(?:fail|fixme|skip))?\s*\(\s*["'`]([A-Z0-9_-]+)\s*\|/g,
  )) {
    const id = match[1];
    fileCaseCount += 1;

    if (!caseIds.has(id)) {
      throw new Error(`Caso Playwright desconhecido no catálogo: ${id} (${file})`);
    }
    if (implementations.has(id)) {
      throw new Error(`Caso Playwright duplicado: ${id}`);
    }
    implementations.set(id, file);
  }

  if (fileCaseCount === 0) {
    throw new Error(`Spec funcional Playwright sem ID reconhecido: ${file}`);
  }
}

// Casos cujo vínculo é o próprio título "ID |" precisam do teste existir.
const missing = catalog.casos
  .filter((testCase) =>
    (testCase.vinculos ?? []).some((link) => link.titulo === `${testCase.id} |`),
  )
  .map((testCase) => testCase.id)
  .filter((id) => !implementations.has(id));

if (missing.length) {
  throw new Error(`Casos do catálogo sem teste funcional: ${missing.join(", ")}`);
}

console.log(
  `Contrato de testes válido: ${implementations.size} casos funcionais com teste, ` +
    `${catalog.casos.length} casos no catálogo.`,
);
