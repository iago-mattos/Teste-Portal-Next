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
const provisioningBlobRoot = resolve(outputRoot, "provisioning-blobs");
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

// Cada invocação de `playwright test` feita pelo provisionamento grava seu
// próprio blob em `provisioning-blobs/<etapa>-<slot>/`. Aqui eles são
// recolhidos para `collectedBlobs` com nomes únicos, sem apagar nada, para
// que a criação pelo simulador entre no relatório consolidado final mesmo se
// o lote falhar no meio.
function collectProvisioningBlobs() {
  if (!existsSync(provisioningBlobRoot)) return;

  for (const stepDirectory of readdirSync(provisioningBlobRoot, {
    withFileTypes: true,
  })) {
    if (!stepDirectory.isDirectory()) continue;
    const stepPath = resolve(provisioningBlobRoot, stepDirectory.name);
    for (const file of readdirSync(stepPath, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith(".zip")) continue;
      copyFileSync(
        resolve(stepPath, file.name),
        resolve(collectedBlobs, `provisioning-${stepDirectory.name}-${file.name}`),
      );
    }
  }
}

function mergeReports() {
  const mergeResult = spawnSync(
    playwrightBin,
    [
      "merge-reports",
      "--reporter=html,@prognum/playwright-report/reporter,./scripts/casos-de-teste/reporter.mjs",
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
  if (mergeResult.status !== 0) return false;
  return buildPortalReport();
}

const selectedProfile = resolveSelectedProfile();
const reusePreparedBatch =
  process.env.PW_REUSE_C6_PROVISIONING?.trim().toLowerCase() === "true" ||
  process.env.PW_REUSE_PROVISIONING?.trim().toLowerCase() === "true";
const usesFreshC6Provisioning = selectedProfile === "ht";
const usesFreshEsteiraHtProvisioning = selectedProfile === "esteira-ht";
const usesFreshProvisioning =
  usesFreshC6Provisioning || usesFreshEsteiraHtProvisioning;
const freshProvisioningScript = usesFreshC6Provisioning
  ? "scripts/run-c6-fresh-provisioning.mjs"
  : "scripts/run-esteira-ht-fresh-provisioning.mjs";
const sessionSwitchingReadonlyCases =
  "PROP-08|PROP-09|PROP-17|TIMELINE-05";
const postWorkflowFunctionalCases = "PROP-03";
const externalStateTag = "@external-state";
const parallelReadonlyExclusions = `${sessionSwitchingReadonlyCases}|${externalStateTag}`;

// A suíte principal cria e valida somente estados reproduzíveis. Expiração e
// cancelamento continuam em um comando separado porque dependem de preparação
// externa de banco/SSH.
process.env.PW_EXCLUDE_EXTERNAL_STATES = "true";

// O diretório de blobs é inicializado antes do provisionamento (e não
// apagado depois) para que a criação das massas pelo simulador — o foco do
// fluxo — entre no relatório consolidado final, inclusive se o lote falhar
// no meio do caminho.
rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(collectedBlobs, { recursive: true });
mkdirSync(provisioningBlobRoot, { recursive: true });
process.env.PW_PROVISIONING_BLOB_ROOT = provisioningBlobRoot;

if (usesFreshProvisioning && !reusePreparedBatch) {
  try {
    runNodeStep(
      `provisionar e preparar massas frescas do perfil ${selectedProfile}`,
      freshProvisioningScript,
      forwardedArgs,
    );
  } catch (error) {
    collectProvisioningBlobs();
    const reportBuilt = mergeReports();
    if (reportBuilt) printReportLocations({ provisioningOnly: true });
    throw error;
  }
  collectProvisioningBlobs();
} else if (usesFreshProvisioning) {
  console.log(
    `\n=== reutilizar lote ${selectedProfile} previamente preparado e publicado ===`,
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
      parallelReadonlyExclusions,
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
    args: [
      "test",
      "--project=integration",
      "--grep",
      "@readonly",
      "--grep-invert",
      externalStateTag,
    ],
    env: { PW_INTEGRATION_WORKERS: "1" },
  },
];

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
    usesFreshProvisioning &&
    phase.name === "integration-mutation" &&
    result.status === 0
  ) {
    runNodeStep(
      "republicar contratos capturados durante as integrações",
      freshProvisioningScript,
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

if (!mergeReports()) failed = true;

printReportLocations();
process.exitCode = failed ? 1 : 0;
