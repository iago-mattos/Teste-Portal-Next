import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };
import { loadEsteiraHtProvisioningTarget } from "./esteira-ht-provisioning-target.mjs";

// Nunca herdar PORTAL_PROVISION_PROVIDER=c6 de uma sessão de shell anterior:
// o lote da EsteiraHT sempre usa o registry/overlay "portal", nunca o do C6.
// Normalizado antes de qualquer guard rodar para não bloquear a própria
// orquestração por um valor stale do ambiente.
process.env.PORTAL_PROVISION_PROVIDER = "portal";

const dryRun = process.argv.includes("--dry-run");
const publishOnly = process.argv.includes("--publish-only");
const resume = process.argv.includes("--resume");
const forwardedPlaywrightArguments = process.argv
  .slice(2)
  .filter((argument) => ["--headed", "--debug"].includes(argument));
const freshSlots = slots.filter((slot) => slot.lifecycle === "fresh-per-run");
const target = loadEsteiraHtProvisioningTarget();
const sharedEnvironment = {
  ...process.env,
  PW_PROFILE: target.profile,
  PORTAL_PROVISION_PROVIDER: "portal",
  PW_EXCLUDE_EXTERNAL_STATES: "true",
  PORTAL_MASS_TARGET_COUNT: String(freshSlots.length),
};

