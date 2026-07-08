import type { Page } from "@playwright/test";
import { ProposalPage } from "../pages/proposal.page";
import { ProposalsPage } from "../pages/proposals.page";
import { authTest } from "./auth.fixture";

export interface PortalFixtures {
  authenticatedPage: Page;
  proposalPage: ProposalPage;
  proposalsPage: ProposalsPage;
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
  proposalPage: async ({ authenticatedPage }, use) => {
    await use(new ProposalPage(authenticatedPage));
  },
  proposalsPage: async ({ authenticatedPage, portalConfig }, use) => {
    await use(
      new ProposalsPage(authenticatedPage, portalConfig.paths.proposals),
    );
  },
});
