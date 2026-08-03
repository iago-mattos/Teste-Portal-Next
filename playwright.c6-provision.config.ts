import { defineConfig, devices } from "@playwright/test";
import { loadEnvironmentProfile } from "./tests/config/environment-profile";

loadEnvironmentProfile();

export default defineConfig({
  testDir: "./tests/provisioning",
  testMatch: [
    "**/create-c6-mass.provision.ts",
    "**/prepare-c6-property.provision.ts",
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
    [
      "@prognum/playwright-report/reporter",
      { outputDir: ".playwright/prognum-report-data" },
    ],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PORTAL_URL,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: { mode: "on", fullPage: true },
    // A fixture do SCCI inicia o trace somente depois do login para não
    // registrar credenciais. O trace automático concorreria com essa captura.
    trace: "off",
    video: "retain-on-failure",
    storageState: { cookies: [], origins: [] },
  },
  projects: [
    {
      name: "c6-mass-provisioning",
    },
  ],
});
