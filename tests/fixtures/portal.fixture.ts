import type { Page } from "@playwright/test";
import { ProposalPage } from "../pages/portal/proposal.page";
import { ProposalsPage } from "../pages/portal/proposals.page";
import {
  authTest,
  portalSessionExpiredPattern,
  renewPortalSession,
  restorePortalOperationSession,
} from "./auth.fixture";

export interface PortalFixtures {
  authenticatedPage: Page;
  portalSession: PortalSession;
  proposalPage: ProposalPage;
  proposalsPage: ProposalsPage;
}

export interface PortalSession {
  useOperation(operationNumber: string): Promise<void>;
  renewCurrent(): Promise<void>;
}

export const portalTest = authTest.extend<PortalFixtures>({
  portalSession: async (
    { authenticatedContext, portalConfig },
    use,
  ) => {
    let currentCpf: string | undefined;

    const renewCurrent = async (): Promise<void> => {
      await renewPortalSession(authenticatedContext, portalConfig, {
        cpf: currentCpf,
        persist: true,
      });
    };

    await use({
      async useOperation(operationNumber) {
        const normalizedOperation = operationNumber.replace(/\D/g, "");
        const cpf = portalConfig.testData.operationCpfs[normalizedOperation];
        if (!cpf) {
          throw new Error(
            `CPF nao configurado para a operacao ${operationNumber}. Publique PORTAL_MASS_OPERATION_CPFS_JSON.`,
          );
        }
        currentCpf = cpf;
        const restored = await restorePortalOperationSession(
          authenticatedContext,
          portalConfig,
          cpf,
        );
        if (!restored) await renewCurrent();
      },
      renewCurrent,
    });
  },
  authenticatedPage: async (
    { authenticatedContext, page, portalConfig, portalSession },
    use,
  ) => {
    if (page.context() !== authenticatedContext) {
      throw new Error(
        "A pagina do Portal nao pertence ao contexto autenticado do teste.",
      );
    }

    const expiredSessionMessage = page.getByText(portalSessionExpiredPattern);
    await page.addLocatorHandler(expiredSessionMessage, async () => {
      const currentUrl = page.url();
      const portalOrigin = new URL(portalConfig.portalUrl).origin;
      let returnUrl = portalConfig.paths.proposals;

      try {
        const parsedCurrentUrl = new URL(currentUrl);
        if (parsedCurrentUrl.origin === portalOrigin) {
          returnUrl = parsedCurrentUrl.toString();
        }
      } catch {
        // A pagina ainda pode estar sem uma URL navegavel; nesse caso volta à listagem.
      }

      await portalSession.renewCurrent();
      await page.goto(returnUrl, {
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
