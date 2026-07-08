import type { Page } from "@playwright/test";
import { authTest } from "./auth.fixture";

export interface PortalFixtures {
  authenticatedPage: Page;
}

export const portalTest = authTest.extend<PortalFixtures>({
  authenticatedPage: async ({ authenticatedContext, page }, use) => {
    if (page.context() !== authenticatedContext) {
      throw new Error(
        "A pagina do Portal nao pertence ao contexto autenticado do teste.",
      );
    }

    await use(page);
  },
});
