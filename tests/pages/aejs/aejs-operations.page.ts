import { expect, type Locator, type Page } from "@playwright/test";
import { ExtJsGridComponent } from "../../components/aejs/extjs-grid.component";

/**
 * Navegação técnica para o módulo Cadastro de Operações do AEJS.
 */
export class AejsOperationsPage {
  readonly openedOperationNumber: Locator;
  readonly openedApplicantName: Locator;
  readonly openedTerm: Locator;
  readonly openedCurrentPhase: Locator;
  readonly cancellationDate: Locator;
  readonly processProgressGrid: Locator;
  readonly incomeDocumentsGrid: Locator;
  readonly openedDocumentWindow: Locator;
  readonly openedDocumentFrame: Locator;
  readonly openedDocumentUploadedAt: Locator;
  private readonly operationApplicantName: Locator;
  private readonly originationMenuItem: Locator;
  private readonly operationsMenuItem: Locator;
  private readonly processProgressMenuItem: Locator;
  private readonly documentsMenuItem: Locator;
  private readonly simulationMenuItem: Locator;
  private readonly operationDataMenuItem: Locator;
  private readonly fullSummaryTab: Locator;
  private readonly incomeDocumentsTab: Locator;
  private readonly applicantTab: Locator;
  private readonly operationSearchInput: Locator;
  private readonly searchButton: Locator;
  private readonly openApplicantButton: Locator;
  private readonly operationsGrid: ExtJsGridComponent;

  constructor(private readonly page: Page) {
    this.originationMenuItem = page
      .getByRole("toolbar")
      .getByRole("button", { name: "Originação", exact: true });
    this.operationsMenuItem = page.getByRole("menuitem", {
      name: "Cadastro de operações",
      exact: true,
    });
    this.processProgressMenuItem = page.getByRole("menuitem", {
      name: "Andamento do processo",
      exact: true,
    });
    this.documentsMenuItem = page.getByRole("menuitem", {
      name: "Documentos",
      exact: true,
    });
    this.simulationMenuItem = page.getByRole("menuitem", {
      name: "Simulação",
      exact: true,
    });
    this.operationDataMenuItem = page
      .getByText("Dados da Operação", { exact: true })
      .filter({ visible: true });
    this.fullSummaryTab = page
      .getByRole("tab", { name: "Resumo Completo", exact: true })
      .filter({ visible: true });
    this.incomeDocumentsTab = page
      .getByRole("tab", { name: "Renda PF", exact: true })
      .filter({ visible: true });
    this.applicantTab = page.getByRole("tab", {
      name: "Pretendente",
      exact: true,
    });
    this.operationSearchInput = page.locator('input[name="operacao"]');
    this.searchButton = page.getByRole("button", {
      name: "Pesquisar",
      exact: true,
    });
    this.openApplicantButton = page.getByRole("button", {
      name: "Abrir",
      exact: true,
    });
    this.operationsGrid = new ExtJsGridComponent(page.getByRole("grid"));
    this.openedOperationNumber = page.locator(
      'input[name="PRETENDENTE$NU_PRETENDENTE"]',
    );
    this.openedApplicantName = page.locator(
      'input[name="PESSOA$NO_PESSOA"]:visible',
    );
    this.openedTerm = page.locator(
      'input[name="OPERACAO_CREDITO$NU_PRAZO_MESES_OPERACAO"]',
    );
    this.openedCurrentPhase = page.getByLabel("Fase Atual:", { exact: true });
    this.cancellationDate = page
      .getByLabel(/Data do cancelamento/i)
      .filter({ visible: true });
    this.operationApplicantName = page.getByRole("textbox", {
      name: "Nome do cliente:",
      exact: true,
    });
    this.processProgressGrid = page
      .getByRole("grid", { name: "Andamento do Processo", exact: true })
      .filter({ visible: true });
    this.incomeDocumentsGrid = page
      .getByRole("grid")
      .filter({
        has: page.getByRole("columnheader", {
          name: "Documentos",
          exact: true,
        }),
        visible: true,
      });
    this.openedDocumentWindow = page
      .locator(".x-window:visible")
      .filter({ hasText: "Observações do documento" });
    this.openedDocumentFrame = this.openedDocumentWindow.locator(
      'iframe[src^="blob:"]',
    );
    this.openedDocumentUploadedAt = this.openedDocumentWindow.locator(
      'input[name="ALT_DATA"]',
    );
  }

  async navigateToOperations(): Promise<void> {
    await expect(this.originationMenuItem).toHaveCount(1);
    await expect(this.originationMenuItem).toBeVisible();
    await this.originationMenuItem.click();

    await expect(this.operationsMenuItem).toHaveCount(1);
    await expect(this.operationsMenuItem).toBeVisible();
    await this.operationsMenuItem.click();

    await expect(this.operationSearchInput).toBeVisible();
  }

