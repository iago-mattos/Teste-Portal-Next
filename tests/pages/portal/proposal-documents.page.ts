import {
  expect,
  type APIResponse,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";

export interface OpenedPortalDocument {
  readonly popup: Page;
  readonly response: APIResponse;
}

/** Jornada de documentos de uma proposta já posicionada na fase documental. */
export class ProposalDocumentsPage {
  readonly heading: Locator;
  readonly totalDocuments: Locator;
  readonly pendingDocuments: Locator;
  readonly completedDocuments: Locator;
  readonly sendForAnalysisButton: Locator;
  readonly maximumSizeError: Locator;
  private readonly documentRows: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", {
      name: "Documentos da proposta",
      level: 2,
      exact: true,
    });
    this.totalDocuments = page.getByText("Total de Documentos", { exact: true }).locator("..");
    this.pendingDocuments = page.getByText("Pendentes", { exact: true }).locator("..");
    this.completedDocuments = page.getByText("Completos", { exact: true }).locator("..");
    this.sendForAnalysisButton = page.getByRole("button", {
      name: "Enviar para análise",
      exact: true,
    });
    this.maximumSizeError = page.getByText(
      "Arquivo muito grande. O tamanho maximo e 10 MB.",
      { exact: true },
    );
    this.documentRows = page.locator("li").filter({
      has: page.locator('input[type="file"]'),
    });
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.sendForAnalysisButton).toBeVisible();
    await expect(this.documentRows).not.toHaveCount(0);
  }

  getDocumentRow(documentName: string): Locator {
    return this.documentRows.filter({
      hasText: documentName,
    });
  }

  async expectDocumentContract(documentNames: readonly string[]): Promise<void> {
    await expect(this.documentRows).toHaveCount(documentNames.length);
    for (const documentName of documentNames) {
      await expect(this.getDocumentRow(documentName)).toHaveCount(1);
    }
  }

  async chooseFile(documentName: string, filePath: string): Promise<void> {
    const row = this.getDocumentRow(documentName);
    const chooseButton = row
      .getByRole("button", {
        name: "Escolher arquivo",
        exact: true,
      })
      .or(
        row.getByRole("button", {
          name: "Enviar novamente",
          exact: true,
        }),
      );

    await expect(row).toHaveCount(1);
    await expect(chooseButton).toBeVisible();

    const fileChooserPromise = this.page.waitForEvent("filechooser");
    await chooseButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
  }

  async expectUploadedDocument(
    documentName: string,
    fileName: string,
  ): Promise<void> {
    const row = this.getDocumentRow(documentName);
    await expect(row).toHaveCount(1);
    await expect(row.getByText("Documento enviado", { exact: true })).toBeVisible();
    await expect(row.getByText(fileName, { exact: true })).toBeVisible();
    await expect(
      row.getByRole("link", { name: "Ver arquivo", exact: true }),
    ).toBeVisible();
  }

  async openUploadedDocument(documentName: string): Promise<OpenedPortalDocument> {
    const row = this.getDocumentRow(documentName);
    const viewLink = row.getByRole("link", {
      name: "Ver arquivo",
      exact: true,
    });
    await expect(viewLink).toBeVisible();

    const href = await viewLink.getAttribute("href");
    if (!href) {
      throw new Error(`Link de visualizacao ausente para: ${documentName}`);
    }

    const popupPromise = this.page.waitForEvent("popup");
    await viewLink.click();
    const popup = await popupPromise;
    const response = await this.page.request.get(new URL(href, this.page.url()).toString());

    return { popup, response };
  }

  async sendForAnalysis(operationNumber: string): Promise<Response> {
    await expect(this.sendForAnalysisButton).toBeEnabled();

    const submissionResponsePromise = this.page.waitForResponse(
      (response) => {
        const request = response.request();
        const pathname = new URL(response.url()).pathname;
        return (
          request.method() === "POST" &&
          pathname === `/api/portal/propostas/${operationNumber}/finalizar`
        );
      },
      { timeout: 60_000 },
    );
    await this.sendForAnalysisButton.click();

    const confirmationDialog = this.page
      .getByRole("alertdialog")
      .filter({ hasText: /enviar.*análise|prosseguir.*fase/i });
    const requiresConfirmation = await Promise.race([
      confirmationDialog
        .waitFor({ state: "visible", timeout: 60_000 })
        .then(() => true),
      submissionResponsePromise.then(() => false),
    ]);

    if (requiresConfirmation) {
      const confirmationButton = confirmationDialog.getByRole("button", {
        name: /Confirmar|Enviar/i,
      });
      await expect(confirmationButton).toBeEnabled();
      await confirmationButton.click();
    }

    return submissionResponsePromise;
  }
}
