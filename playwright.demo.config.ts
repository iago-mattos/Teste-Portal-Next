import { defineConfig, devices } from "@playwright/test";
import { loadEnvironmentProfile } from "./tests/config/environment-profile";
import { resolvePortalBaseUrl } from "./tests/config/runtime-config";

loadEnvironmentProfile();

export default defineConfig({
  testDir: "./tests/demo",
  testMatch: "**/apresentacao-simulador.spec.ts",
  outputDir: "demo-results/test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  projects: [
    {
      name: "demo-simulador",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: resolvePortalBaseUrl(),
        viewport: { width: 1920, height: 1080 },
        headless: false,
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
        video: {
          mode: "on",
          size: { width: 1920, height: 1080 },
        },
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
});
