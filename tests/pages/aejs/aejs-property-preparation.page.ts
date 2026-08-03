import { expect, type Locator, type Page } from "@playwright/test";
import type { C6ProvisioningScenario } from "../../types/c6-provisioning";

type PropertyAddress = C6ProvisioningScenario["propertyAddress"];

export interface AejsPropertyAddressChange {
  readonly postalCode: string;
  readonly street: string;
  readonly streetNumber: string;
}

/** Prepara e comprova o endereço do imóvel no cadastro da operação do SCCI. */
export class AejsPropertyPreparationPage {
  constructor(private readonly page: Page) {}

  async fillAndPersistAddress(address: PropertyAddress): Promise<void> {
    await this.startEditing();
    await this.openPropertyData();

    const postalCode = this.field("IMOVEL_OPERACAO$NU_CEP");
    await expect(postalCode).toBeEditable();
    await postalCode.fill(address.postalCode);
    await postalCode.press("Tab");
    await this.waitForExtJsReady();
    await expect(postalCode).toHaveValue(address.postalCode);

    const addressField = this.field("IMOVEL_OPERACAO$NO_ENDERECO");
    await expect(addressField).toHaveValue(/\S/, { timeout: 60_000 });
    const street = this.withoutTrailingNumber(await addressField.inputValue());
    const fullAddress = `${street}, ${address.streetNumber}`;
    await addressField.fill(fullAddress);
    await this.field("IMOVEL_OPERACAO$NO_COMPLEMENTO").fill(address.complement);

    await expect(addressField).toHaveValue(fullAddress);
    await expect(this.field("IMOVEL_OPERACAO$NO_COMPLEMENTO")).toHaveValue(
      address.complement,
    );
    await this.save();
  }

  async changeAndPersistAddress(
    address: AejsPropertyAddressChange,
  ): Promise<void> {
    await this.startEditing();
    await this.openPropertyData();

    const postalCode = this.field("IMOVEL_OPERACAO$NU_CEP");
    await expect(postalCode).toBeEditable();
    await postalCode.fill(address.postalCode);
    await postalCode.press("Tab");
    await this.waitForExtJsReady();
    await expect(postalCode).toHaveValue(address.postalCode);

    const addressField = this.field("IMOVEL_OPERACAO$NO_ENDERECO");
    await expect(addressField).toHaveValue(address.street, {
      timeout: 60_000,
    });

    const addressLine = `${address.street}, ${address.streetNumber}`;
    await addressField.fill(addressLine);
    await expect(addressField).toHaveValue(addressLine);
    await this.save();
  }

  async expectChangedAddress(
    address: AejsPropertyAddressChange,
  ): Promise<void> {
    await this.openPropertyData();
    await expect(this.field("IMOVEL_OPERACAO$NU_CEP")).toHaveValue(
      address.postalCode,
    );
    await expect(this.field("IMOVEL_OPERACAO$NO_ENDERECO")).toHaveValue(
      `${address.street}, ${address.streetNumber}`,
    );
  }

  async expectAddress(address: PropertyAddress): Promise<void> {
    await this.openPropertyData();
    await expect(this.field("IMOVEL_OPERACAO$NU_CEP")).toHaveValue(
      address.postalCode,
    );
    await expect(this.field("IMOVEL_OPERACAO$NO_ENDERECO")).toHaveValue(
      address.addressLine,
    );
    await expect(this.field("IMOVEL_OPERACAO$NO_COMPLEMENTO")).toHaveValue(
      address.complement,
    );
    await expect(this.field("IMOVEL_OPERACAO$CO_UF")).toHaveValue(
      address.state,
    );
    await expect(this.field("IMOVEL_OPERACAO$NU_MUNICIPIO")).toHaveValue(
      new RegExp(address.municipality, "i"),
    );
  }

  async hasPersistedAddress(address: PropertyAddress): Promise<boolean> {
    await this.openPropertyData();
    const values = await Promise.all([
      this.field("IMOVEL_OPERACAO$NU_CEP").inputValue(),
      this.field("IMOVEL_OPERACAO$NO_ENDERECO").inputValue(),
      this.field("IMOVEL_OPERACAO$NO_COMPLEMENTO").inputValue(),
      this.field("IMOVEL_OPERACAO$CO_UF").inputValue(),
      this.field("IMOVEL_OPERACAO$NU_MUNICIPIO").inputValue(),
    ]);
    return (
      values[0] === address.postalCode &&
      values[1] === address.addressLine &&
      values[2] === address.complement &&
      values[3].toLocaleUpperCase("pt-BR") ===
        address.state.toLocaleUpperCase("pt-BR") &&
      values[4].toLocaleUpperCase("pt-BR") ===
        address.municipality.toLocaleUpperCase("pt-BR")
    );
  }

  private async openPropertyData(): Promise<void> {
    await this.selectTab("Imóvel Operação");
    await this.selectTab("Dados do imóvel");
    await expect(this.field("IMOVEL_OPERACAO$NU_CEP")).toBeVisible();
  }

  private async startEditing(): Promise<void> {
    await expect(this.changeButton).toBeVisible();
    await expect(this.changeButton).toBeEnabled();
    await this.changeButton.click();
    await this.dismissKnownC6WarningIfVisible();
    await this.waitForExtJsReady();
    await expect(this.saveButton).toBeEnabled({ timeout: 60_000 });
  }

  private async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.dismissKnownC6WarningIfVisible();
    await this.waitForExtJsReady();
    await expect(this.changeButton).toBeVisible({ timeout: 60_000 });
  }

  private async selectTab(name: string): Promise<void> {
    const tab = this.page
      .getByRole("tab", { name, exact: true })
      .filter({ visible: true })
      .last();
    await expect(tab).toBeVisible({ timeout: 60_000 });
    if ((await tab.getAttribute("aria-selected")) !== "true") {
      await tab.click();
    }
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await this.waitForExtJsReady();
  }

  private field(name: string): Locator {
    return this.page
      .locator(`input[name=${JSON.stringify(name)}]:visible`)
      .last();
  }

  private get changeButton(): Locator {
    return this.page
      .locator(
        '[role="button"][data-qtip="Permite a alteração do dados do pretendente"]:visible',
      )
      .last();
  }

  private get saveButton(): Locator {
    return this.page
      .getByRole("button", { name: "Salvar", exact: true })
      .filter({ visible: true })
      .last();
  }

  private withoutTrailingNumber(value: string): string {
    const normalized = value.trim().replace(/(?:,\s*|\s+)\d+\s*$/, "").trim();
    if (!normalized) {
      throw new Error("O SCCI não retornou um logradouro para o CEP do imóvel.");
    }
    return normalized;
  }

  private async dismissKnownC6WarningIfVisible(): Promise<void> {
    const alert = this.page.getByRole("alertdialog").filter({ visible: true });
    await alert
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => undefined);
    if (!(await alert.isVisible())) return;

    await expect
      .poll(
        async () =>
          (await alert.isVisible()) &&
          (await alert.innerText()).includes("Transmitindo dados"),
        { timeout: 5 * 60_000 },
      )
      .toBe(false);
    if (!(await alert.isVisible())) return;
    await expect(alert).toContainText(
      "Rotina GetValidaTipoImovelC6 nao encontrada",
    );
    await alert.getByRole("button", { name: "OK", exact: true }).click();
    await expect(alert).toBeHidden();
  }

  private async waitForExtJsReady(): Promise<void> {
    await expect(
      this.page.locator(".x-mask-msg:visible, .x-loading-mask:visible"),
    ).toHaveCount(0, { timeout: 60_000 });
  }
}
