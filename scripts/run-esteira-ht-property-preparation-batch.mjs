import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };

const preparableStateOwners = new Set(["provisioner", "existing-integration-test"]);
const preparableSlots = slots.filter(
  (slot) =>
    slot.lifecycle === "fresh-per-run" &&
    preparableStateOwners.has(slot.stateOwner),
);
const playwrightArguments = process.argv.slice(2);

for (const slot of preparableSlots) {
  console.log(`\n=== ${slot.id}: CEP do imóvel preenchido e persistido pelo Portal ===`);
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/run-esteira-ht-property-preparation.mjs"), slot.id, ...playwrightArguments],
    { env: process.env, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Preparação do imóvel interrompida em ${slot.id}.`);
  }
}
