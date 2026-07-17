#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultConfig = {
  productName: "Prognum Quality",
  reportTitle: "Relatório Playwright",
  accentColor: "oklch(0.56 0.205 257.3)",
  domains: {},
  evidence: "failure",
  dataDir: ".playwright/prognum-report-data",
  outputDir: "prognum-report",
  port: 9324,
};

function printHelp() {
  console.log(`
Prognum Playwright Report

Comandos:
  init             configura o projeto atual
  test [args]      executa Playwright e constrói o relatório
  build            constrói o relatório a partir da última execução
  open             abre o relatório em um servidor local

Exemplos:
  prognum-playwright-report init
  prognum-playwright-report test -- --project=smoke
  prognum-playwright-report open
`);
}

async function loadConfig(cwd) {
  const configPath = resolve(cwd, "prognum-report.config.mjs");
  if (!existsSync(configPath)) return defaultConfig;

  const imported = await import(
    `${pathToFileURL(configPath).href}?updated=${statSync(configPath).mtimeMs}`
  );
  return {
    ...defaultConfig,
    ...(imported.default ?? {}),
    domains: imported.default?.domains ?? {},
  };
}

function findPlaywrightConfig(cwd) {
  const candidates = [
    "playwright.config.ts",
    "playwright.config.mts",
    "playwright.config.js",
    "playwright.config.mjs",
    "playwright.config.cts",
    "playwright.config.cjs",
  ];
  return candidates.find((candidate) => existsSync(resolve(cwd, candidate)));
}

