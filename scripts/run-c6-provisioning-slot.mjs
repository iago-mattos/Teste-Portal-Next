import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };
import { loadC6ProvisioningTarget } from "./c6-provisioning-target.mjs";

const target = loadC6ProvisioningTarget();

const slotId = process.argv[2]?.trim().toUpperCase();
const playwrightArguments = process.argv.slice(3);
const slot = slots.find((entry) => entry.id === slotId);
if (!slotId || !slot) {
  throw new Error(
    `Informe um slot válido: ${slots.map((entry) => entry.id).join(", ")}.`,
  );
}
if (slot.creationMode === "manual-shared") {
  throw new Error(
    `${slot.id} não pode ser criado automaticamente porque precisa usar o CPF de ${slot.sharedCpfWith}.`,
  );
}

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    "tests/provisioning/create-c6-mass.provision.ts",
    "--config=playwright.c6-provision.config.ts",
    "--project=c6-mass-provisioning",
    ...playwrightArguments,
  ],
  {
    env: {
      ...process.env,
      PW_PROFILE: target.profile,
      PORTAL_PROVISION_PROVIDER: "c6",
      PORTAL_PROVISION_SLOT: slotId,
    },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
