import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };
import { resolveProvisioningBlobReporting } from "./provisioning-blob-reporter.mjs";

const slotId = process.argv[2]?.trim().toUpperCase();
const playwrightArguments = process.argv.slice(3);
const slot = slots.find((entry) => entry.id === slotId);
if (!slotId || !slot) {
  throw new Error(
    `Informe um slot válido: ${slots.map((slot) => slot.id).join(", ")}.`,
  );
}
if (slot.creationMode === "manual-shared") {
  throw new Error(
    `${slot.id} nao pode ser criado pelo simulador. Crie-o com o mesmo CPF de ${slot.sharedCpfWith}.`,
  );
}
if (slot.creationMode === "scci-shared") {
  throw new Error(
    `${slot.id} nao pode ser criado pelo simulador React: o Portal bloqueia uma segunda proposta ` +
      `para o mesmo CPF. Use scripts/run-esteira-ht-scci-shared-creation.mjs.`,
  );
}

const { extraArgs, extraEnv } = resolveProvisioningBlobReporting(
  "create",
  slotId,
);

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    "tests/integrations/portal-aejs/create-and-validate-simulation.spec.ts",
    "--project=simulator-integration",
    ...extraArgs,
    ...playwrightArguments,
  ],
  {
    env: { ...process.env, ...extraEnv, PORTAL_PROVISION_SLOT: slotId },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
