import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const root = resolve(".");
const reportCli = resolve("node_modules/.bin/prognum-playwright-report");
const [command = "build"] = process.argv.slice(2);
const { default: reportConfig } = await import(
  pathToFileURL(resolve(root, "prognum-report.config.mjs")).href
);
const sourceReport = resolve(
  root,
  reportConfig.dataDir ?? ".playwright/prognum-report-data",
  "report.json",
);
const builtReport = resolve(
  root,
  reportConfig.outputDir ?? "portal-report",
  "report-data.json",
);

if (!["build", "pdf"].includes(command)) {
  throw new Error(`Comando de relatório não suportado: ${command}.`);
}

if (command === "build") {
  normalizeRunTiming(sourceReport);
  const buildResult = runReportCli("build");
  if (buildResult !== 0) process.exit(buildResult);
}

normalizeRunTiming(builtReport);

const python = findPdfPython();
if (!python) {
  console.error(
    [
      "Python com ReportLab e Pillow não encontrado para gerar o PDF.",
      "Configure PROGNUM_REPORT_PYTHON ou instale as dependências com:",
      "python3 -m pip install reportlab Pillow",
    ].join("\n"),
  );
  process.exit(1);
}

process.exit(runReportCli("pdf", {
  PROGNUM_REPORT_PYTHON: python,
}));

function runReportCli(subcommand, extraEnvironment = {}) {
  const result = spawnSync(reportCli, [subcommand], {
    cwd: root,
    env: {
      ...process.env,
      ...extraEnvironment,
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function findPdfPython() {
  const bundledPython = resolve(
    homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3",
  );
  const candidates = [
    process.env.PROGNUM_REPORT_PYTHON,
    process.env.PYTHON,
    existsSync(bundledPython) ? bundledPython : undefined,
    "python3",
    "python",
  ].filter(Boolean);

  for (const candidate of [...new Set(candidates)]) {
    const result = spawnSync(
      candidate,
      ["-c", "import reportlab, PIL"],
      {
        cwd: root,
        stdio: "ignore",
      },
    );
    if (result.status === 0) return candidate;
  }

  return undefined;
}

function normalizeRunTiming(reportPath) {
  if (!existsSync(reportPath)) return;

  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const intervals = (report.tests ?? []).flatMap((test) => {
    const startedAt = Date.parse(test.startedAt);
    const duration = Number(test.duration);

    if (!Number.isFinite(startedAt) || !Number.isFinite(duration) || duration < 0) {
      return [];
    }

    return [{ startedAt, endedAt: startedAt + duration }];
  });

  if (intervals.length === 0) return;

  const startedAt = Math.min(...intervals.map((interval) => interval.startedAt));
  const endedAt = Math.max(...intervals.map((interval) => interval.endedAt));

  report.run = {
    ...report.run,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    duration: endedAt - startedAt,
    total: report.tests.length,
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
