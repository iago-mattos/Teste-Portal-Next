import { expect, type Page, type BrowserContext } from "@playwright/test";
import { pageErrorsTest } from "../page-errors.fixture";
import {
  assertAejsRuntimeConfig,
  loadAejsRuntimeConfig,
  type AejsRuntimeConfig,
} from "../../config/aejs-config";

export interface AejsFixtures {
  aejsContext: BrowserContext;
  aejsPage: Page;
}

export interface AejsWorkerFixtures {
  aejsConfig: AejsRuntimeConfig;
}

async function authenticateAejsPage(
  page: Page,
  config: AejsRuntimeConfig,
): Promise<void> {
  await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });

  if (config.usePlatformAccess) {
    const platformAccessButton = page.getByText("Acesso via Plataforma", {
      exact: true,
    });
    await expect(platformAccessButton).toBeVisible({ timeout: 30_000 });
    await platformAccessButton.click();
  }

  const usernameInput = page.locator('input[name="name"]:visible');
  const passwordInput = page.locator('input[name="password"]:visible');
  await expect(usernameInput).toBeVisible({ timeout: 30_000 });
  await expect(passwordInput).toBeVisible();
  await usernameInput.fill(config.username);
  await passwordInput.fill(config.password);

  if (config.path) {
    const pathInput = page.getByRole("textbox", {
      name: "Ambiente:",
      exact: true,
    });
    await expect(pathInput).toBeVisible();
    await pathInput.fill(config.path);
  }

  const loginButton = page.getByText("Login", { exact: true });
  await expect(loginButton).toBeVisible();
  await loginButton.click();

  await expect(page.getByText("Originação", { exact: true })).toBeVisible({
    timeout: 40_000,
  });
}

export const aejsTest = pageErrorsTest.extend<AejsFixtures, AejsWorkerFixtures>({
  aejsConfig: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(loadAejsRuntimeConfig());
    },
    { scope: "worker" },
  ],

  aejsContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    await use(context);
    await context.close();
  },

  aejsPage: async ({ aejsContext, aejsConfig }, use) => {
    const page = await aejsContext.newPage();
    assertAejsRuntimeConfig(aejsConfig);
    await authenticateAejsPage(page, aejsConfig);
    await use(page);
  },
});

export { expect } from "@playwright/test";
