import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };
import { loadEnvironmentProfile } from "./environment-profile.mjs";

const dryRun = process.argv.includes("--dry-run");
const profile = loadEnvironmentProfile().name;
const aejsHost = new URL(process.env.AEJS_URL ?? "").host;

if (profile !== "ht") {
  throw new Error(`Execução C6 fresca exige PW_PROFILE=ht; recebido ${profile}.`);
}
if (aejsHost !== "c6ht.prognum.com.br") {
  throw new Error(
    `Execução C6 fresca bloqueada para o host ${aejsHost || "vazio"}.`,
  );
}

const registryPath = resolve(".playwright/generated-c6-simulations/ht.json");
const historyDirectory = resolve(
  ".playwright/generated-c6-simulations/history/ht",
);
const currentRunPath = resolve(".playwright/c6-runs/ht/current.json");

async function readExistingRegistry() {
  try {
    const parsed = JSON.parse(await readFile(registryPath, "utf8"));
    if (!Array.isArray(parsed.entries)) {
      throw new Error("entries ausente");
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw new Error(
      "O registro C6 atual é inválido e não será substituído automaticamente.",
      { cause: error },
    );
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

const existingRegistry = await readExistingRegistry();
const createdAt = new Date().toISOString();
const runId = `${createdAt.replace(/\D/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const archivePath = existingRegistry
  ? resolve(historyDirectory, `${runId}-previous.json`)
  : undefined;

const run = {
  id: runId,
  profile: "ht",
  provider: "c6",
  createdAt,
  status: "initialized",
  freshSlotIds: slots
    .filter((slot) => slot.lifecycle === "fresh-per-run")
    .map((slot) => slot.id),
  externalSlotIds: slots
    .filter((slot) => slot.lifecycle === "external-static")
    .map((slot) => slot.id),
  onDemandSlotIds: slots
    .filter((slot) => slot.lifecycle === "on-demand")
    .map((slot) => slot.id),
};

console.log(`Nova execução C6: ${run.id}`);
console.log(`Massas frescas: ${run.freshSlotIds.join(", ")}`);
console.log(`Massas externas preservadas: ${run.externalSlotIds.join(", ")}`);
console.log(`Massas sob demanda: ${run.onDemandSlotIds.join(", ")}`);

if (dryRun) {
  console.log("Dry-run concluído; nenhum registro foi alterado.");
  process.exit(0);
}

if (existingRegistry && archivePath) {
  await mkdir(historyDirectory, { recursive: true });
  await rename(registryPath, archivePath);
  console.log(`Lote anterior arquivado em ${archivePath}.`);
}

await writeJson(registryPath, {
  run,
  nextSequence: 1,
  entries: [],
});
await writeJson(currentRunPath, run);

console.log(`Manifesto ativo: ${currentRunPath}`);
console.log(`Registro renovado: ${registryPath}`);
