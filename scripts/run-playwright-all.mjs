import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const playwrightBin = resolve("node_modules/.bin/playwright");
const outputRoot = resolve(".playwright/all-report");
const collectedBlobs = resolve(outputRoot, "blobs");
const forwardedArgs = process.argv.slice(2);

function resolveSelectedProfile() {
  const explicitProfile = process.env.PW_PROFILE?.trim().toLowerCase();
  if (explicitProfile) return explicitProfile;

  const selectorPath = resolve(".env.local");
  if (!existsSync(selectorPath)) return undefined;
  return parseEnv(readFileSync(selectorPath, "utf8"))
    .PW_PROFILE?.trim()
    .toLowerCase();
}

function runNodeStep(label, script, args = []) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [resolve(script), ...args], {
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Suite completa interrompida em: ${label}.`);
  }
}

function buildPortalReport() {
  const reportData = resolve(".playwright/prognum-report-data/report.json");
  if (!existsSync(reportData)) return false;

  const result = spawnSync(
    process.execPath,
    [resolve("scripts/run-prognum-report.mjs"), "build"],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  return result.status === 0;
}

function printReportLocations({ provisioningOnly = false } = {}) {
  console.log(
    provisioningOnly
      ? "\nRelatorio do provisionamento: playwright-report/c6-provisioning/index.html"
      : "\nRelatorio consolidado: playwright-report/index.html",
  );
  console.log("Relatorio Portal: portal-report/index.html");
  console.log("Relatorio PDF: output/pdf/playwright-report.pdf");
}

const selectedProfile = resolveSelectedProfile();
const reusePreparedC6Batch =
  process.env.PW_REUSE_C6_PROVISIONING?.trim().toLowerCase() === "true";
const sessionSwitchingReadonlyCases =
  "PROP-07|PROP-08|PROP-09|PROP-10|PROP-11|PROP-12|PROP-17|TIMELINE-05|TIMELINE-06";
const postWorkflowFunctionalCases = "PROP-03";

if (selectedProfile === "ht" && !reusePreparedC6Batch) {
  try {
    runNodeStep(
      "provisionar e preparar massas frescas do C6 HT",
      "scripts/run-c6-fresh-provisioning.mjs",
    );
  } catch (error) {
    if (buildPortalReport()) printReportLocations({ provisioningOnly: true });
    throw error;
  }
} else if (selectedProfile === "ht") {
  console.log(
    "\n=== reutilizar lote C6 HT previamente preparado e publicado ===",
  );
}
runNodeStep(
  "validar configuração publicada",
  "scripts/check-environment-config.mjs",
  ["all"],
);

const phases = [
  {
    name: "portal-readonly-parallel",
    description: "smoke e funcionais readonly com sessão padrão",
    args: [
      "test",
      "--project=smoke",
      "--project=functional-readonly",
      "--grep-invert",
      sessionSwitchingReadonlyCases,
    ],
    env: { PW_FUNCTIONAL_READONLY_WORKERS: "3" },
  },
  {
    name: "portal-readonly-session-switching",
    description: "funcionais readonly que alternam massas e magic links",
    args: [
      "test",
      "--project=functional-readonly",
      "--grep",
      sessionSwitchingReadonlyCases,
    ],
    env: { PW_FUNCTIONAL_READONLY_WORKERS: "1" },
  },
  {
    name: "portal-mutation",
    description: "funcionais mutáveis do Portal",
    args: [
      "test",
      "--project=functional-mutation",
      "--grep-invert",
      postWorkflowFunctionalCases,
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
    env: { PW_INTEGRATION_WORKERS: "1" },
  },
  {
    name: "portal-post-workflow-reflection",
    description: "reflexo no Portal após avanço do workflow no SCCI",
    args: [
      "test",
      "--project=functional-mutation",
      "--grep",
      postWorkflowFunctionalCases,
    ],
  },
  {
    name: "integration-transient",
    description: "validacoes SCCI com edicao temporaria descartada",
    args: ["test", "--project=integration", "--grep", "@transient"],
    env: { PW_INTEGRATION_WORKERS: "1" },
  },
  {
    name: "integration-readonly",
    description: "validacoes SCCI apos as preparacoes",
    args: ["test", "--project=integration", "--grep", "@readonly"],
    env: { PW_INTEGRATION_WORKERS: "1" },
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
        ...phase.env,
        PLAYWRIGHT_BLOB_OUTPUT_DIR: phaseOutput,
      },
      stdio: "inherit",
    },
  );

  if (result.status !== 0) failed = true;

  if (
    selectedProfile === "ht" &&
    phase.name === "integration-mutation" &&
    result.status === 0
  ) {
    runNodeStep(
      "republicar contratos capturados durante as integrações",
      "scripts/run-c6-fresh-provisioning.mjs",
      ["--publish-only"],
    );
  }

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
  [
    "merge-reports",
    "--reporter=html,@prognum/playwright-report/reporter",
    collectedBlobs,
  ],
  {
    env: {
      ...process.env,
      PLAYWRIGHT_HTML_OPEN: "never",
    },
    stdio: "inherit",
  },
);
if (mergeResult.status !== 0) failed = true;

if (mergeResult.status === 0) {
  if (!buildPortalReport()) failed = true;
}

printReportLocations();
process.exitCode = failed ? 1 : 0;