  async searchOperation(operationNumber: string): Promise<void> {
    await expect(this.operationSearchInput).toBeVisible();
    await expect(this.operationSearchInput).toBeEnabled();
    await this.operationSearchInput.fill(operationNumber.replace(/^0+/, ""));

    await expect(this.searchButton).toHaveCount(1);
    await expect(this.searchButton).toBeVisible();
    await expect(this.searchButton).toBeEnabled();
    await this.searchButton.click();
  }

  async openOperation(operationNumber: string): Promise<void> {
    await this.searchOperation(operationNumber);
    await this.operationsGrid.openRowByText(operationNumber);
  }

  async startEditing(): Promise<void> {
    const editButton = this.page
      .getByRole("button", { name: "Alterar", exact: true })
      .filter({ visible: true });

    await expect(editButton).toHaveCount(1);
    await expect(editButton).toBeVisible();
    await expect(editButton).toBeEnabled();
    await editButton.click();
    await this.waitForExtJsReady();
    await expect(
      this.page
        .getByRole("button", { name: "Cancelar", exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
  }

  async cancelEditing(): Promise<void> {
    const cancelButton = this.page
      .getByRole("button", { name: "Cancelar", exact: true })
      .filter({ visible: true });

    await expect(cancelButton).toHaveCount(1);
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    const confirmation = this.page
      .getByRole("alertdialog", { name: "Confirmação", exact: true })
      .filter({ hasText: "Confirma cancelar as alterações?" });
    await expect(confirmation).toBeVisible();
    await confirmation
      .getByRole("button", { name: "Sim", exact: true })
      .click();
    await this.waitForExtJsReady();
    await expect(
      this.page
        .getByRole("button", { name: "Alterar", exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
  }

  async openOperationEventually(
    operationNumber: string,
    timeout = 3 * 60_000,
  ): Promise<void> {
    await expect(async () => {
      await this.searchOperation(operationNumber);
      await this.operationsGrid.findUniqueRowByText(operationNumber);
    }).toPass({
      timeout,
      intervals: [1_000, 2_000, 5_000, 10_000],
    });

    await this.operationsGrid.openRowByText(operationNumber);
  }

  async openProcessProgress(): Promise<void> {
    await expect(this.processProgressMenuItem).toHaveCount(1);
    await expect(this.processProgressMenuItem).toBeVisible();
    await this.processProgressMenuItem.click();
    await this.waitForExtJsReady();

    await expect(this.processProgressGrid).toHaveCount(1);
    await expect(this.processProgressGrid).toBeVisible();
    for (const header of ["Tarefa", "Titulo da Tarefa", "Status"]) {
      await expect(
        this.processProgressGrid.getByRole("columnheader", {
          name: header,
          exact: true,
        }),
      ).toBeVisible();
    }
  }

  async openIncomeDocuments(): Promise<void> {
    await expect(this.documentsMenuItem).toHaveCount(1);
    await expect(this.documentsMenuItem).toBeVisible();
    await this.documentsMenuItem.click();

    await this.selectIncomeDocumentsTab();
  }

  async openSimulation(): Promise<void> {
    await expect(this.simulationMenuItem).toHaveCount(1);
    await expect(this.simulationMenuItem).toBeVisible();
    await this.simulationMenuItem.click();
    await this.waitForExtJsReady();
    await expect(
      this.getVisibleControlByLabel("Modalidade de financiamento:"),
    ).toBeVisible();
  }

  async openFullOperationSummary(): Promise<void> {
    await expect(this.operationDataMenuItem).toHaveCount(1);
    await expect(this.operationDataMenuItem).toBeVisible();
    await this.operationDataMenuItem.click();

    await expect(this.fullSummaryTab).toHaveCount(1);
    await expect(this.fullSummaryTab).toBeVisible();
    await this.fullSummaryTab.click();
    await this.waitForExtJsReady();

    await expect(this.cancellationDate).toHaveCount(1);
    await expect(this.cancellationDate).toBeVisible();
  }

  getIncomeDocumentRow(documentName: string): Locator {
    return this.incomeDocumentsGrid
      .getByRole("row")
      .filter({ hasText: documentName });
  }

  async openIncomeDocument(documentName: string): Promise<void> {
    await this.selectIncomeDocumentsTab();
    await this.waitForDocumentMaskToClear();
    const row = this.getIncomeDocumentRow(documentName);
    await expect(row).toHaveCount(1);
    await expect(row).toBeVisible();

    const attachmentIcon = row.locator(
      '[role="button"][data-qtip="Anexar"]',
    );
    await expect(attachmentIcon).toHaveCount(1);
    await expect(attachmentIcon).toHaveClass(/\bicone-40\b/);
    await attachmentIcon.click();

    await expect(this.openedDocumentWindow).toBeVisible({ timeout: 60_000 });
    await expect(this.openedDocumentFrame).toBeVisible({ timeout: 60_000 });
  }

  async closeOpenedDocument(): Promise<void> {
    const closeButton = this.openedDocumentWindow.getByRole("button", {
      name: "Fechar tela",
      exact: true,
    });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(this.openedDocumentWindow).toHaveCount(0);
    await this.waitForDocumentMaskToClear();
  }

  private async selectIncomeDocumentsTab(): Promise<void> {
    await expect(this.incomeDocumentsTab).toBeVisible({ timeout: 60_000 });
    if ((await this.incomeDocumentsTab.getAttribute("aria-selected")) !== "true") {
      await this.incomeDocumentsTab.click();
    }
    await expect(this.incomeDocumentsTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(this.incomeDocumentsGrid).toBeVisible();
  }

  getProcessTaskRow(taskCode: string): Locator {
    const codeCell = this.page.getByRole("gridcell", {
      name: taskCode,
      exact: true,
    });

    return this.processProgressGrid.getByRole("row").filter({ has: codeCell });
  }

  getVisibleField(name: string): Locator {
    const escapedName = JSON.stringify(name);

    return this.page
      .locator(`input[name=${escapedName}], textarea[name=${escapedName}]`)
      .filter({ visible: true })
      .last();
  }

  getVisibleInput(name: string): Locator {
    return this.page
      .locator(`input[name=${JSON.stringify(name)}]`)
      .last();
  }

  getVisibleText(text: string): Locator {
    return this.page
      .getByText(text, { exact: true })
      .filter({ visible: true })
      .last();
  }

  getVisibleControlByLabel(label: string): Locator {
    return this.page
      .getByLabel(label, { exact: true })
      .filter({ visible: true })
      .last();
  }

  async selectVisibleTab(name: string): Promise<void> {
    const tab = this.page
      .getByRole("tab", { name, exact: true })
      .filter({ visible: true })
      .last();

    await expect(tab).toBeVisible();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await this.waitForExtJsReady();
  }

  async openVisibleGridRow(text: string): Promise<void> {
    const grid = new ExtJsGridComponent(
      this.page.getByRole("grid").filter({ visible: true }).last(),
    );
    const row = await grid.findUniqueRowByText(text);
    await this.openSelectedGridRow(row);
  }

  async openUniqueVisibleGridRow(): Promise<void> {
    const grid = new ExtJsGridComponent(
      this.page.getByRole("grid").filter({ visible: true }).last(),
    );
    const row = await grid.findUniqueDataRow();
    await this.openSelectedGridRow(row);
  }

  private async openSelectedGridRow(row: Locator): Promise<void> {
    await row.click();

    const openButton = this.page
      .getByRole("button", { name: "Abrir", exact: true })
      .filter({ visible: true })
      .last();
    await expect(openButton).toBeVisible();
    await expect(openButton).toBeEnabled();
    await openButton.click();
    await this.waitForExtJsReady();
  }

  async openPrimaryApplicant(rowText: string): Promise<string> {
    await this.selectVisibleTab("Pretendente");
    await this.openVisibleGridRow(rowText);
    await expect(this.openedApplicantName).toBeVisible();

    return this.openedApplicantName.inputValue();
  }

  async closeCurrentWindow(): Promise<void> {
    const closeButtons = this.page
      .getByRole("button", { name: "Fechar tela", exact: true })
      .filter({ visible: true });
    const visibleCloseButtonCount = await closeButtons.count();
    const closeButton = closeButtons.last();

    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await expect(closeButtons).toHaveCount(visibleCloseButtonCount - 1);
    await this.waitForExtJsReady();
  }

  async openApplicant(applicantName: string): Promise<void> {
    await expect(this.applicantTab).toHaveCount(1);
    await expect(this.applicantTab).toBeVisible();
    await this.applicantTab.click();

    const applicantRow = this.page
      .getByRole("grid")
      .getByRole("row")
      .filter({ hasText: applicantName });
    await expect(applicantRow).toHaveCount(1);
    await expect(applicantRow).toBeVisible();
    await applicantRow.click();

    await expect(this.openApplicantButton).toHaveCount(1);
    await expect(this.openApplicantButton).toBeVisible();
    await expect(this.openApplicantButton).toBeEnabled();
    await this.openApplicantButton.click();

    await expect(this.openedApplicantName).toBeVisible();
  }

  async getOperationApplicantName(): Promise<string> {
    await expect(this.operationApplicantName).toBeVisible();
    await expect(this.operationApplicantName).not.toHaveValue("");
    return this.operationApplicantName.inputValue();
  }

  private async waitForExtJsReady(): Promise<void> {
    await expect(
      this.page.locator(
        ".x-mask-msg:visible, .x-loading-mask:visible",
      ),
    ).toHaveCount(0);
  }

  private async waitForDocumentMaskToClear(): Promise<void> {
    await expect(this.page.locator(".x-mask:visible")).toHaveCount(0, {
      timeout: 60_000,
    });
  }
}
