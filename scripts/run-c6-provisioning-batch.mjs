import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };
import { loadEnvironmentProfile } from "./environment-profile.mjs";

process.env.PW_PROFILE = "ht";
loadEnvironmentProfile();

const rawTargetCount = process.env.C6_PROVISION_TARGET_COUNT?.trim();
const targetCount = Number(rawTargetCount);
if (
  !rawTargetCount ||
  !Number.isInteger(targetCount) ||
  targetCount < 1 ||
  targetCount > slots.length
) {
  throw new Error(
    `C6_PROVISION_TARGET_COUNT deve ser um inteiro entre 1 e ${slots.length}.`,
  );
}

const selectedSlots = slots.slice(0, targetCount);
console.log(
  `Provisionando ${selectedSlots.length} massa(s) no C6 HT: ${selectedSlots.map((slot) => slot.id).join(", ")}.`,
);

for (const slot of selectedSlots) {
  console.log(`\n=== ${slot.sequence}/${targetCount}: ${slot.id} ===`);
  if (slot.creationMode === "manual-shared") {
    console.log(
      `Slot manual: crie ${slot.id} com o mesmo CPF de ${slot.sharedCpfWith} e registre a operação depois.`,
    );
    continue;
  }

  const result = spawnSync(
    process.execPath,
    [resolve("scripts/run-c6-provisioning-slot.mjs"), slot.id],
    { env: process.env, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Lote C6 interrompido em ${slot.id}; os slots posteriores não foram executados.`,
    );
  }
}