function runStep(label, script, args = []) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [resolve(script), ...args], {
    env: sharedEnvironment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Provisionamento EsteiraHT interrompido em: ${label}.`);
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
  const registry = JSON.parse(await readFile(target.registryPath, "utf8"));
  if (!Array.isArray(registry.entries)) {
    throw new Error("O registro da EsteiraHT está estruturalmente inválido.");
  }
  if (!registry.run?.id) {
    throw new Error(
      "Não existe manifesto ativo para retomar. Rode sem --resume para iniciar um novo lote.",
    );
  }
  if (registry.run.provider && registry.run.provider !== "portal") {
    throw new Error(
      `O lote ativo pertence ao provider "${registry.run.provider}", não a "portal".`,
    );
  }
  if (registry.run.profile && registry.run.profile !== target.profile) {
    throw new Error(
      `O lote ativo pertence ao perfil "${registry.run.profile}", não a "${target.profile}".`,
    );
  }

  const findEntry = (slotId) =>
    registry.entries.find((candidate) => candidate.slotId === slotId);

  const foreignRun = freshSlots.filter((slot) => {
    const entry = findEntry(slot.id);
    return entry?.protocol && entry.runId !== registry.run.id;
  });
  if (foreignRun.length > 0) {
    throw new Error(
      `O registro diverge do manifesto ativo: ${foreignRun
        .map((slot) => slot.id)
        .join(", ")} pertence(m) a outro runId. Corrija o registro antes de retomar.`,
    );
  }

  const protocols = freshSlots
    .map((slot) => findEntry(slot.id)?.protocol)
    .filter(Boolean);
  if (new Set(protocols).size !== protocols.length) {
    throw new Error(
      "O registro possui protocolos duplicados entre os slots frescos; corrija antes de retomar.",
    );
  }

  const created = freshSlots.filter((slot) => findEntry(slot.id)?.protocol);
  const pending = freshSlots.filter((slot) => !findEntry(slot.id)?.protocol);
  console.log(
    `Retomando o lote EsteiraHT ${registry.run.id}; protocolos existentes serão ` +
      `reutilizados (${created.map((slot) => slot.id).join(", ") || "nenhum"}) e ` +
      `slots pendentes serão criados (${pending.map((slot) => slot.id).join(", ") || "nenhum"}).`,
  );
}

if (resume && publishOnly) {
  throw new Error("Use apenas um modo por vez: --resume ou --publish-only.");
}

if (dryRun && resume) {
  await validateResumableBatch();
  console.log("Dry-run de retomada concluído; nenhum registro foi alterado.");
  process.exit(0);
}

if (dryRun) {
  runStep("validar início do lote fresco", "scripts/start-esteira-ht-fresh-run.mjs", [
    "--dry-run",
  ]);
  console.log("\nPlano do lote:");
  console.log(
      `1. Criar ${freshSlots.length - 1} propostas pelo simulador público do Portal React ` +
      `e 1 (TIMELINE_DOCUMENTS) pelo simulador interno do SCCI, compartilhando o CPF ` +
      "de DEFAULT — o bloqueio da 2ª proposta no Portal foi comprovado; a criação alternativa " +
      "no SCCI exige a primeira execução real supervisionada.",
  );
  console.log("2. Localizar e comprovar cada operação no SCCI EsteiraHT.");
  console.log(
    "3. Preencher e persistir pelo Portal o CEP do imóvel (o simulador não coleta CEP).",
  );
  console.log("4. Preparar as fases 101 e 50 no SCCI.");
  console.log("5. Preparar Timeline Documentos e as massas documentais pelo Portal.");
  console.log("6. Publicar overlay somente após todas ficarem prontas.");
  process.exit(0);
}

if (!publishOnly) {
  if (resume) {
    await validateResumableBatch();
  } else {
    runStep("iniciar lote fresco", "scripts/start-esteira-ht-fresh-run.mjs");
  }
  runStep(
    "criar propostas frescas pelo simulador React e validar no SCCI EsteiraHT",
    "scripts/run-esteira-ht-provisioning-batch.mjs",
    forwardedPlaywrightArguments,
  );
  runStep(
    "preencher e persistir pelo Portal o CEP do imóvel",
    "scripts/run-esteira-ht-property-preparation-batch.mjs",
    forwardedPlaywrightArguments,
  );
  runStep(
    "preparar fases funcionais no SCCI",
    "scripts/run-esteira-ht-phase-preparation-batch.mjs",
    forwardedPlaywrightArguments,
  );
  runStep(
    "preparar propostas documentais pelo Portal",
    "scripts/run-esteira-ht-document-preparation-batch.mjs",
    forwardedPlaywrightArguments,
  );
}
runStep("publicar overlay do lote", "scripts/manage-provisioning-registry.mjs", [
  "publish",
]);

const registry = JSON.parse(await readFile(target.registryPath, "utf8"));
const findPublishedEntry = (slotId) =>
  registry.entries?.find((candidate) => candidate.slotId === slotId);
const notReady = freshSlots.filter((slot) => {
  const entry = findPublishedEntry(slot.id);
  return (
    !entry?.protocol ||
    entry.status !== "ready" ||
    entry.runId !== registry.run?.id ||
    (slot.creationMode === "scci-shared" &&
      (!entry.scciValidatedAt || !entry.portalListValidatedAt))
  );
});
if (notReady.length > 0) {
  throw new Error(
    `Lote publicado com inconsistências: ${notReady.map((slot) => slot.id).join(", ")}.`,
  );
}

const sharedCpfSlots = freshSlots.filter((slot) => slot.sharedCpfWith);
for (const slot of sharedCpfSlots) {
  const entry = findPublishedEntry(slot.id);
  const sharedEntry = findPublishedEntry(slot.sharedCpfWith);
  if (entry.applicant.cpfDigits !== sharedEntry?.applicant.cpfDigits) {
    throw new Error(
      `${slot.id} deveria compartilhar o CPF de ${slot.sharedCpfWith}, mas os CPFs divergem.`,
    );
  }
  if (entry.protocol === sharedEntry.protocol) {
    throw new Error(
      `${slot.id} e ${slot.sharedCpfWith} não podem apresentar o mesmo protocolo.`,
    );
  }
}

const protocolCounts = new Map();
for (const slot of freshSlots) {
  const protocol = findPublishedEntry(slot.id)?.protocol;
  protocolCounts.set(protocol, (protocolCounts.get(protocol) ?? 0) + 1);
}
const duplicatedProtocols = [...protocolCounts.entries()].filter(
  ([, count]) => count > 1,
);
if (duplicatedProtocols.length > 0) {
  throw new Error(
    `Lote publicado com protocolos duplicados: ${duplicatedProtocols
      .map(([protocol]) => protocol)
      .join(", ")}.`,
  );
}

const completedRun = {
  ...registry.run,
  status: "ready",
  publishedAt: new Date().toISOString(),
};
registry.run = completedRun;
await writeJsonAtomic(target.registryPath, registry);
await writeJsonAtomic(target.currentRunPath, completedRun);

console.log(`\nLote EsteiraHT ${completedRun.id} pronto e publicado.`);
