import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };

const slotId = process.argv[2]?.trim().toUpperCase();
const slot = slots.find((entry) => entry.id === slotId);
if (!slotId || !slot || slot.lifecycle !== "fresh-per-run") {
  throw new Error("Informe um slot fresco válido para preparar o imóvel.");
}

const registry = JSON.parse(
  readFileSync(resolve(".playwright/generated-c6-simulations/ht.json"), "utf8"),
);
const entry = registry.entries?.find((candidate) => candidate.slotId === slotId);
if (!entry?.protocol || !entry?.applicant?.cpfDigits) {
  throw new Error(`${slotId} ainda não possui operação e CPF provisionados.`);
}

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    "tests/provisioning/prepare-c6-property.provision.ts",
    "--config=playwright.c6-provision.config.ts",
    "--project=c6-mass-provisioning",
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
