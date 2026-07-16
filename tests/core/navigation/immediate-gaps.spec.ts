import type { Locator, Page, Request, Route } from "@playwright/test";
import { expect, test } from "../../fixtures/test";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import type { PortalSession } from "../../fixtures/portal.fixture";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import type { ProposalPage } from "../../pages/portal/proposal.page";
import type { ProposalsPage } from "../../pages/portal/proposals.page";
import { createSizedPdfFile } from "../documents/document-test-files";

const coreReadonly = { tag: ["@core", "@readonly"] };
const coreMutation = { tag: ["@core", "@mutation"] };
const incomeFieldName = "PESSOA.VA_RENDA_BRUTA";

function normalizeOperation(value: string): string {
  return value.replace(/\D/g, "").padStart(9, "0");
}

function isExactRequest(
  request: Request,
  method: string,
  pathname: string,
): boolean {
  return request.method() === method && new URL(request.url()).pathname === pathname;
}

function draftStatus(page: Page, text: string | RegExp): Locator {
  return page
    .getByRole("heading", { name: "Cadastro da Proposta", level: 2 })
    .locator("..")
    .getByText(text);
}

async function openRegistration(
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  proposalsPage: ProposalsPage,
  proposalPage: ProposalPage,
): Promise<string> {
  const operation = normalizeOperation(
    portalConfig.testData.expectedProposal.visibleNumber,
  );
  await portalSession.useOperation(operation);
  await proposalsPage.open();
  await proposalsPage.loadAll();
  await proposalsPage.openProposal(operation);
  await proposalPage.waitUntilReady();
  await expect(proposalPage.heading).toHaveText(`Proposta #${operation}`);
  return operation;
}

async function openDocuments(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  proposalsPage: ProposalsPage,
): Promise<{ documentsPage: ProposalDocumentsPage; operation: string }> {
  const operation = normalizeOperation(
    portalConfig.caseProposalIds.TIMELINE_04_DOCUMENTOS ?? "",
  );
  if (!operation.replace(/0/g, "")) {
    throw new Error("Configure PORTAL_PROPOSAL_TIMELINE_DOCUMENTS.");
  }

  await portalSession.useOperation(operation);
  await proposalsPage.open();
  await proposalsPage.loadAll();
  await proposalsPage.openProposal(operation);

  const viewDocumentation = page.getByRole("button", {
    name: "Ver Documentação",
    exact: true,
  });
  if (await viewDocumentation.isVisible()) await viewDocumentation.click();

  const documentsPage = new ProposalDocumentsPage(page);
  await documentsPage.waitUntilReady();
  return { documentsPage, operation };
}

async function expectEmptyDocumentRow(row: Locator): Promise<void> {
  await expect(row.getByText("Documento enviado", { exact: true })).toHaveCount(0);
  await expect(
    row.getByRole("link", { name: "Ver arquivo", exact: true }),
  ).toHaveCount(0);
  await expect(row.getByText(/Enviando|Carregando|Aguarde/i)).toBeHidden();
}

test.describe("Portal Core: gaps imediatos de navegação e autorização", () => {
  test.beforeEach(() => {
    test.skip(
      process.env.PW_PROFILE !== "esteira-ht",
      "O bloco imediato usa exclusivamente EsteiraHT.",
    );
  });

  test(
    "CORE imediato | mantém continuidade após troca rápida e histórico real",
    coreReadonly,
    async ({ page, portalConfig, portalSession, proposalPage, proposalsPage }) => {
      const operation = await openRegistration(
        portalConfig,
        portalSession,
        proposalsPage,
        proposalPage,
      );
      const income = proposalPage.getFieldByName(incomeFieldName);
      const originalIncome = await income.inputValue();

      for (const tabName of [
        "Composição de Renda",
        "Motivo da Contratação",
        "Imóvel",
        "Sobre Você",
      ] as const) {
        await proposalPage.tabs.select(tabName);
      }

      await expect(
        proposalPage.tabs.getTabButton("Sobre Você"),
      ).toHaveAttribute("aria-selected", "true");
      await expect(proposalPage.getFieldByName(incomeFieldName)).toHaveValue(
        originalIncome,
      );

      await page.goBack({ waitUntil: "domcontentloaded" });
      await proposalsPage.waitUntilReady();
      await expect(proposalsPage.getProposalCard(operation)).toHaveCount(1);

      await page.goForward({ waitUntil: "domcontentloaded" });
      await proposalPage.waitUntilReady();
      await expect(proposalPage.heading).toHaveText(`Proposta #${operation}`);
      await expect(proposalPage.getFieldByName(incomeFieldName)).toHaveValue(
        originalIncome,
      );
    },
  );

  test(
    "CORE imediato | trata HTTP 403 no save e upload sem sucesso falso",
    coreMutation,
    async ({ page, portalConfig, portalSession, proposalPage, proposalsPage }) => {
      const operation = await openRegistration(
        portalConfig,
        portalSession,
        proposalsPage,
        proposalPage,
      );
      const income = proposalPage.getFieldByName(incomeFieldName);
      await income.clear();
      await income.pressSequentially("913579");
      const localValue = await income.inputValue();
      const savePath = `/api/portal/propostas/${operation}/cadastro`;
      const saveMessage = "Acesso negado ao salvar o cadastro.";

      await page.route("**/api/portal/propostas/*/cadastro", async (route) => {
        if (!isExactRequest(route.request(), "PUT", savePath)) {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: saveMessage }),
        });
      });

      try {
        const responsePromise = page.waitForResponse((response) =>
          isExactRequest(response.request(), "PUT", savePath),
        );
        await proposalPage.tabs.select("Composição de Renda");
        expect((await responsePromise).status()).toBe(403);
        await expect(draftStatus(page, /Salvando/i)).toBeHidden();
        await expect(draftStatus(page, "Rascunho salvo")).toBeHidden();
        await proposalPage.tabs.select("Sobre Você");
        await expect(proposalPage.getFieldByName(incomeFieldName)).toHaveValue(
          localValue,
        );
        await expect.soft(
          page.getByText(saveMessage, { exact: true }),
          "HTTP 403 no cadastro deve apresentar feedback explícito.",
        ).toBeVisible();
      } finally {
        await page.unroute("**/api/portal/propostas/*/cadastro");
      }

      const { documentsPage, operation: documentOperation } =
        await openDocuments(
          page,
          portalConfig,
          portalSession,
          proposalsPage,
        );
      const uploadPath = `/api/portal/propostas/${documentOperation}/documentos`;
      const uploadMessage = "Acesso negado ao enviar o documento.";
      const row = documentsPage.getDocumentRowAt(0);

      await page.route("**/api/portal/propostas/*/documentos", async (route: Route) => {
        if (!isExactRequest(route.request(), "POST", uploadPath)) {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ sucesso: false, mensagem: uploadMessage }),
        });
      });

      try {
        const responsePromise = page.waitForResponse((response) =>
          isExactRequest(response.request(), "POST", uploadPath),
        );
        await documentsPage.chooseFilePayloadAt(
          0,
          createSizedPdfFile(2_048, "core-forbidden.pdf"),
        );
        expect((await responsePromise).status()).toBe(403);
        await expectEmptyDocumentRow(row);
        await expect(documentsPage.getUploadButtonAt(0)).toBeEnabled();
        await expect.soft(
          page.getByText(uploadMessage, { exact: true }),
          "HTTP 403 no upload deve apresentar feedback explícito.",
        ).toBeVisible();
      } finally {
        await page.unroute("**/api/portal/propostas/*/documentos");
      }
    },
  );
});