function updatePackageScripts(cwd) {
  const packagePath = resolve(cwd, "package.json");
  if (!existsSync(packagePath)) {
    throw new Error("package.json não encontrado no diretório atual.");
  }

  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  packageJson.scripts = {
    ...(packageJson.scripts ?? {}),
    "pw:test:report": "prognum-playwright-report test",
    "pw:report:build": "prognum-playwright-report build",
    "pw:report:open": "prognum-playwright-report open",
  };
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function updateGitignore(cwd) {
  const gitignorePath = resolve(cwd, ".gitignore");
  const current = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf8")
    : "";
  const entries = [".playwright/prognum-report-data/", "prognum-report/"];
  const missing = entries.filter(
    (entry) => !current.split(/\r?\n/u).includes(entry),
  );
  if (!missing.length) return;

  const prefix = current.length && !current.endsWith("\n") ? "\n" : "";
  appendFileSync(
    gitignorePath,
    `${prefix}\n# Relatório Playwright Prognum\n${missing.join("\n")}\n`,
    "utf8",
  );
}

function initialize(cwd) {
  const playwrightConfig = findPlaywrightConfig(cwd);
  if (!playwrightConfig) {
    throw new Error("Nenhum playwright.config.* foi encontrado.");
  }

  const reportConfigPath = resolve(cwd, "playwright.report.config.ts");
  if (!existsSync(reportConfigPath)) {
    const importPath = `./${playwrightConfig.replace(/\.(?:[cm]?[jt]s)$/u, "")}`;
    writeFileSync(
      reportConfigPath,
      [
        `import baseConfig from ${JSON.stringify(importPath)};`,
        'import { withPrognumReport } from "@prognum/playwright-report/config";',
        "",
        "export default withPrognumReport(baseConfig);",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  const appearancePath = resolve(cwd, "prognum-report.config.mjs");
  if (!existsSync(appearancePath)) {
    writeFileSync(
      appearancePath,
      `export default ${JSON.stringify(defaultConfig, null, 2)};\n`,
      "utf8",
    );
  }

  updatePackageScripts(cwd);
  updateGitignore(cwd);

  console.log("Relatório configurado com sucesso.");
  console.log(`  Config Playwright: ${relative(cwd, reportConfigPath)}`);
  console.log(`  Identidade visual: ${relative(cwd, appearancePath)}`);
  console.log("  Executar: npm run pw:test:report");
}

function buildReport(cwd, config) {
  const sourceRoot = resolve(cwd, config.dataDir);
  const sourceReport = resolve(sourceRoot, "report.json");
  const sourceAssets = resolve(sourceRoot, "assets");
  const uiRoot = resolve(packageRoot, "dist/ui");
  const outputRoot = resolve(cwd, config.outputDir);
  const outputEvidence = resolve(outputRoot, "evidence");

  if (!existsSync(sourceReport)) {
    throw new Error(
      "Dados do relatório não encontrados. Execute npm run pw:test:report primeiro.",
    );
  }
  if (!existsSync(resolve(uiRoot, "index.html"))) {
    throw new Error("A interface compilada não foi encontrada no pacote.");
  }

  rmSync(outputRoot, { recursive: true, force: true });
  cpSync(uiRoot, outputRoot, { recursive: true });
  cpSync(sourceReport, resolve(outputRoot, "report-data.json"));
  rmSync(outputEvidence, { recursive: true, force: true });
  if (existsSync(sourceAssets)) {
    cpSync(sourceAssets, outputEvidence, { recursive: true });
  } else {
    mkdirSync(outputEvidence, { recursive: true });
  }
  writeFileSync(
    resolve(outputRoot, "report-config.json"),
    `${JSON.stringify(
      {
        productName: config.productName,
        reportTitle: config.reportTitle,
        accentColor: config.accentColor,
        domains: config.domains,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Relatório gerado: ${resolve(outputRoot, "index.html")}`);
}

function resolvePlaywrightCli(cwd) {
  const projectRequire = createRequire(resolve(cwd, "package.json"));
  return projectRequire.resolve("@playwright/test/cli");
}

function runTests(cwd, config, forwardedArguments) {
  const argumentsWithoutSeparator =
    forwardedArguments[0] === "--"
      ? forwardedArguments.slice(1)
      : forwardedArguments;
  const result = spawnSync(
    process.execPath,
    [
      resolvePlaywrightCli(cwd),
      "test",
      "--config=playwright.report.config.ts",
      ...argumentsWithoutSeparator,
    ],
    {
      cwd,
      env: {
        ...process.env,
        PW_EVIDENCE: config.evidence === "all" ? "all" : "failure",
        PROGNUM_REPORT_DATA_DIR: resolve(cwd, config.dataDir),
      },
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  try {
    buildReport(cwd, config);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    if (result.status === 0) return 1;
  }
  return result.status ?? 1;
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".zip": "application/zip",
};

function openBrowser(url) {
  const command =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  const child = spawn(command[0], command[1], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function openReport(cwd, config, shouldOpenBrowser = true) {
  const outputRoot = resolve(cwd, config.outputDir);
  if (!existsSync(resolve(outputRoot, "index.html"))) {
    throw new Error("Relatório não encontrado. Execute npm run pw:report:build.");
  }

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const filePath = resolve(
      outputRoot,
      requestedPath === "/" ? "index.html" : `.${requestedPath}`,
    );
    if (
      filePath !== outputRoot &&
      !filePath.startsWith(`${outputRoot}${sep}`)
    ) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.setHeader(
      "Content-Type",
      mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
    );
    createReadStream(filePath).pipe(response);
  });

  server.listen(config.port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${config.port}`;
    console.log(`Relatório disponível em ${url}`);
    console.log("Pressione Ctrl+C para encerrar.");
    if (shouldOpenBrowser) openBrowser(url);
  });
}

const cwd = process.cwd();
const [command = "help", ...argumentsAfterCommand] = process.argv.slice(2);

try {
  if (command === "init") {
    initialize(cwd);
  } else if (command === "build") {
    buildReport(cwd, await loadConfig(cwd));
  } else if (command === "test") {
    process.exitCode = runTests(
      cwd,
      await loadConfig(cwd),
      argumentsAfterCommand,
    );
  } else if (command === "open") {
    openReport(
      cwd,
      await loadConfig(cwd),
      !argumentsAfterCommand.includes("--no-open"),
    );
  } else {
    printHelp();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
