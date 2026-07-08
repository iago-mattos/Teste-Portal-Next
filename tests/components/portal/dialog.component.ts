import { expect, type Locator, type Page } from "@playwright/test";

type DialogName = string | RegExp;

export class DialogComponent {
  readonly root: Locator;

  constructor(page: Page, name?: DialogName) {
    const options = name === undefined ? {} : { name };
    this.root = page
      .getByRole("dialog", options)
      .or(page.getByRole("alertdialog", options));
  }

  getButton(name: string | RegExp): Locator {
    return this.root.getByRole("button", { name });
  }

  async waitUntilVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async clickButton(name: string | RegExp): Promise<void> {
    const button = this.getButton(name);
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
  }

  async fillTextarea(value: string): Promise<void> {
    const textarea = this.root.locator("textarea");
    await expect(textarea).toHaveCount(1);
    await textarea.fill(value);
  }
}
