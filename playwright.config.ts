import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { PORTAL_AUTH_STATE_PATH } from "./tests/config/auth-config";
import { resolvePortalBaseUrl } from "./tests/config/runtime-config";

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
    break;
  }
}

const portalBaseUrl = resolvePortalBaseUrl();
const desktopChromium = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
};

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    [process.env.CI ? "dot" : "list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: portalBaseUrl,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testDir: "./tests/setup",
      testMatch: "**/*.setup.ts",
      workers: 1,
      use: {
        ...desktopChromium,
        screenshot: "off",
        storageState: { cookies: [], origins: [] },
        trace: "off",
        video: "off",
      },
    },
    {
      name: "smoke",
      testDir: "./tests/smoke",
      testMatch: "**/*.spec.ts",
      workers: 1,
      dependencies: ["setup"],
      use: { ...desktopChromium, storageState: PORTAL_AUTH_STATE_PATH },
    },
    {
      name: "functional-readonly",
      testDir: "./tests/functional",
      testMatch: "**/*.spec.ts",
      grep: /@readonly/,
      workers: 1,
      dependencies: ["setup"],
      use: { ...desktopChromium, storageState: PORTAL_AUTH_STATE_PATH },
    },
    {
      name: "functional-mutation",
      testDir: "./tests/functional",
      testMatch: "**/*.spec.ts",
      grep: /@mutation/,
      workers: 1,
      dependencies: ["setup"],
      use: { ...desktopChromium, storageState: PORTAL_AUTH_STATE_PATH },
    },
    {
      name: "integration",
      testDir: "./tests/integrations",
      testMatch: "**/*.spec.ts",
      workers: 1,
      retries: 0,
      timeout: 15 * 60_000,
      dependencies: ["setup"],
      use: { ...desktopChromium, storageState: PORTAL_AUTH_STATE_PATH },
    },
  ],
});
