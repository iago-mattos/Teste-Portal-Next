import {
  expect,
  type APIResponse,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";

export interface PortalDocumentFilePayload {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

export interface OpenedPortalDocument {
  readonly popup: Page;
  readonly response: Response;
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
    this.totalDocuments = page
      .getByText("Total de Documentos", { exact: true })
      .locator("..");
    this.pendingDocuments = page
      .getByText("Pendentes", { exact: true })
      .locator("..");
    this.completedDocuments = page
      .getByText("Completos", { exact: true })
      .locator("..");
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
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
    await expect(this.sendForAnalysisButton).toBeVisible({ timeout: 30_000 });
    await expect(this.documentRows).not.toHaveCount(0, { timeout: 30_000 });
  }

  getDocumentRowAt(index: number): Locator {
    return this.documentRows.nth(index);
  }

  async getDocumentCount(): Promise<number> {
    await expect(this.documentRows).not.toHaveCount(0);
    return this.documentRows.count();
  }

  async getDocumentNames(): Promise<readonly string[]> {
    const count = await this.getDocumentCount();
    const names: string[] = [];
    const interfaceLabels = new Set([
      "Documento enviado",
      "Escolher arquivo",
      "Enviar novamente",
      "Ver arquivo",
    ]);

    for (let index = 0; index < count; index += 1) {
      const lines = (await this.getDocumentRowAt(index).innerText())
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const name = lines
        .find((line) => !interfaceLabels.has(line))
        ?.replace(/\s*\*+\s*$/, "")
        .trim();
      if (!name) {
        throw new Error(
          `O Portal não expôs o nome funcional do documento na posição ${index + 1}.`,
        );
      }
      names.push(name);
    }

    if (new Set(names).size !== names.length) {
      throw new Error(
        `O Portal expôs nomes documentais duplicados: ${names.join(", ")}.`,
      );
    }
    return Object.freeze(names);
  }

  async chooseFileAt(index: number, filePath: string): Promise<void> {
    await this.chooseFileInRow(this.getDocumentRowAt(index), filePath);
  }

  async chooseFilePayloadAt(
    index: number,
    file: PortalDocumentFilePayload,
  ): Promise<void> {
    await this.chooseFileInRow(this.getDocumentRowAt(index), file);
  }

  getUploadButtonAt(index: number): Locator {
    return this.getUploadButtonInRow(this.getDocumentRowAt(index));
  }

  getFileInputAt(index: number): Locator {
    return this.getDocumentRowAt(index).locator('input[type="file"]');
  }

  private getUploadButtonInRow(row: Locator): Locator {
    return row
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
  }

  private async chooseFileInRow(
    row: Locator,
    file: string | PortalDocumentFilePayload,
  ): Promise<void> {
    const chooseButton = this.getUploadButtonInRow(row);

    await expect(row).toHaveCount(1);
    await expect(chooseButton).toBeVisible();

    const fileChooserPromise = this.page.waitForEvent("filechooser");
    await chooseButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(file);
  }

  async expectUploadedDocumentAt(
    index: number,
    fileName: string,
  ): Promise<void> {
    await this.expectUploadedDocumentInRow(
      this.getDocumentRowAt(index),
      fileName,
    );
  }

  private async expectUploadedDocumentInRow(
    row: Locator,
    fileName: string,
  ): Promise<void> {
    await expect(row).toHaveCount(1);
    await expect(
      row.getByText("Documento enviado", { exact: true }),
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(row.getByText(fileName, { exact: true })).toBeVisible();
    await expect(
      row.getByRole("link", { name: "Ver arquivo", exact: true }),
    ).toBeVisible();
  }

  async openUploadedDocumentAt(index: number): Promise<OpenedPortalDocument> {
    return this.openUploadedDocumentInRow(
      this.getDocumentRowAt(index),
      `documento na posição ${index + 1}`,
    );
  }

  async readUploadedDocumentAt(index: number): Promise<APIResponse> {
    const row = this.getDocumentRowAt(index);
    const viewLink = row.getByRole("link", {
      name: "Ver arquivo",
      exact: true,
    });
    await expect(viewLink).toBeVisible();
    const href = await viewLink.getAttribute("href");
    if (!href) {
      throw new Error(
        `Link de visualizacao ausente para o documento ${index + 1}.`,
      );
    }
    return this.page.request.get(new URL(href, this.page.url()).toString());
  }

  private async openUploadedDocumentInRow(
    row: Locator,
    description: string,
  ): Promise<OpenedPortalDocument> {
    const viewLink = row.getByRole("link", {
      name: "Ver arquivo",
      exact: true,
    });
    await expect(viewLink).toBeVisible();

    const href = await viewLink.getAttribute("href");
    if (!href) {
      throw new Error(`Link de visualizacao ausente para: ${description}`);
    }

    const documentUrl = new URL(href, this.page.url()).toString();
    const popupPromise = this.page.waitForEvent("popup");
    const responsePromise = this.page.context().waitForEvent("response", {
      predicate: (response) => response.url() === documentUrl,
      timeout: 30_000,
    });
    await viewLink.click();
    const [popup, response] = await Promise.all([
      popupPromise,
      responsePromise,
    ]);

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
