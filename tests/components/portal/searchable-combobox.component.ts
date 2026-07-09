import { expect, type Locator, type Page } from "@playwright/test";

export class SearchableComboboxComponent {
  readonly input: Locator;

  constructor(
    private readonly page: Page,
    fieldName: string,
  ) {
    this.input = page.locator(`[name=${JSON.stringify(fieldName)}]`);
  }

  get listbox(): Locator {
    return this.page.getByRole("listbox");
  }

  get options(): Locator {
    return this.listbox.getByRole("option");
  }

  getOption(name: string): Locator {
    return this.listbox.getByRole("option", { name, exact: true });
  }

  async open(): Promise<void> {
    await expect(this.input).toBeVisible();
    await expect(this.input).toBeEnabled();
    await this.input.click();
    await expect(this.listbox).toBeVisible();
  }

  async search(value: string): Promise<void> {
    await expect(this.input).toBeVisible();
    await expect(this.input).toBeEnabled();
    await this.input.fill(value);
    await expect(this.listbox).toBeVisible();
  }

  async selectOption(name: string): Promise<void> {
    await this.open();
    const option = this.getOption(name);
    await expect(option).toHaveCount(1);
    await expect(option).toBeVisible();
    await option.click();
    await expect(this.listbox).toBeHidden();
  }
}
