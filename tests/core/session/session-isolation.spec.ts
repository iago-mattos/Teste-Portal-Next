import type { BrowserContext, Locator, Page, Request, Route } from "@playwright/test";
import { expect, test } from "../../fixtures/test";
import { portalSessionExpiredPattern } from "../../fixtures/auth.fixture";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import { ProposalPage } from "../../pages/portal/proposal.page";
import { ProposalsPage } from "../../pages/portal/proposals.page";
import { getProvisioningSlot } from "../../test-data/provisioning-data";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import type { PortalSession } from "../../fixtures/portal.fixture";
import { createSizedPdfFile } from "../documents/document-test-files";

const coreReadonly = { tag: ["@core", "@readonly"] };
const coreMutation = { tag: ["@core", "@mutation"] };
const incomeFieldName = "PESSOA.VA_RENDA_BRUTA";

interface Core4Mass {
  readonly operation: string;
  readonly applicantName: string;
  readonly purpose: string;
  readonly state: "Cadastro" | "Documentos";
  readonly lifecycle: "reutilizável";
}

interface Core4Masses {
  readonly registration: Core4Mass;
  readonly documents: Core4Mass;
}

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function normalizeOperation(value: string): string {
  return value.replace(/\D/g, "").padStart(9, "0");
}

function getCore4Masses(portalConfig: PortalRuntimeConfig): Core4Masses {
  const registrationSlot = getProvisioningSlot("DEFAULT");
  const documentsSlot = getProvisioningSlot("TIMELINE_DOCUMENTS");
  const registrationOperation = normalizeOperation(
    portalConfig.testData.expectedProposal.visibleNumber,
  );
  const documentsOperation = normalizeOperation(
    portalConfig.caseProposalIds.TIMELINE_04_DOCUMENTOS ?? "",
  );

  if (!registrationOperation.replace(/0/g, "") || !documentsOperation.replace(/0/g, "")) {
    throw new Error(
      "Configure PORTAL_PROPOSAL_DEFAULT e PORTAL_PROPOSAL_TIMELINE_DOCUMENTS para o CORE-4.",
    );
  }

  const registrationCpf =
    portalConfig.testData.operationCpfs[registrationOperation];
  const documentsCpf = portalConfig.testData.operationCpfs[documentsOperation];
  if (!registrationCpf || registrationCpf !== documentsCpf) {
    throw new Error(
      "As massas CORE-4 A/B precisam pertencer ao mesmo CPF autorizado; isso não representa teste de IDOR.",
    );
  }

  return {
    registration: {
      operation: registrationOperation,
      applicantName: registrationSlot.applicantName,
      purpose: "Sessão válida, 401 de rascunho e isolamento A/B.",
      state: "Cadastro",
      lifecycle: "reutilizável",
    },
    documents: {
      operation: documentsOperation,
      applicantName: documentsSlot.applicantName,
      purpose: "401 de upload e isolamento A/B.",
      state: "Documentos",
      lifecycle: "reutilizável",
    },
  };
}

function proposalUrl(portalConfig: PortalRuntimeConfig, operation: string): string {
  return new URL(`/propostas/${operation}`, portalConfig.portalUrl).toString();
}

function isExactRequest(
  request: Request,
  method: string,
  pathname: string,
): boolean {
  return request.method() === method && new URL(request.url()).pathname === pathname;
}

async function expectAuthenticated(
  context: BrowserContext,
  portalConfig: PortalRuntimeConfig,
): Promise<void> {
  const response = await context.request.get(
    new URL(portalConfig.paths.authMe, portalConfig.portalUrl).toString(),
    { failOnStatusCode: false },
  );
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { autenticado?: unknown };
  expect(body.autenticado).toBe(true);
}

async function openProposal(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  mass: Core4Mass,
): Promise<void> {
  await portalSession.useOperation(mass.operation);
  const proposalsPage = new ProposalsPage(page, portalConfig.paths.proposals);
  await proposalsPage.open();
  await proposalsPage.loadAll();
  await proposalsPage.openProposal(mass.operation);
  await expectProposalIdentity(page, mass);
}

function proponentContainer(page: Page): Locator {
  return page.getByText(/^Proponente:\s*$/i).locator("..");
}

async function expectProposalIdentity(page: Page, mass: Core4Mass): Promise<void> {
  await expect(
    page.getByRole("heading", {
      name: `Proposta #${mass.operation}`,
      level: 1,
      exact: true,
    }),
  ).toBeVisible({ timeout: 30_000 });

  const text = (await proponentContainer(page).textContent()) ?? "";
  const applicantName = /Proponente:\s*(.*?)\s*CPF:/i.exec(text)?.[1]?.trim();
  expect(applicantName).toBe(mass.applicantName);
}

