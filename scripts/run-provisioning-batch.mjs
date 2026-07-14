import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };
import { loadEnvironmentProfile } from "./environment-profile.mjs";

loadEnvironmentProfile();

const rawTargetCount = process.env.PORTAL_MASS_TARGET_COUNT?.trim();
const targetCount = Number(rawTargetCount);
if (
  !rawTargetCount ||
  !Number.isInteger(targetCount) ||
  targetCount < 1 ||
  targetCount > slots.length
) {
  throw new Error(
    `PORTAL_MASS_TARGET_COUNT deve ser um inteiro entre 1 e ${slots.length}.`,
  );
}

const selectedSlots = slots.slice(0, targetCount);
console.log(
  `Provisionando ${selectedSlots.length} massa(s): ${selectedSlots.map((slot) => slot.id).join(", ")}.`,
);

for (const slot of selectedSlots) {
  console.log(`\n=== ${slot.sequence}/${targetCount}: ${slot.id} ===`);
  if (slot.creationMode === "manual-shared") {
    console.log(
      `Slot manual: crie ${slot.id} com o mesmo CPF de ${slot.sharedCpfWith} e registre a operacao depois.`,
    );
    continue;
  }
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/run-provisioning-slot.mjs"), slot.id],
    { env: process.env, stdio: "inherit" },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Lote interrompido em ${slot.id}. Nenhum slot posterior foi executado.`,
    );
  }
}
