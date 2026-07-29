import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };

const slotId = process.argv[2]?.trim().toUpperCase();
const playwrightArguments = process.argv.slice(3);
const slot = slots.find((entry) => entry.id === slotId);
if (!slotId || !slot || slot.stateOwner !== "c6-phase-preparation") {
  throw new Error(
    `Informe um slot de fase válido: ${slots
      .filter((entry) => entry.stateOwner === "c6-phase-preparation")
      .map((entry) => entry.id)
      .join(", ")}.`,
  );
}

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    "tests/provisioning/prepare-c6-phase.provision.ts",
    "--config=playwright.c6-provision.config.ts",
    "--project=c6-mass-provisioning",
    ...playwrightArguments,
  ],
  {
    env: {
      ...process.env,
      PW_PROFILE: "ht",
      PORTAL_PROVISION_PROVIDER: "c6",
      PORTAL_PROVISION_SLOT: slotId,
    },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
