import type { BrowserContext } from "@playwright/test";
import { configTest } from "./config.fixture";

export interface AuthFixtures {
  authenticatedContext: BrowserContext;
}

export const authTest = configTest.extend<AuthFixtures>({
  authenticatedContext: async ({ context, portalConfig }, use) => {
    const cookies = await context.cookies(portalConfig.portalUrl);
    const hasSession = cookies.some(
      (cookie) => cookie.name === "__Host-session",
    );

    if (!hasSession) {
      throw new Error(
        "O contexto do Portal nao possui uma sessao autenticada. Execute o projeto setup.",
      );
    }

    await use(context);
  },
});
