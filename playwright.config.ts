import { defineConfig, devices } from "@playwright/test";
import { PORTAL_AUTH_STATE_PATH } from "./tests/config/auth-config";
import { loadEnvironmentProfile } from "./tests/config/environment-profile";
import { resolvePortalBaseUrl } from "./tests/config/runtime-config";

loadEnvironmentProfile();

const portalBaseUrl = resolvePortalBaseUrl();
const includeConsumableTests = process.env.PW_INCLUDE_CONSUMABLE === "true";
const functionalReadonlyWorkers = Number.parseInt(
  process.env.PW_FUNCTIONAL_READONLY_WORKERS ?? "3",
  10,
);
const integrationWorkers = Number.parseInt(
  process.env.PW_INTEGRATION_WORKERS ?? "1",
  10,
);
const desktopChromium = {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
};

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 3,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    [process.env.CI ? "dot" : "list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    [
      "@prognum/playwright-report/reporter",
      { outputDir: ".playwright/prognum-report-data" },
    ],
  ],
  use: {
    baseURL: portalBaseUrl,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: { mode: "on", fullPage: true },
    trace: "on",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testDir: "./tests/setup",
      testMatch: "**/*.setup.ts",
      testIgnore: "**/aejs-auth.setup.ts",
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
      name: "aejs-setup",
      testDir: "./tests/setup",
      testMatch: "**/aejs-auth.setup.ts",
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
      workers: functionalReadonlyWorkers,
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
      name: "core",
      testDir: "./tests/core",
      testMatch: "**/*.spec.ts",
      testIgnore: [
        "mobile/**/*.spec.ts",
        ...(includeConsumableTests ? [] : ["consumable/**/*.spec.ts"]),
      ],
      grep: /@core/,
      workers: 1,
      retries: 0,
      timeout: 3 * 60_000,
      dependencies: ["setup"],
      use: { ...desktopChromium, storageState: PORTAL_AUTH_STATE_PATH },
    },
    {
      name: "core-mobile",
      testDir: "./tests/core/mobile",
      testMatch: "**/*.spec.ts",
      grep: /@core/,
      workers: 1,
      retries: 0,
      timeout: 3 * 60_000,
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 7"],
        storageState: PORTAL_AUTH_STATE_PATH,
      },
    },
    {
      name: "integration",
      testDir: "./tests/integrations",
      testMatch: "**/*.spec.ts",
      testIgnore: "**/create-and-validate-simulation.spec.ts",
      workers: integrationWorkers,
      retries: 0,
      timeout: 15 * 60_000,
      dependencies: ["aejs-setup"],
      use: {
        ...desktopChromium,
        storageState: { cookies: [], origins: [] },
        screenshot: "off",
        trace: "off",
      },
    },
    {
      name: "simulator-integration",
      testDir: "./tests/integrations",
      testMatch: "**/create-and-validate-simulation.spec.ts",
      workers: 1,
      retries: 0,
      timeout: 15 * 60_000,
      dependencies: ["aejs-setup"],
      use: {
        ...desktopChromium,
        storageState: { cookies: [], origins: [] },
        screenshot: "off",
        trace: "off",
      },
    },
  ],
});
