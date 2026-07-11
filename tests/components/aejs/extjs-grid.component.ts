import { expect, type Locator } from "@playwright/test";

/**
 * Interações técnicas com uma grade ExtJS já escopada pelo consumidor.
 */
export class ExtJsGridComponent {
  constructor(readonly root: Locator) {}

  private get rows(): Locator {
    return this.root.getByRole("row");
  }

  private get dataRows(): Locator {
    return this.root.locator(".x-grid-item").filter({ visible: true });
  }

  private getRowByText(expectedText: string): Locator {
    return this.rows.filter({ hasText: expectedText });
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async findUniqueRowByText(expectedText: string): Promise<Locator> {
    await this.waitUntilReady();

    const row = this.getRowByText(expectedText);
    await expect(row).toHaveCount(1);
    await expect(row).toBeVisible();
    return row;
  }

  async findUniqueDataRow(): Promise<Locator> {
    await this.waitUntilReady();
    await expect(this.dataRows).toHaveCount(1);

    const row = this.dataRows.first();
    await expect(row).toBeVisible();
    return row;
  }

  async openRowByText(expectedText: string): Promise<void> {
    const row = await this.findUniqueRowByText(expectedText);
    await row.dblclick();
  }
}
