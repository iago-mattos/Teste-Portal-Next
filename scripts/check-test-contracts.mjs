import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const specsDirectory = new URL("../cypress/e2e/cliente/", import.meta.url);
const pending = JSON.parse(
  readFileSync(new URL("../cypress/config/known-pending.json", import.meta.url)),
);
const ids = new Map();
const implementations = new Map();

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

console.log(
  `Contrato de testes valido: ${ids.size} casos, ${implementations.size} implementados, ` +
    `${missing.length} pendente conhecido.`,
);
