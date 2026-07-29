import { expect, type Locator, type Page } from "@playwright/test";
import { ExtJsGridComponent } from "../../components/aejs/extjs-grid.component";

/** Prepara somente o endereço residencial do titular recém-criado. */
export class AejsApplicantPreparationPage {
  constructor(private readonly page: Page) {}

  async fillAndPersistPostalCode(
    applicantName: string,
    postalCode: string,
  ): Promise<void> {
    await this.openApplicantTab();
    await this.startEditing();
    await this.openApplicant(applicantName);
    await this.openContactData();

    const postalCodeField = this.visibleField("PESSOA$NU_CEP");
    await expect(postalCodeField).toBeVisible();
    await postalCodeField.fill(postalCode);
    await postalCodeField.press("Tab");
    await this.waitForExtJsReady();
    await expect(postalCodeField).toHaveValue(postalCode);

    await this.visibleDialogButton("Confirmar").click();
    await expect(this.applicantDialog).toBeHidden({ timeout: 60_000 });
    await this.waitForExtJsReady();

    const saveButton = this.page
      .getByRole("button", { name: "Salvar", exact: true })
      .filter({ visible: true })
      .last();
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await this.waitForExtJsReady();

    await this.openApplicant(applicantName);
    await this.openContactData();
    await expect(this.visibleField("PESSOA$NU_CEP")).toHaveValue(postalCode);
    await this.visibleDialogButton("Fechar tela").click();
    await expect(this.applicantDialog).toBeHidden({ timeout: 60_000 });
  }

  private async openApplicantTab(): Promise<void> {
    const tab = this.page
      .getByRole("tab", { name: "Pretendente", exact: true })
      .filter({ visible: true })
      .last();
    await expect(tab).toBeVisible({ timeout: 60_000 });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await this.waitForExtJsReady();
  }

  private async startEditing(): Promise<void> {
    const changeButton = this.page
      .locator(
        '[role="button"][data-qtip="Permite a alteração do dados do pretendente"]:visible',
      )
      .last();
    await expect(changeButton).toBeVisible();
    await changeButton.click();
    await this.settleEditTransition();
  }

  private async openApplicant(applicantName: string): Promise<void> {
    const grid = new ExtJsGridComponent(
      this.page
        .getByRole("grid", { name: "Componente de Renda", exact: true })
        .filter({ visible: true })
        .last(),
    );
    const row = await grid.findUniqueRowByText(applicantName);
    await this.clickThroughKnownC6Warning(row);

    const openButton = this.page
      .getByRole("button", { name: "Abrir", exact: true })
      .filter({ visible: true })
      .last();
    await expect(openButton).toBeEnabled();
    await this.clickThroughKnownC6Warning(openButton);
    await expect(this.applicantDialog).toBeVisible({ timeout: 60_000 });
  }

  private async openContactData(): Promise<void> {
    const tab = this.applicantDialog.getByRole("tab", {
      name: "Dados de Contato",
      exact: true,
    });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await this.waitForExtJsReady();
  }

  private get applicantDialog(): Locator {
    return this.page.locator(".x-window:visible").filter({
      has: this.page.getByRole("tab", {
        name: "Dados de Contato",
        exact: true,
      }),
    });
  }

  private visibleField(name: string): Locator {
    return this.applicantDialog
      .locator(`input[name=${JSON.stringify(name)}]:visible`)
      .last();
  }

  private visibleDialogButton(name: string): Locator {
    return this.applicantDialog
      .getByRole("button", { name, exact: true })
      .filter({ visible: true })
      .last();
  }

  private async waitForExtJsReady(): Promise<void> {
    await expect(
      this.page.locator(".x-mask-msg:visible, .x-loading-mask:visible"),
    ).toHaveCount(0, { timeout: 60_000 });
  }

  private async settleEditTransition(): Promise<void> {
    await this.waitForExtJsReady();
    await expect(
      this.page
        .getByRole("button", { name: "Salvar", exact: true })
        .filter({ visible: true })
        .last(),
    ).toBeEnabled({ timeout: 60_000 });
  }

  private async clickThroughKnownC6Warning(target: Locator): Promise<void> {
    await this.dismissKnownC6WarningIfVisible();

    try {
      await target.click({ timeout: 10_000 });
    } catch (error) {
      if (!(await this.dismissKnownC6WarningIfVisible())) {
        throw error;
      }
      await target.click();
    }
  }

  private async dismissKnownC6WarningIfVisible(): Promise<boolean> {
    const alert = this.page.getByRole("alertdialog").filter({ visible: true });
    if (!(await alert.isVisible())) {
      return false;
    }

    await expect(alert).not.toContainText("Transmitindo dados", {
      timeout: 60_000,
    });
    await expect(alert).toContainText(
      "Rotina GetValidaTipoImovelC6 nao encontrada",
    );

    const acknowledge = alert.getByRole("button", {
      name: "OK",
      exact: true,
    });
    await expect(acknowledge).toBeVisible();
    await acknowledge.click();
    await expect(alert).toBeHidden();
    await this.waitForExtJsReady();
    return true;
  }
}
