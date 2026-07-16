import type { Locator, Page, Route } from "@playwright/test";
import { expect, test } from "../../fixtures/test";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import type { PortalSession } from "../../fixtures/portal.fixture";
import type { ProposalsPage } from "../../pages/portal/proposals.page";
import { evaluateCoreCapabilities } from "../../config/core-capabilities";
import {
  createCorruptedPdfFile,
  createDisallowedTextFile,
  createEmptyPdfFile,
  createPngContentNamedAsPdf,
  createSizedPdfFile,
  type GeneratedDocumentFile,
} from "./document-test-files";

const coreMutation = { tag: ["@core", "@mutation"] };
const uploadRoutePattern = "**/api/portal/propostas/*/documentos";

interface CoreDocumentConfig {
  readonly operation: string;
  readonly maximumSizeBytes: number;
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

function getCoreDocumentConfig(
  portalConfig: PortalRuntimeConfig,
): CoreDocumentConfig {
  const operation = portalConfig.testData.coreDocumentOperation.trim();
  const maximumSizeBytes = portalConfig.testData.coreDocumentMaxSizeBytes;
  if (!operation) {
    throw new Error(
      "Configure PORTAL_CORE_DOCUMENT_OPERATION com uma massa documental reutilizavel.",
    );
  }
  if (maximumSizeBytes <= 0) {
    throw new Error(
      "Configure PORTAL_CORE_DOCUMENT_MAX_SIZE_BYTES com o limite exato do ambiente.",
    );
  }
  return { operation, maximumSizeBytes };
}

function isDocumentUpload(route: Route, operation: string): boolean {
  const request = route.request();
  return (
    request.method() === "POST" &&
    new URL(request.url()).pathname ===
      `/api/portal/propostas/${operation}/documentos`
  );
}

async function openCoreDocuments(
  page: Page,
  portalSession: PortalSession,
  proposalsPage: ProposalsPage,
  config: CoreDocumentConfig,
): Promise<ProposalDocumentsPage> {
  await portalSession.useOperation(config.operation);
  await proposalsPage.open();
  await proposalsPage.loadAll();
  await proposalsPage.openProposal(config.operation);

  const viewDocumentation = page.getByRole("button", {
    name: "Ver Documentação",
    exact: true,
  });
  if (await viewDocumentation.isVisible()) await viewDocumentation.click();

  const documentsPage = new ProposalDocumentsPage(page);
  await documentsPage.waitUntilReady();
  return documentsPage;
}

async function expectRowWithoutDocument(row: Locator): Promise<void> {
  await expect(row.getByText("Documento enviado", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    row.getByRole("link", { name: "Ver arquivo", exact: true }),
  ).toHaveCount(0);
}

async function chooseWithControlledFailure(
  page: Page,
  documentsPage: ProposalDocumentsPage,
  operation: string,
  rowIndex: number,
  file: GeneratedDocumentFile,
  status: number,
  message: string,
): Promise<void> {
  let requestCount = 0;
  await page.route(uploadRoutePattern, async (route) => {
    if (!isDocumentUpload(route, operation)) {
      await route.fallback();
      return;
    }
    requestCount += 1;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ sucesso: false, mensagem: message }),
    });
  });

  try {
    const responsePromise = page.waitForResponse((response) => {
      const request = response.request();
      return (
        request.method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/portal/propostas/${operation}/documentos`
      );
    });
    await documentsPage.chooseFilePayloadAt(rowIndex, file);
    const response = await responsePromise;
    expect(response.status()).toBe(status);
    expect(requestCount).toBe(1);
  } finally {
    await page.unroute(uploadRoutePattern);
  }
}

test.use({ skipPortalSessionBootstrap: true });

test.describe("Portal Core: documentos", () => {
  test.beforeEach(() => {
    const capability = evaluateCoreCapabilities(["controlled-document-slot"]);
    test.skip(!capability.enabled, capability.reason);
  });

  test(
    "CORE-3 | aplica o limite configurado nos boundaries sem persistir arquivos",
    coreMutation,
    async ({ authenticatedPage, portalConfig, portalSession, proposalsPage }) => {
      const config = getCoreDocumentConfig(portalConfig);
      const documentsPage = await openCoreDocuments(
        authenticatedPage,
        portalSession,
        proposalsPage,
        config,
      );
      expect(await documentsPage.getDocumentCount()).toBeGreaterThanOrEqual(3);

      const accept = await documentsPage.getFileInputAt(0).getAttribute("accept");
      expect(accept?.split(",").map((value) => value.trim())).toEqual(
        expect.arrayContaining([".pdf", ".jpg", ".jpeg", ".png"]),
      );

      for (const boundary of [
        { label: "limite - 1", size: config.maximumSizeBytes - 1, row: 0 },
        { label: "limite exato", size: config.maximumSizeBytes, row: 1 },
      ]) {
        await test.step(`${boundary.label}: chega ao endpoint de upload`, async () => {
          await chooseWithControlledFailure(
            authenticatedPage,
            documentsPage,
            config.operation,
            boundary.row,
            createSizedPdfFile(
              boundary.size,
              `core-${boundary.label.replaceAll(" ", "-")}.pdf`,
            ),
            500,
            `Falha controlada após ${boundary.label}.`,
          );
          await expect(
            authenticatedPage.getByText(/Arquivo muito grande/i),
          ).toBeHidden();
          await expectRowWithoutDocument(
            documentsPage.getDocumentRowAt(boundary.row),
          );
        });
      }

      await test.step("limite + 1: rejeita antes de enviar ao backend", async () => {
        let unexpectedRequests = 0;
        await authenticatedPage.route(uploadRoutePattern, async (route) => {
          if (!isDocumentUpload(route, config.operation)) {
            await route.fallback();
            return;
          }
          unexpectedRequests += 1;
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ sucesso: false }),
          });
        });

        try {
          await documentsPage.chooseFilePayloadAt(
            2,
            createSizedPdfFile(
              config.maximumSizeBytes + 1,
              "core-limit-plus-one.pdf",
            ),
          );
          await expect(
            authenticatedPage.getByText(/Arquivo muito grande/i),
          ).toBeVisible();
          expect(unexpectedRequests).toBe(0);
          await expectRowWithoutDocument(documentsPage.getDocumentRowAt(2));
        } finally {
          await authenticatedPage.unroute(uploadRoutePattern);
        }
      });
    },
  );

  test(
    "CORE-3 | rejeita arquivo vazio e extensão não permitida sem request",
    coreMutation,
    async ({ authenticatedPage, portalConfig, portalSession, proposalsPage }) => {
      const config = getCoreDocumentConfig(portalConfig);
      const documentsPage = await openCoreDocuments(
        authenticatedPage,
        portalSession,
        proposalsPage,
        config,
      );
      let activeCase = "setup";
      const requestsByCase = new Map<string, number>();

      await authenticatedPage.route(uploadRoutePattern, async (route) => {
        if (!isDocumentUpload(route, config.operation)) {
          await route.fallback();
          return;
        }
        requestsByCase.set(
          activeCase,
          (requestsByCase.get(activeCase) ?? 0) + 1,
        );
        await route.fulfill({
          status: 415,
          contentType: "application/json",
          body: JSON.stringify({ sucesso: false }),
        });
      });

      try {
        for (const invalidCase of [
          { label: "arquivo vazio", file: createEmptyPdfFile(), row: 0 },
          {
            label: "extensão não permitida",
            file: createDisallowedTextFile(),
            row: 1,
          },
        ]) {
          await test.step(invalidCase.label, async () => {
            activeCase = invalidCase.label;
            await documentsPage.chooseFilePayloadAt(
              invalidCase.row,
              invalidCase.file,
            );
            await expect.soft(
              authenticatedPage.getByText(
                /arquivo.*(vazio|inválido|não permitido|formato)/i,
              ),
              `${invalidCase.label} deve apresentar erro explícito`,
            ).toBeVisible();
            await expectRowWithoutDocument(
              documentsPage.getDocumentRowAt(invalidCase.row),
            );
            expect.soft(
              requestsByCase.get(invalidCase.label) ?? 0,
              `${invalidCase.label} não deve chegar ao endpoint`,
            ).toBe(0);
          });
        }
      } finally {
        await authenticatedPage.unroute(uploadRoutePattern);
      }
    },
  );

  test(
    "CORE-3 | trata 413, 415 e conteúdo inválido sem confirmação falsa",
    coreMutation,
    async ({ authenticatedPage, portalConfig, portalSession, proposalsPage }) => {
      const config = getCoreDocumentConfig(portalConfig);
      const documentsPage = await openCoreDocuments(
        authenticatedPage,
        portalSession,
        proposalsPage,
        config,
      );
      const cases = [
        {
          status: 413,
          label: "HTTP 413",
          file: createSizedPdfFile(1024, "core-server-limit.pdf"),
          row: 0,
        },
        {
          status: 415,
          label: "HTTP 415 / conteúdo incompatível",
          file: createPngContentNamedAsPdf(),
          row: 1,
        },
        {
          status: 415,
          label: "HTTP 415 / PDF corrompido",
          file: createCorruptedPdfFile(),
          row: 2,
        },
      ];

      for (const failure of cases) {
        await test.step(failure.label, async () => {
          const message = `Falha controlada ${failure.label}.`;
          await chooseWithControlledFailure(
            authenticatedPage,
            documentsPage,
            config.operation,
            failure.row,
            failure.file,
            failure.status,
            message,
          );
          await expect.soft(
            authenticatedPage.getByText(message, { exact: true }),
          ).toBeVisible();
          await expectRowWithoutDocument(
            documentsPage.getDocumentRowAt(failure.row),
          );
          await expect(documentsPage.getUploadButtonAt(failure.row)).toBeEnabled();
        });
      }
    },
  );

  test(
    "CORE-3 | upload lento bloqueia duplicidade, libera após 500 e permite retry",
    coreMutation,
    async ({ authenticatedPage, portalConfig, portalSession, proposalsPage }) => {
      const config = getCoreDocumentConfig(portalConfig);
      const documentsPage = await openCoreDocuments(
        authenticatedPage,
        portalSession,
        proposalsPage,
        config,
      );
      const releaseFailure = deferred();
      const requestStarted = deferred();
      let requestCount = 0;

      await authenticatedPage.route(uploadRoutePattern, async (route) => {
        if (!isDocumentUpload(route, config.operation)) {
          await route.fallback();
          return;
        }
        requestCount += 1;
        if (requestCount === 1) {
          requestStarted.resolve();
          await releaseFailure.promise;
        }
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            sucesso: false,
            mensagem:
              requestCount === 1
                ? "Falha controlada de upload HTTP 500."
                : "Falha controlada no retry documental.",
          }),
        });
      });

      try {
        const row = documentsPage.getDocumentRowAt(0);
        const firstSelection = documentsPage.chooseFilePayloadAt(
          0,
          createSizedPdfFile(2048, "core-slow-upload.pdf"),
        );
        await requestStarted.promise;

        await expect(row.getByText(/Enviando|Carregando|Aguarde/i)).toBeVisible();
        const duplicateClickSucceeded = await documentsPage
          .getUploadButtonAt(0)
          .click({ timeout: 1_000 })
          .then(
            () => true,
            () => false,
          );
        expect(duplicateClickSucceeded).toBe(false);
        expect(requestCount).toBe(1);

        releaseFailure.resolve();
        await firstSelection;
        await expect(row.getByText(/Enviando|Carregando|Aguarde/i)).toBeHidden();
        await expect.soft(
          authenticatedPage.getByText(
            "Falha controlada de upload HTTP 500.",
            { exact: true },
          ),
        ).toBeVisible();
        await expectRowWithoutDocument(row);
        await expect(documentsPage.getUploadButtonAt(0)).toBeEnabled();

        const retryResponse = authenticatedPage.waitForResponse((response) => {
          const request = response.request();
          return (
            request.method() === "POST" &&
            new URL(response.url()).pathname ===
              `/api/portal/propostas/${config.operation}/documentos`
          );
        });
        await documentsPage.chooseFilePayloadAt(
          0,
          createSizedPdfFile(2048, "core-slow-upload.pdf"),
        );
        expect((await retryResponse).status()).toBe(500);
        expect(requestCount).toBe(2);
        await expectRowWithoutDocument(row);
      } finally {
        releaseFailure.resolve();
        await authenticatedPage.unroute(uploadRoutePattern);
      }
    },
  );
});
