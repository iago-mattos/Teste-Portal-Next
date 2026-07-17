import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const sourceRoot = resolve(".playwright/portal-report-data");
const sourceReport = resolve(sourceRoot, "report.json");
const sourceAssets = resolve(sourceRoot, "assets");
const outputRoot = resolve("portal-report");
const outputEvidence = resolve(outputRoot, "evidence");

if (!existsSync(sourceReport)) {
  console.error(
    "Dados do relatório não encontrados. Execute uma suíte Playwright antes de gerar o relatório.",
  );
  process.exit(1);
}

const build = spawnSync(
  resolve("node_modules/.bin/vite"),
  ["build", "--config", "report-ui/vite.config.ts"],
  { stdio: "inherit" },
);

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

mkdirSync(outputRoot, { recursive: true });
cpSync(sourceReport, resolve(outputRoot, "report-data.json"));
writeFileSync(
  resolve(outputRoot, "report-config.json"),
  `${JSON.stringify(
    {
      productName: "Portal Quality",
      reportTitle: "Relatório Playwright",
      domains: {},
    },
    null,
    2,
  )}\n`,
  "utf8",
);
rmSync(outputEvidence, { recursive: true, force: true });
if (existsSync(sourceAssets)) {
  cpSync(sourceAssets, outputEvidence, { recursive: true });
}

console.log(`Relatório Portal: ${resolve(outputRoot, "index.html")}`);
