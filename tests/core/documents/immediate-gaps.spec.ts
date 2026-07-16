import type { Locator, Page, Request, Route } from "@playwright/test";
import { expect, test } from "../../fixtures/test";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import type { PortalSession } from "../../fixtures/portal.fixture";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import type { ProposalsPage } from "../../pages/portal/proposals.page";
import {
  createSizedPdfFile,
  type GeneratedDocumentFile,
} from "./document-test-files";
import { evaluateCoreCapabilities } from "../../config/core-capabilities";

const coreMutation = { tag: ["@core", "@mutation"] };
const uploadRoutePattern = "**/api/portal/propostas/*/documentos";

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

function documentOperation(portalConfig: PortalRuntimeConfig): string {
  const operation = normalizeOperation(
    portalConfig.testData.coreMasses.documents.operation,
  );
  if (!operation.replace(/0/g, "")) {
    throw new Error("Configure PORTAL_CORE_DOCUMENTS_OPERATION.");
  }
  return operation;
}

function isUploadRequest(request: Request, operation: string): boolean {
  return (
    request.method() === "POST" &&
    new URL(request.url()).pathname ===
      `/api/portal/propostas/${operation}/documentos`
  );
}

async function openDocuments(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  proposalsPage: ProposalsPage,
): Promise<{ documentsPage: ProposalDocumentsPage; operation: string }> {
  const operation = documentOperation(portalConfig);
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

async function expectEmptyRow(row: Locator): Promise<void> {
  await expect(row.getByText("Documento enviado", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    row.getByRole("link", { name: "Ver arquivo", exact: true }),
  ).toHaveCount(0);
  await expect(row.getByText(/Enviando|Carregando|Aguarde/i)).toBeHidden();
}

function invalidFile(name: string): GeneratedDocumentFile {
  return {
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nportal-core\n%%EOF\n", "ascii"),
  };
}

test.describe("Portal Core: gaps imediatos de documentos", () => {
  test.beforeEach(() => {
    const capability = evaluateCoreCapabilities([
      "same-owner-registration-documents",
    ]);
    test.skip(!capability.enabled, capability.reason);
  });

  test(
    "CORE imediato | preserva nomes válidos e rejeita seleções inválidas sem upload",
    coreMutation,
    async ({ page, portalConfig, portalSession, proposalsPage }) => {
      const { documentsPage, operation } = await openDocuments(
        page,
        portalConfig,
        portalSession,
        proposalsPage,
      );
      const validName = "relatório ç (final).v1.pdf";
      const validStarted = deferred();
      const releaseValid = deferred();
      let uploadRequests = 0;
      let validRequestBody = "";

      await page.route(uploadRoutePattern, async (route) => {
        if (!isUploadRequest(route.request(), operation)) {
          await route.fallback();
          return;
        }
        uploadRequests += 1;
        if (uploadRequests === 1) {
          validRequestBody =
            route.request().postDataBuffer()?.toString("utf8") ?? "";
          validStarted.resolve();
          await releaseValid.promise;
        }
        await route.fulfill({
          status: uploadRequests === 1 ? 500 : 415,
          contentType: "application/json",
          body: JSON.stringify({
            sucesso: false,
            mensagem: "Falha controlada sem persistência documental.",
          }),
        });
      });

      try {
        const documentCount = await documentsPage.getDocumentCount();
        expect(documentCount).toBeGreaterThanOrEqual(2);
        const validSelection = documentsPage.chooseFilePayloadAt(
          0,
          createSizedPdfFile(2_048, validName),
        );
        await validStarted.promise;
        await expect
          .poll(() =>
            documentsPage
              .getFileInputAt(0)
              .evaluate(
                (input) => (input as HTMLInputElement).files?.[0]?.name,
              ),
          )
          .toBe(validName);
        releaseValid.resolve();
        await validSelection;

        expect(uploadRequests).toBe(1);
        expect(validRequestBody.includes(validName)).toBe(true);
        await expectEmptyRow(documentsPage.getDocumentRowAt(0));

        const requestsBeforeCancel = uploadRequests;
        const chooserPromise = page.waitForEvent("filechooser");
        await documentsPage.getUploadButtonAt(1).click();
        const chooser = await chooserPromise;
        await chooser.setFiles([]);
        expect(uploadRequests).toBe(requestsBeforeCancel);
        await expectEmptyRow(documentsPage.getDocumentRowAt(1));

        for (const [index, name] of [
          "arquivo-sem-extensao",
          "arquivo.pdf.exe",
        ].entries()) {
          const invalidCase = {
            row: Math.min(index + 2, documentCount - 1),
            name,
          };
          const requestsBeforeInvalid = uploadRequests;
          await documentsPage.chooseFilePayloadAt(
            invalidCase.row,
            invalidFile(invalidCase.name),
          );
          await expectEmptyRow(documentsPage.getDocumentRowAt(invalidCase.row));
          expect.soft(
            uploadRequests,
            `${invalidCase.name} deve ser rejeitado antes do endpoint de upload.`,
          ).toBe(requestsBeforeInvalid);
          await expect.soft(
            page.getByText(
              /arquivo.*(?:inválido|não permitido)|formato.*(?:inválido|não permitido)/i,
            ),
            `${invalidCase.name} deve produzir feedback explícito.`,
          ).toBeVisible();
        }
      } finally {
        releaseValid.resolve();
        await page.unroute(uploadRoutePattern);
      }
    },
  );

  test(
    "CORE imediato | recupera a UI após abort antes e durante o upload",
    coreMutation,
    async ({ page, portalConfig, portalSession, proposalsPage }) => {
      const { documentsPage, operation } = await openDocuments(
        page,
        portalConfig,
        portalSession,
        proposalsPage,
      );
      const requestStarted = deferred();
      const releaseInFlight = deferred();
      let requestCount = 0;

      await page.route(uploadRoutePattern, async (route: Route) => {
        if (!isUploadRequest(route.request(), operation)) {
          await route.fallback();
          return;
        }
        requestCount += 1;
        if (requestCount === 1) {
          await route.abort("failed");
          return;
        }
        if (requestCount === 2) {
          requestStarted.resolve();
          await releaseInFlight.promise;
          await route.abort("connectionreset");
          return;
        }
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            sucesso: false,
            mensagem: "Retry controlado alcançou o backend.",
          }),
        });
      });

      const file = createSizedPdfFile(2_048, "core-network-retry.pdf");
      const row = documentsPage.getDocumentRowAt(0);
      try {
        const firstFailure = page.waitForEvent("requestfailed", {
          predicate: (request) => isUploadRequest(request, operation),
        });
        await documentsPage.chooseFilePayloadAt(0, file);
        await firstFailure;
        expect(requestCount).toBe(1);
        await expectEmptyRow(row);
        await expect(documentsPage.getUploadButtonAt(0)).toBeEnabled();

        const secondFailure = page.waitForEvent("requestfailed", {
          predicate: (request) => isUploadRequest(request, operation),
        });
        const inFlightSelection = documentsPage.chooseFilePayloadAt(0, file);
        await requestStarted.promise;
        await expect(row.getByText(/Enviando|Carregando|Aguarde/i)).toBeVisible();
        releaseInFlight.resolve();
        await inFlightSelection;
        await secondFailure;
        expect(requestCount).toBe(2);
        await expectEmptyRow(row);
        await expect(documentsPage.getUploadButtonAt(0)).toBeEnabled();

        const retryResponse = page.waitForResponse(
          (response) =>
            isUploadRequest(response.request(), operation) &&
            response.status() === 500,
        );
        await documentsPage.chooseFilePayloadAt(0, file);
        await retryResponse;
        expect(requestCount).toBe(3);
        await expectEmptyRow(row);
        await expect(documentsPage.getUploadButtonAt(0)).toBeEnabled();
      } finally {
        releaseInFlight.resolve();
        await page.unroute(uploadRoutePattern);
      }
    },
  );
});
