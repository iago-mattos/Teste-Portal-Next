import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";

const playwrightBin = resolve("node_modules/.bin/playwright");
const outputRoot = resolve(".playwright/all-report");
const collectedBlobs = resolve(outputRoot, "blobs");
const forwardedArgs = process.argv.slice(2);

const phases = [
  {
    name: "portal",
    description: "smoke e funcionais do Portal",
    args: [
      "test",
      "--project=smoke",
      "--project=functional-readonly",
      "--project=functional-mutation",
    ],
  },
  {
    name: "simulator",
    description: "provisionamento Simulador -> SCCI",
    args: ["test", "--project=simulator-integration"],
  },
  {
    name: "integration-mutation",
    description: "preparacoes e transicoes Portal -> SCCI",
    args: ["test", "--project=integration", "--grep", "@mutation"],
  },
  {
    name: "integration-readonly",
    description: "validacoes SCCI apos as preparacoes",
    args: ["test", "--project=integration", "--grep", "@readonly"],
  },
];

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(collectedBlobs, { recursive: true });

let failed = false;
for (const phase of phases) {
  const phaseOutput = resolve(outputRoot, phase.name);
  console.log(`\n=== ${phase.description} ===`);

  const result = spawnSync(
    playwrightBin,
    [...phase.args, "--reporter=list,blob", ...forwardedArgs],
    {
      env: {
        ...process.env,
        PLAYWRIGHT_BLOB_OUTPUT_DIR: phaseOutput,
      },
      stdio: "inherit",
    },
  );

  if (result.status !== 0) failed = true;

  if (!existsSync(phaseOutput)) continue;
  for (const file of readdirSync(phaseOutput, { withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith(".zip")) continue;
    copyFileSync(
      resolve(phaseOutput, file.name),
      resolve(collectedBlobs, `${phase.name}-${file.name}`),
    );
  }
}

const mergeResult = spawnSync(
  playwrightBin,
  ["merge-reports", "--reporter=html", collectedBlobs],
  { stdio: "inherit" },
);
if (mergeResult.status !== 0) failed = true;

console.log("\nRelatorio consolidado: playwright-report/index.html");
process.exitCode = failed ? 1 : 0;
