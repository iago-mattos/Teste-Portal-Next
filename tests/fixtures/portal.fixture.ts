import type { Page } from "@playwright/test";
import { ProposalPage } from "../pages/portal/proposal.page";
import { ProposalsPage } from "../pages/portal/proposals.page";
import {
  authTest,
  portalSessionExpiredPattern,
  renewPortalSession,
} from "./auth.fixture";

export interface PortalFixtures {
  authenticatedPage: Page;
  proposalPage: ProposalPage;
  proposalsPage: ProposalsPage;
}

export const portalTest = authTest.extend<PortalFixtures>({
  authenticatedPage: async (
    { authenticatedContext, page, portalConfig },
    use,
  ) => {
    if (page.context() !== authenticatedContext) {
      throw new Error(
        "A pagina do Portal nao pertence ao contexto autenticado do teste.",
      );
    }

    const expiredSessionMessage = page.getByText(portalSessionExpiredPattern);
    await page.addLocatorHandler(expiredSessionMessage, async () => {
      await renewPortalSession(authenticatedContext, portalConfig);
      await page.goto(portalConfig.paths.proposals, {
        waitUntil: "domcontentloaded",
      });
    });

    await use(page);
  },
  proposalPage: async ({ authenticatedPage }, use) => {
    await use(new ProposalPage(authenticatedPage));
  },
  proposalsPage: async ({ authenticatedPage, portalConfig }, use) => {
    await use(
      new ProposalsPage(authenticatedPage, portalConfig.paths.proposals),
    );
  },
});
