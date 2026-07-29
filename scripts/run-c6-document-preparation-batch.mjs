import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };

const documentSlots = slots.filter(
  (slot) => slot.stateOwner === "c6-document-preparation",
);

for (const slot of documentSlots) {
  console.log(`\n=== ${slot.id}: preparação até Documentos ===`);
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/run-c6-document-preparation.mjs"), slot.id],
    { env: process.env, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Preparação documental interrompida em ${slot.id}.`);
  }
}
