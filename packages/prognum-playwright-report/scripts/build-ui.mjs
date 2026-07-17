import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const outputDir = resolve(packageRoot, "dist/ui");
const viteEntry = fileURLToPath(import.meta.resolve("vite"));
const viteCli = resolve(dirname(viteEntry), "../../bin/vite.js");

rmSync(outputDir, { recursive: true, force: true });

const result = spawnSync(
  process.execPath,
  [
    viteCli,
    "build",
    "--config",
    resolve(repositoryRoot, "report-ui/vite.config.ts"),
    "--outDir",
    outputDir,
  ],
  { cwd: repositoryRoot, stdio: "inherit" },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
