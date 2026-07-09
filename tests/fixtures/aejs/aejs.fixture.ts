import { existsSync } from "node:fs";
import { type Page, type BrowserContext } from "@playwright/test";
import { pageErrorsTest } from "../page-errors.fixture";
import {
  loadAejsRuntimeConfig,
  AEJS_AUTH_STATE_PATH,
  type AejsRuntimeConfig,
} from "../../config/aejs-config";

export interface AejsFixtures {
  aejsContext: BrowserContext;
  aejsPage: Page;
}

export interface AejsWorkerFixtures {
  aejsConfig: AejsRuntimeConfig;
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
    if (!existsSync(AEJS_AUTH_STATE_PATH)) {
      throw new Error(
        "Erro: O estado de autenticacao do AEJS nao existe. Execute o setup do AEJS antes de rodar os testes de integracao.",
      );
    }

    const context = await browser.newContext({
      storageState: AEJS_AUTH_STATE_PATH,
      viewport: { width: 1440, height: 900 },
    });

    await use(context);
    await context.close();
  },

  aejsPage: async ({ aejsContext }, use) => {
    const page = await aejsContext.newPage();
    await use(page);
  },
});

export { expect } from "@playwright/test";
