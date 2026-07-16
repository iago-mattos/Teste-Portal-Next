import type { Page, Response, TestInfo } from "@playwright/test";
import { expect, test } from "../../fixtures/test";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import type { PortalSession } from "../../fixtures/portal.fixture";
import { ProposalPage } from "../../pages/portal/proposal.page";
import { ProposalsPage } from "../../pages/portal/proposals.page";
import { getProvisioningSlot } from "../../test-data/provisioning-data";

const coreReadonly = { tag: ["@core", "@readonly"] };

interface AuthorizationMass {
  readonly operation: string;
  readonly applicantName: string;
  readonly ownershipKey: string;
}

interface AuthorizationMasses {
  readonly owned: AuthorizationMass;
  readonly foreign: AuthorizationMass;
}

function normalizeOperation(value: string): string {
  return value.replace(/\D/g, "").padStart(9, "0");
}

function getAuthorizationMasses(
  portalConfig: PortalRuntimeConfig,
): AuthorizationMasses {
  const ownedOperation = normalizeOperation(
    portalConfig.testData.expectedProposal.visibleNumber,
  );
  const foreignOperation = normalizeOperation(
    portalConfig.caseProposalIds.TIMELINE_04_CADASTRO ?? "",
  );
  const ownedKey = portalConfig.testData.operationCpfs[ownedOperation];
  const foreignKey = portalConfig.testData.operationCpfs[foreignOperation];

  if (
    !ownedOperation.replace(/0/g, "") ||
    !foreignOperation.replace(/0/g, "") ||
    !ownedKey ||
    !foreignKey
  ) {
    throw new Error(
      "Configure as operações DEFAULT e TIMELINE_REGISTRATION com ownership conhecido para o CORE-4B.",
    );
  }
  if (ownedKey === foreignKey) {
    throw new Error(
      "A operação B do CORE-4B precisa pertencer comprovadamente a outra identidade.",
    );
  }

  return {
    owned: {
      operation: ownedOperation,
      applicantName: getProvisioningSlot("DEFAULT").applicantName,
      ownershipKey: ownedKey,
    },
    foreign: {
      operation: foreignOperation,
      applicantName: getProvisioningSlot("TIMELINE_REGISTRATION").applicantName,
      ownershipKey: foreignKey,
    },
  };
}

function proposalUrl(portalConfig: PortalRuntimeConfig, operation: string): string {
  return new URL(`/propostas/${operation}`, portalConfig.portalUrl).toString();
}

function isOperationResponse(response: Response, operation: string): boolean {
  const request = response.request();
  return (
    request.method() === "GET" &&
    new URL(response.url()).pathname === `/api/portal/propostas/${operation}`
  );
}

async function expectOwnedProposal(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  mass: AuthorizationMass,
): Promise<void> {
  await portalSession.useOperation(mass.operation);
  const proposalsPage = new ProposalsPage(page, portalConfig.paths.proposals);
  await proposalsPage.open();
  await proposalsPage.loadAll();
  await expect(proposalsPage.getProposalCard(mass.operation)).toBeVisible();
  await proposalsPage.openProposal(mass.operation);
  const proposalPage = new ProposalPage(page);
  await proposalPage.waitUntilReady();
  await expect(proposalPage.heading).toHaveText(`Proposta #${mass.operation}`);
  await expect(proposalPage.proponentInfo).toContainText(mass.applicantName);
}

async function attachDenialEvidence(
  testInfo: TestInfo,
  ownedOperation: string,
  foreignOperation: string,
  response: Response,
): Promise<void> {
  await testInfo.attach("authorization-denial", {
    body: Buffer.from(
      JSON.stringify(
        {
          ownedOperation,
          attemptedForeignOperation: foreignOperation,
          method: response.request().method(),
          pathname: new URL(response.url()).pathname,
          status: response.status(),
          ownershipComparedWithoutPersonalData: true,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
}

test.use({ skipPortalSessionBootstrap: true });

test.describe("Portal Core: autorização horizontal", () => {
  test.beforeEach(() => {
    test.skip(
      process.env.PW_PROFILE !== "esteira-ht",
      "CORE-4B usa massas reais de ownership conhecido da EsteiraHT.",
    );
  });

  test(
    "CORE-4B | sessão A não acessa proposta real pertencente à identidade B",
    coreReadonly,
    async ({ page, portalConfig, portalSession }, testInfo) => {
      const masses = getAuthorizationMasses(portalConfig);
      expect(masses.owned.ownershipKey).not.toBe(masses.foreign.ownershipKey);

      await test.step("confirma acesso válido à proposta da sessão A", async () => {
        await expectOwnedProposal(
          page,
          portalConfig,
          portalSession,
          masses.owned,
        );
      });

      await test.step("confirma que B não aparece na listagem autorizada de A", async () => {
        const proposalsPage = new ProposalsPage(
          page,
          portalConfig.paths.proposals,
        );
        await proposalsPage.open();
        await proposalsPage.loadAll();
        await expect(
          proposalsPage.getProposalCard(masses.foreign.operation),
        ).toHaveCount(0);
      });

      await test.step("tenta B pela URL e valida negação server-side real", async () => {
        const responsePromise = page.waitForResponse((response) =>
          isOperationResponse(response, masses.foreign.operation),
        );
        await page.goto(
          proposalUrl(portalConfig, masses.foreign.operation),
          { waitUntil: "domcontentloaded" },
        );
        const response = await responsePromise;
        await attachDenialEvidence(
          testInfo,
          masses.owned.operation,
          masses.foreign.operation,
          response,
        );

        expect(
          response.status(),
          "A operação B é real e pertence a outra identidade; 404 é o contrato de ocultação do backend.",
        ).toBe(404);
        const responseBody = await response.text();
        expect(responseBody).not.toContain(masses.foreign.applicantName);

        await expect(
          page.getByRole("heading", {
            name: `Proposta #${masses.foreign.operation}`,
            level: 1,
          }),
        ).toHaveCount(0);
        await expect(
          page.getByText(masses.foreign.applicantName, { exact: true }),
        ).toHaveCount(0);
        await expect(page.getByText(/^Proponente:\s*$/i)).toHaveCount(0);
        await expect(
          page.getByRole("region", { name: "Conteudo da subtela" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("heading", { name: "Documentos da proposta" }),
        ).toHaveCount(0);
        await expect(page.locator('[name^="PESSOA"]')).toHaveCount(0);
      });
    },
  );
});
