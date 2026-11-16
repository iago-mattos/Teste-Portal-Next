import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };
import { loadEsteiraHtProvisioningTarget } from "./esteira-ht-provisioning-target.mjs";

const target = loadEsteiraHtProvisioningTarget();
const freshSlots = slots.filter((slot) => slot.lifecycle === "fresh-per-run");
const playwrightArguments = process.argv.slice(2);

function dispatcherFor(slot) {
  if (slot.creationMode === "scci-shared") {
    return "scripts/run-esteira-ht-scci-shared-creation.mjs";
  }
  return "scripts/run-provisioning-slot.mjs";
}

console.log(
  `Provisionando ${freshSlots.length} massa(s) (${target.profile}): ${freshSlots
    .map((slot) =>
      slot.creationMode === "scci-shared"
        ? `${slot.id} [SCCI EsteiraHT]`
        : slot.id,
    )
    .join(", ")}.`,
);

for (const [index, slot] of freshSlots.entries()) {
  console.log(`\n=== ${index + 1}/${freshSlots.length}: ${slot.id} ===`);
  const result = spawnSync(
    process.execPath,
    [resolve(dispatcherFor(slot)), slot.id, ...playwrightArguments],
    { env: process.env, stdio: "inherit" },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Lote interrompido em ${slot.id}. Nenhum slot posterior foi criado; a retomada continuará a partir do registro.`,
    );
  }
}
