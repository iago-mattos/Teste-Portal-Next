import { defineConfig, devices } from "@playwright/test";
import { loadEnvironmentProfile } from "./tests/config/environment-profile";
import { resolvePortalBaseUrl } from "./tests/config/runtime-config";

loadEnvironmentProfile();

export default defineConfig({
  testDir: "./tests/provisioning",
  outputDir: "test-results/provisioning",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/provisioning" }],
    [
      "@prognum/playwright-report/reporter",
      { outputDir: ".playwright/prognum-report-data" },
    ],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: resolvePortalBaseUrl(),
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: { mode: "on", fullPage: true },
    trace: "retain-on-failure",
    video: "retain-on-failure",
    storageState: { cookies: [], origins: [] },
  },
  projects: [
    {
      name: "core-mass-provisioning",
      testMatch: "**/prepare-core-masses.provision.ts",
    },
  ],
});
