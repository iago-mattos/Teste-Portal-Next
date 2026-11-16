import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };
import { loadEsteiraHtProvisioningTarget } from "./esteira-ht-provisioning-target.mjs";
import { resolveProvisioningBlobReporting } from "./provisioning-blob-reporter.mjs";

const target = loadEsteiraHtProvisioningTarget();

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

const { extraArgs, extraEnv } = resolveProvisioningBlobReporting(
  "phase",
  slotId,
);

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    "tests/provisioning/prepare-c6-phase.provision.ts",
    "--config=playwright.c6-provision.config.ts",
    "--project=c6-mass-provisioning",
    ...extraArgs,
    ...playwrightArguments,
  ],
  {
    env: {
      ...process.env,
      ...extraEnv,
      PW_PROFILE: target.profile,
      PORTAL_PROVISION_SLOT: slotId,
    },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
