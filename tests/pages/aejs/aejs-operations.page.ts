import { expect, type Locator, type Page } from "@playwright/test";
import { ExtJsGridComponent } from "../../components/aejs/extjs-grid.component";

/**
 * Navegação técnica para o módulo Cadastro de Operações do AEJS.
 */
export class AejsOperationsPage {
  readonly openedOperationNumber: Locator;
  readonly openedApplicantName: Locator;
  private readonly originationMenuItem: Locator;
  private readonly operationsMenuItem: Locator;
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
}
