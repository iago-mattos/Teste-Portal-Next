import { defineConfig, devices } from "@playwright/test";
import { loadEnvironmentProfile } from "./tests/config/environment-profile";

loadEnvironmentProfile();

export default defineConfig({
  testDir: "./tests/provisioning",
  testMatch: [
    "**/create-c6-mass.provision.ts",
    "**/prepare-c6-phase.provision.ts",
    "**/prepare-c6-documents.provision.ts",
  ],
  outputDir: "test-results/c6-provisioning",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    [
      "html",
      { open: "never", outputFolder: "playwright-report/c6-provisioning" },
    ],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PORTAL_URL,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    storageState: { cookies: [], origins: [] },
  },
  projects: [
    {
      name: "c6-mass-provisioning",
    },
  ],
});
