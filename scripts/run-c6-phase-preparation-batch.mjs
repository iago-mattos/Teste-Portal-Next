import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };

const phaseSlots = slots.filter(
  (slot) => slot.stateOwner === "c6-phase-preparation",
);

for (const slot of phaseSlots) {
  console.log(
    `\n=== ${slot.id}: fase ${slot.phaseTarget.code} — ${slot.phaseTarget.label} ===`,
  );
  let result = spawnSync(
    process.execPath,
    [resolve("scripts/run-c6-phase-preparation.mjs"), slot.id],
    { env: process.env, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.warn(
      `A preparação de ${slot.id} não concluiu na sessão original; reabrindo somente para comprovar a persistência.`,
    );
    result = spawnSync(
      process.execPath,
      [resolve("scripts/run-c6-phase-preparation.mjs"), slot.id],
      {
        env: { ...process.env, C6_PHASE_VERIFY_ONLY: "true" },
        stdio: "inherit",
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Preparação de fases interrompida em ${slot.id}.`);
    }
  }
}
