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

const portalSessionCachePath = resolve(
  ".codex-tmp",
  "portal-session-cookie.json",
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
        writePortalSessionCookie(value: unknown) {
          const session = value as { accessUrl?: string };
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
            JSON.stringify({ sessions }, null, 2),
            "utf8",
          );
          return null;
        },
      });

      const caseId = config.env.caseId;

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
        config.env = { portalEnvironment };
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
