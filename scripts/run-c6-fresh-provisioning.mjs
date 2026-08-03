import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };

const dryRun = process.argv.includes("--dry-run");
const publishOnly = process.argv.includes("--publish-only");
const resume = process.argv.includes("--resume");
const freshSlots = slots.filter((slot) => slot.lifecycle === "fresh-per-run");
const sharedEnvironment = {
  ...process.env,
  PW_PROFILE: "ht",
  PORTAL_PROVISION_PROVIDER: "c6",
  C6_PROVISION_TARGET_COUNT: String(freshSlots.length),
};

function runStep(label, script, args = []) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [resolve(script), ...args], {
    env: sharedEnvironment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Provisionamento C6 interrompido em: ${label}.`);
  }
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporary, path);
}

async function validateResumableBatch() {
  const registryPath = resolve(".playwright/generated-c6-simulations/ht.json");
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const missing = freshSlots.filter((slot) => {
    const entry = registry.entries?.find((candidate) => candidate.slotId === slot.id);
    return !entry?.protocol || entry.runId !== registry.run?.id;
  });
  if (!registry.run?.id || missing.length > 0) {
    throw new Error(
      `O lote C6 ativo não pode ser retomado. Slots sem operação no lote atual: ${missing
        .map((slot) => slot.id)
        .join(", ") || "nenhum manifesto ativo"}.`,
    );
  }
  console.log(`Retomando o lote C6 ${registry.run.id} sem criar novas propostas.`);
}

if (resume && publishOnly) {
  throw new Error("Use apenas um modo por vez: --resume ou --publish-only.");
}

if (dryRun) {
  runStep("validar início do lote fresco", "scripts/start-c6-fresh-run.mjs", [
    "--dry-run",
  ]);
  console.log("\nPlano do lote:");
  console.log(`1. Criar ${freshSlots.length} propostas no simulador interno C6.`);
  console.log("2. Comprovar no Portal o endereço preparado no SCCI.");
  console.log("3. Preparar fases 101 e 50.");
  console.log("4. Preparar Timeline Documentos e duas massas documentais.");
  console.log("5. Publicar overlay somente após todas ficarem prontas.");
  process.exit(0);
}

if (!publishOnly) {
  if (resume) {
    await validateResumableBatch();
    runStep(
      "retomar preparação das propostas existentes",
      "scripts/run-c6-provisioning-batch.mjs",
    );
  } else {
    runStep("iniciar lote fresco", "scripts/start-c6-fresh-run.mjs");
    runStep("criar propostas frescas", "scripts/run-c6-provisioning-batch.mjs");
  }
  runStep(
    "comprovar no Portal os endereços preparados no SCCI",
    "scripts/run-c6-property-preparation-batch.mjs",
  );
  runStep("preparar fases funcionais", "scripts/run-c6-phase-preparation-batch.mjs");
  runStep(
    "preparar propostas documentais",
    "scripts/run-c6-document-preparation-batch.mjs",
  );
}
runStep("publicar overlay do lote", "scripts/manage-c6-provisioning-registry.mjs", [
  "publish",
]);

const registryPath = resolve(".playwright/generated-c6-simulations/ht.json");
const currentRunPath = resolve(".playwright/c6-runs/ht/current.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const notReady = freshSlots.filter((slot) => {
  const entry = registry.entries?.find((candidate) => candidate.slotId === slot.id);
  const sharedEntry = slot.sharedCpfWith
    ? registry.entries?.find(
        (candidate) => candidate.slotId === slot.sharedCpfWith,
      )
    : undefined;
  return (
    !entry?.protocol ||
    entry.status !== "ready" ||
    !entry.propertyPreparedAt ||
    (slot.creationMode === "simulator-shared" &&
      (!sharedEntry?.protocol ||
        entry.applicant?.cpfDigits !== sharedEntry.applicant?.cpfDigits)) ||
    entry.runId !== registry.run?.id
  );
});
if (notReady.length > 0) {
  throw new Error(
    `Lote publicado com inconsistências: ${notReady.map((slot) => slot.id).join(", ")}.`,
  );
}

const completedRun = {
  ...registry.run,
  status: "ready",
  publishedAt: new Date().toISOString(),
};
registry.run = completedRun;
await writeJsonAtomic(registryPath, registry);
await writeJsonAtomic(currentRunPath, completedRun);

console.log(`\nLote C6 ${completedRun.id} pronto e publicado.`);
