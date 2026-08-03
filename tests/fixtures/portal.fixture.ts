import type {
  BrowserContext,
  Page,
  TestInfo,
} from "@playwright/test";
import { ProposalPage } from "../pages/portal/proposal.page";
import { ProposalsPage } from "../pages/portal/proposals.page";
import {
  authTest,
  portalSessionExpiredPattern,
  renewPortalSession,
  restorePortalOperationSession,
} from "./auth.fixture";
import { attachContextScreenshots } from "./evidence";

export interface PortalFixtures {
  authenticatedPage: Page;
  portalSession: PortalSession;
  proposalPage: ProposalPage;
  proposalsPage: ProposalsPage;
}

export interface PortalSession {
  useOperation(
    operationNumber: string,
    options?: Readonly<{ fresh?: boolean }>,
  ): Promise<void>;
  renewCurrent(): Promise<void>;
}

async function stopAndAttachPortalTrace(
  context: BrowserContext,
  testInfo: TestInfo,
): Promise<void> {
  const tracePath = testInfo.outputPath("trace-portal.zip");
  await context.tracing.stop({ path: tracePath });
  await testInfo.attach("trace-portal", {
    path: tracePath,
    contentType: "application/zip",
  });
}

export const portalTest = authTest.extend<PortalFixtures>({
  portalSession: async (
    { authenticatedContext, portalConfig },
    use,
    testInfo,
  ) => {
    let currentCpf: string | undefined;
    let traceStarted = false;
    const manuallyTraceIntegration = testInfo.project.name === "integration";

    const startIntegrationTrace = async (): Promise<void> => {
      if (!manuallyTraceIntegration || traceStarted) return;
      await authenticatedContext.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
      traceStarted = true;
    };

    const renewCurrent = async (): Promise<void> => {
      if (traceStarted) {
        await authenticatedContext.tracing.stop();
        traceStarted = false;
      }
      await renewPortalSession(authenticatedContext, portalConfig, {
        cpf: currentCpf,
        persist: true,
      });
      await startIntegrationTrace();
    };

    try {
      await use({
        async useOperation(operationNumber, options) {
          const normalizedOperation = operationNumber.replace(/\D/g, "");
          const cpf = portalConfig.testData.operationCpfs[normalizedOperation];
          if (!cpf) {
            throw new Error(
              `CPF nao configurado para a operacao ${operationNumber}. Publique PORTAL_MASS_OPERATION_CPFS_JSON.`,
            );
          }
          currentCpf = cpf;
          if (options?.fresh) {
            await renewCurrent();
            return;
          }
          const restored = await restorePortalOperationSession(
            authenticatedContext,
            portalConfig,
            cpf,
          );
          if (!restored) {
            await renewCurrent();
          } else {
            await startIntegrationTrace();
          }
        },
        renewCurrent,
      });
    } finally {
      if (traceStarted) {
        await attachContextScreenshots(
          authenticatedContext,
          testInfo,
          "evidencia-final-portal",
        );
        await stopAndAttachPortalTrace(
          authenticatedContext,
          testInfo,
        );
        traceStarted = false;
      }
    }
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