async function fulfillUnauthorized(route: Route): Promise<void> {
  await route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({
      success: false,
      message: "Sua sessao expirou. Faca login novamente.",
    }),
  });
}

async function expectNoUploadedDocument(row: Locator): Promise<void> {
  await expect(row.getByText("Documento enviado", { exact: true })).toHaveCount(0);
  await expect(row.getByRole("link", { name: "Ver arquivo", exact: true })).toHaveCount(0);
}

test.use({ skipPortalSessionBootstrap: true });

test.describe("Portal Core: sessão e isolamento", () => {
  test.beforeEach(() => {
    test.skip(
      process.env.PW_PROFILE !== "esteira-ht",
      "CORE-4A usa exclusivamente as massas reutilizáveis registradas da EsteiraHT.",
    );
  });

  test(
    "CORE-4 | nega deep link sem sessão e preserva conteúdo após refresh autenticado",
    coreReadonly,
    async ({ browser, page, portalConfig, portalSession }) => {
      const { registration } = getCore4Masses(portalConfig);

      await test.step("nega conteúdo protegido em contexto vazio", async () => {
        const anonymousContext = await browser.newContext({
          storageState: { cookies: [], origins: [] },
        });
        const anonymousPage = await anonymousContext.newPage();
        try {
          const authResponse = await anonymousContext.request.get(
            new URL(portalConfig.paths.authMe, portalConfig.portalUrl).toString(),
            { failOnStatusCode: false },
          );
          const authBody = (await authResponse.json().catch(() => ({}))) as {
            autenticado?: unknown;
          };
          expect(authBody.autenticado).not.toBe(true);

          await anonymousPage.goto(
            proposalUrl(portalConfig, registration.operation),
            { waitUntil: "domcontentloaded" },
          );
          await expect(
            anonymousPage.getByRole("heading", {
              name: `Proposta #${registration.operation}`,
              level: 1,
            }),
          ).toHaveCount(0);
          await expect(proponentContainer(anonymousPage)).toHaveCount(0);
        } finally {
          await anonymousContext.close();
        }
      });

      await test.step("refresh mantém sessão e identidade da proposta", async () => {
        await openProposal(
          page,
          portalConfig,
          portalSession,
          registration,
        );
        await expectAuthenticated(page.context(), portalConfig);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expectProposalIdentity(page, registration);
        await expectAuthenticated(page.context(), portalConfig);
      });

      await test.step("confirma ausência de logout na superfície protegida atual", async () => {
        await expect(
          page
            .getByRole("button", { name: /^Sair$/i })
            .or(page.getByRole("link", { name: /^Sair$/i })),
        ).toHaveCount(0);
      });
    },
  );

  test(
    "CORE-4 | 401 no rascunho invalida acesso sem confirmar ou persistir salvamento",
    coreMutation,
    async ({ page, portalConfig, portalSession }) => {
      const { registration } = getCore4Masses(portalConfig);
      await openProposal(page, portalConfig, portalSession, registration);
      const proposalPage = new ProposalPage(page);
      await proposalPage.waitUntilReady();
      const income = proposalPage.getFieldByName(incomeFieldName);
      const originalValue = await income.inputValue();
      await income.clear();
      await income.pressSequentially("912345");
      const savePath = `/api/portal/propostas/${registration.operation}/cadastro`;

      await page.route("**/api/portal/propostas/*/cadastro", async (route) => {
        if (!isExactRequest(route.request(), "PUT", savePath)) {
          await route.fallback();
          return;
        }
        await fulfillUnauthorized(route);
      });

      try {
        const responsePromise = page.waitForResponse((response) =>
          isExactRequest(response.request(), "PUT", savePath),
        );
        await proposalPage.tabs.getTabButton("Composição de Renda").click();
        expect((await responsePromise).status()).toBe(401);

        await expect.soft(page.getByText(portalSessionExpiredPattern)).toBeVisible();
        await expect.soft(
          page.getByText("Rascunho salvo", { exact: true }),
        ).toBeHidden();
        await expect.soft(income).toHaveCount(0);
        await expect.soft(
          page.getByRole("heading", {
            name: `Proposta #${registration.operation}`,
            level: 1,
          }),
        ).toHaveCount(0);
      } finally {
        await page.unroute("**/api/portal/propostas/*/cadastro");
      }

      await openProposal(page, portalConfig, portalSession, registration);
      const reopenedProposal = new ProposalPage(page);
      await reopenedProposal.waitUntilReady();
      await expect(reopenedProposal.getFieldByName(incomeFieldName)).toHaveValue(
        originalValue,
      );
    },
  );

  test(
    "CORE-4 | 401 no upload não cria documento e libera nova tentativa",
    coreMutation,
    async ({ page, portalConfig, portalSession }) => {
      const { documents } = getCore4Masses(portalConfig);
      await openProposal(page, portalConfig, portalSession, documents);
      const documentsPage = new ProposalDocumentsPage(page);
      await documentsPage.waitUntilReady();
      const row = documentsPage.getDocumentRowAt(0);
      const uploadPath = `/api/portal/propostas/${documents.operation}/documentos`;

      await page.route("**/api/portal/propostas/*/documentos", async (route) => {
        if (!isExactRequest(route.request(), "POST", uploadPath)) {
          await route.fallback();
          return;
        }
        await fulfillUnauthorized(route);
      });

      try {
        const responsePromise = page.waitForResponse((response) =>
          isExactRequest(response.request(), "POST", uploadPath),
        );
        await documentsPage.chooseFilePayloadAt(
          0,
          createSizedPdfFile(2_048, "core-session-expired.pdf"),
        );
        expect((await responsePromise).status()).toBe(401);

        await expect.soft(page.getByText(portalSessionExpiredPattern)).toBeVisible();
        await expectNoUploadedDocument(row);
        await expect(documentsPage.getUploadButtonAt(0)).toBeEnabled();
      } finally {
        await page.unroute("**/api/portal/propostas/*/documentos");
      }
    },
  );

  test(
    "CORE-4 | propostas A e B do mesmo usuário mantêm identidade e estado isolados",
    coreReadonly,
    async ({ page, portalConfig, portalSession }) => {
      const masses = getCore4Masses(portalConfig);
      await portalSession.useOperation(masses.registration.operation);
      const proposalsPage = new ProposalsPage(page, portalConfig.paths.proposals);

      await proposalsPage.open();
      await proposalsPage.loadAll();
      await expect(
        proposalsPage.getProposalCard(masses.registration.operation),
      ).toBeVisible();
      await expect(
        proposalsPage.getProposalCard(masses.documents.operation),
      ).toBeVisible();

      await proposalsPage.openProposal(masses.registration.operation);
      await expectProposalIdentity(page, masses.registration);
      await expect(
        page.getByRole("heading", { name: "Cadastro da Proposta", level: 2 }),
      ).toBeVisible();

      await proposalsPage.open();
      await proposalsPage.loadAll();
      await proposalsPage.openProposal(masses.documents.operation);
      await expectProposalIdentity(page, masses.documents);
      await expect(
        page.getByRole("heading", { name: "Documentos da proposta", level: 2 }),
      ).toBeVisible();
    },
  );

  test(
    "CORE-4 | resposta atrasada da proposta A não atualiza a proposta B",
    coreReadonly,
    async ({ page, portalConfig, portalSession }) => {
      const masses = getCore4Masses(portalConfig);
      await portalSession.useOperation(masses.registration.operation);
      const releaseA = deferred();
      const requestAStarted = deferred();
      const requestACompleted = deferred();
      const operationAPath = `/api/portal/propostas/${masses.registration.operation}`;

      await page.route("**/api/portal/propostas/*", async (route) => {
        if (!isExactRequest(route.request(), "GET", operationAPath)) {
          await route.fallback();
          return;
        }

        const response = await route.fetch();
        requestAStarted.resolve();
        await releaseA.promise;
        try {
          await route.fulfill({ response });
        } catch {
          // Navegar para B pode cancelar legitimamente a request obsoleta de A.
        } finally {
          requestACompleted.resolve();
        }
      });

      try {
        await page.goto(
          proposalUrl(portalConfig, masses.registration.operation),
          { waitUntil: "domcontentloaded" },
        );
        await requestAStarted.promise;

        await page.goto(proposalUrl(portalConfig, masses.documents.operation), {
          waitUntil: "domcontentloaded",
        });
        await expectProposalIdentity(page, masses.documents);
        await expect(
          page.getByRole("heading", { name: "Documentos da proposta", level: 2 }),
        ).toBeVisible();

        releaseA.resolve();
        await requestACompleted.promise;

        await expect(page).toHaveURL(
          proposalUrl(portalConfig, masses.documents.operation),
        );
        await expectProposalIdentity(page, masses.documents);
        await expect(
          page.getByRole("heading", {
            name: `Proposta #${masses.registration.operation}`,
            level: 1,
          }),
        ).toHaveCount(0);
      } finally {
        releaseA.resolve();
        await page.unroute("**/api/portal/propostas/*");
      }
    },
  );
});
