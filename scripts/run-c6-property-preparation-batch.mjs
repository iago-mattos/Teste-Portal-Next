import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };

const freshSlots = slots.filter((slot) => slot.lifecycle === "fresh-per-run");

for (const slot of freshSlots) {
  console.log(`\n=== ${slot.id}: reflexo do endereço do imóvel no Portal ===`);
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/run-c6-property-preparation.mjs"), slot.id],
    { env: process.env, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Comprovação do imóvel interrompida em ${slot.id}.`);
  }
}
