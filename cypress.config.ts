import { defineConfig } from "cypress";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  loadAejsConnect,
  loadPortalConnect,
  resolvePortalEnvironment,
  type AejsConnect,
  type PortalConnect,
} from "./cypress/config/runtime-config";

const loadLocalModule = createRequire(__filename);

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
} else if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

function loadLocalExport<T>(
  relativePath: string,
  exportName: string,
): Partial<T> | undefined {
  const absolutePath = resolve(relativePath);
  if (!existsSync(absolutePath)) return undefined;

  const localModule = loadLocalModule(absolutePath) as Record<string, unknown>;
  return localModule[exportName] as Partial<T> | undefined;
}

const portalEnvironment = resolvePortalEnvironment(process.env);
const localPortalConnect = loadLocalExport<PortalConnect>(
  portalEnvironment === "ht"
    ? "cypress/config/connect.ht.ts"
    : "cypress/config/connect.ts",
  "portalConnect",
);
const portalConnect = loadPortalConnect(process.env, localPortalConnect);
const publicPortalConnect: PortalConnect = {
  ...portalConnect,
  accessUrl: "",
  caseAccessUrls: {},
};
const aejsConnect = loadAejsConnect(
  process.env,
  loadLocalExport<AejsConnect>("cypress/config/aejs.ts", "aejsConnect"),
);
const allowMutation = process.env.ALLOW_TEST_MUTATION === "true";
const allowReact418Quarantine =
  process.env.ALLOW_REACT_418_QUARANTINE === "true";
let integrationRunContext: unknown = null;

export default defineConfig({
  allowCypressEnv: false,
  expose: {
    portalConnect: publicPortalConnect,
    portalEnvironment,
  },
  retries: {
    // Magic links sao de uso unico; retry automatico pode consumir o token.
    runMode: 0,
    openMode: 0,
  },
  viewportWidth: 1440,
  viewportHeight: 900,
  defaultCommandTimeout: 10_000,
  requestTimeout: 15_000,
  responseTimeout: 30_000,
  screenshotsFolder: "cypress/screenshots",
  videosFolder: "cypress/videos",
  reporter: "mochawesome",
  reporterOptions: {
    reportDir: "cypress/results",
    overwrite: false,
    html: false,
    json: true,
    charts: true,
    reportPageTitle: "PortalNext - Testes E2E",
  },
  env: {
    aejsConnect,
    allowReact418Quarantine,
    portalConnect,
    portalEnvironment,
  },
  video: true,
  screenshotOnRunFailure: true,
  trashAssetsBeforeRuns: true,
  e2e: {
    baseUrl: portalConnect.portalUrl || undefined,
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    excludeSpecPattern: [
      "cypress/e2e/integracoes/14-preparar-integracao.cy.ts",
      "cypress/e2e/integracoes/15-finalizar-cancelar-integracao.cy.ts",
    ],
    setupNodeEvents(on, config) {
      on("task", {
        readPortalAdminConfig() {
          const values = {
            url: process.env.PORTAL_ADMIN_URL?.trim() ?? "",
            username: process.env.PORTAL_ADMIN_USER ?? "",
            password: process.env.PORTAL_ADMIN_PASSWORD ?? "",
            cpf:
              process.env.PORTAL_TEST_CPF?.replace(/\D/g, "") ??
              portalConnect.testData.cpfComPropostas,
          };

          return Object.values(values).every(Boolean) ? values : null;
        },
        readIntegrationSettings() {
          return {
            caseId: process.env.PORTAL_INTEGRATION_CASE_ID?.trim() ?? "",
            operation:
              process.env.PORTAL_INTEGRATION_OPERATION?.replace(/\D/g, "") ??
              "",
          };
        },
        readIntegrationRunContext() {
          return integrationRunContext;
        },
        writeIntegrationRunContext(value: unknown) {
          integrationRunContext = value;
          return null;
        },
        aejsLog(message: unknown) {
          console.log(`[AEJS] ${String(message)}`);
          return null;
        },
      });

      const caseId =
        (allowMutation ? process.env.PORTAL_INTEGRATION_CASE_ID : undefined) ??
        config.env.caseId;

      if (typeof caseId === "string" && caseId.trim()) {
        const evidenceCaseId = caseId.trim().replace(/[^A-Za-z0-9_-]/g, "_");
        on("after:spec", (spec, results) => {
          if (!results?.video || !existsSync(results.video)) {
            return;
          }

          const evidenceDir = resolve(
            "cypress",
            "evidencias",
            "videos",
            portalEnvironment,
            spec.relative.includes("integracoes")
              ? "integracoes"
              : "funcionais",
          );
          mkdirSync(evidenceDir, { recursive: true });
          const evidenceFileName =
            evidenceCaseId.length <= 120
              ? evidenceCaseId
              : `LOTE-${spec.name.replace(/[^A-Za-z0-9_-]/g, "_")}`;
          copyFileSync(
            results.video,
            resolve(evidenceDir, `${evidenceFileName}.mp4`),
          );
        });

        config.testingType = "e2e";
        config.env = {
          ...config.env,
          aejsConnect,
          portalConnect,
          portalEnvironment,
        };
        if (allowMutation) {
          config.excludeSpecPattern = [];
        }
        config.reporterOptions = {
          ...config.reporterOptions,
          caseId: caseId.trim(),
        };
      }

      return config;
    },
  },
});
