import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const outputDirectory = resolve("artifacts");
mkdirSync(outputDirectory, { recursive: true });

const packageName = "prognum-playwright-report-0.1.0.tgz";
rmSync(resolve(outputDirectory, packageName), { force: true });

const result = spawnSync(
  "npm",
  [
    "pack",
    "./packages/prognum-playwright-report",
    "--pack-destination",
    outputDirectory,
  ],
  { stdio: "inherit" },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Pacote gerado: ${resolve(outputDirectory, packageName)}`);
