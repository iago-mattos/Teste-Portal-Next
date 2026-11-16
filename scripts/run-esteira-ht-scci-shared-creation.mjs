import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };
import { loadEsteiraHtProvisioningTarget } from "./esteira-ht-provisioning-target.mjs";
import { resolveProvisioningBlobReporting } from "./provisioning-blob-reporter.mjs";

const target = loadEsteiraHtProvisioningTarget();

const slotId = process.argv[2]?.trim().toUpperCase();
const playwrightArguments = process.argv.slice(3);
const slot = slots.find((entry) => entry.id === slotId);
if (!slotId || !slot || slot.creationMode !== "scci-shared") {
  throw new Error(
    `Informe um slot de criação excepcional pelo SCCI: ${slots
      .filter((entry) => entry.creationMode === "scci-shared")
      .map((entry) => entry.id)
      .join(", ")}.`,
  );
}

const { extraArgs, extraEnv } = resolveProvisioningBlobReporting(
  "scci-shared",
  slotId,
);

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    "tests/provisioning/create-esteira-ht-scci-shared.provision.ts",
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
