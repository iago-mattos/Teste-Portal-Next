import { expect, type Locator, type Page } from "@playwright/test";
import { ExtJsGridComponent } from "../../components/aejs/extjs-grid.component";

/**
 * Navegação técnica para o módulo Cadastro de Operações do AEJS.
 */
export class AejsOperationsPage {
  readonly openedOperationNumber: Locator;
  readonly openedApplicantName: Locator;
  readonly processProgressGrid: Locator;
  private readonly originationMenuItem: Locator;
  private readonly operationsMenuItem: Locator;
  private readonly processProgressMenuItem: Locator;
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
    this.processProgressGrid = page
      .getByRole("grid", { name: "Andamento do Processo", exact: true })
      .filter({ visible: true });
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

  private async waitForExtJsReady(): Promise<void> {
    await expect(
      this.page.locator(".x-mask-msg:visible, .x-loading-mask:visible"),
    ).toHaveCount(0);
  }
}
