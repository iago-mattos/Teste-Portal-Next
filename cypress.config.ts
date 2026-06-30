import { defineConfig } from "cypress";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
  portalConnect,
  portalEnvironment,
} from "./cypress/config/active-connect";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
} else if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const portalSessionCachePath = resolve(
  ".codex-tmp",
  "portal-session-cookie.json",
);
const integrationRunContextPath = resolve(
  ".codex-tmp",
  "integration-run-context.json",
);

export default defineConfig({
  allowCypressEnv: false,
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
    portalEnvironment,
  },
  video: true,
  screenshotOnRunFailure: true,
  trashAssetsBeforeRuns: true,
  e2e: {
    baseUrl: portalConnect.portalUrl || undefined,
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
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
        readPortalSessionCookie(accessUrl: unknown) {
          if (!existsSync(portalSessionCachePath)) {
            return null;
          }

          const cache = JSON.parse(
            readFileSync(portalSessionCachePath, "utf8"),
          ) as {
            accessUrl?: string;
            sessions?: Record<string, unknown>;
          };

          if (typeof accessUrl !== "string") {
            return null;
          }

          if (cache.sessions) {
            return cache.sessions[accessUrl] ?? null;
          }

          return cache.accessUrl === accessUrl ? cache : null;
        },
        readLatestPortalSession(request: unknown) {
          if (!existsSync(portalSessionCachePath)) {
            return null;
          }

          const expected = request as { portalUrl?: string; cpf?: string };
          const cache = JSON.parse(
            readFileSync(portalSessionCachePath, "utf8"),
          ) as {
            latestPortalSession?: {
              accessUrl?: string;
              cpf?: string;
            };
          };
          const latest = cache.latestPortalSession;

          if (
            !latest?.accessUrl ||
            !expected.portalUrl ||
            !latest.accessUrl.startsWith(`${expected.portalUrl}/?`) ||
            (expected.cpf && latest.cpf !== expected.cpf)
          ) {
            return null;
          }

          return latest;
        },
        writePortalSessionCookie(value: unknown) {
          const session = value as { accessUrl?: string; cpf?: string };
          if (!session.accessUrl) {
            throw new Error("Sessao sem accessUrl nao pode ser armazenada.");
          }

          let sessions: Record<string, unknown> = {};
          if (existsSync(portalSessionCachePath)) {
            const current = JSON.parse(
              readFileSync(portalSessionCachePath, "utf8"),
            ) as {
              accessUrl?: string;
              sessions?: Record<string, unknown>;
            };
            sessions = current.sessions ?? {};
            if (current.accessUrl) {
              sessions[current.accessUrl] = current;
            }
          }

          sessions[session.accessUrl] = value;
          mkdirSync(dirname(portalSessionCachePath), { recursive: true });
          writeFileSync(
            portalSessionCachePath,
            JSON.stringify({ sessions, latestPortalSession: value }, null, 2),
            "utf8",
          );
          return null;
        },
        readIntegrationRunContext() {
          if (!existsSync(integrationRunContextPath)) {
            return null;
          }

          return JSON.parse(readFileSync(integrationRunContextPath, "utf8"));
        },
        writeIntegrationRunContext(value: unknown) {
          mkdirSync(dirname(integrationRunContextPath), { recursive: true });
          writeFileSync(
            integrationRunContextPath,
            JSON.stringify(value, null, 2),
            "utf8",
          );
          return null;
        },
        aejsLog(message: unknown) {
          console.log(`[AEJS] ${String(message)}`);
          return null;
        },
      });

      const caseId =
        process.env.PORTAL_INTEGRATION_CASE_ID ?? config.env.caseId;

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
        config.env = { ...config.env, portalEnvironment };
        config.excludeSpecPattern = [];
        config.reporterOptions = {
          ...config.reporterOptions,
          caseId: caseId.trim(),
        };
      }

      return config;
    },
  },
});
