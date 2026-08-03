import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const externalStateSlots = [
  "EXPIRED",
  "CANCELED_WITHIN_30_DAYS",
  "CANCELED_OVER_30_DAYS",
];
const playwrightArguments = process.argv.slice(2);

for (const slotId of externalStateSlots) {
  console.log(`\n=== Provisionando ${slotId} no C6 HT ===`);
  const result = spawnSync(
    process.execPath,
    [
      resolve("scripts/run-c6-provisioning-slot.mjs"),
      slotId,
      ...playwrightArguments,
    ],
    {
      env: { ...process.env, PW_PROFILE: "ht" },
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Provisionamento interrompido em ${slotId}; os slots posteriores não foram executados.`,
    );
  }
}
