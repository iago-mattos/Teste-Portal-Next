import { expect, type Locator, type Page } from "@playwright/test";
import { DialogComponent } from "../components/portal/dialog.component";
import { ProposalTabsComponent } from "../components/portal/proposal-tabs.component";
import { SearchableComboboxComponent } from "../components/portal/searchable-combobox.component";

export class ProposalPage {
  readonly heading: Locator;
  readonly tabs: ProposalTabsComponent;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", {
      name: /^Proposta #\d+$/,
      level: 1,
    });
    this.tabs = new ProposalTabsComponent(page);
  }

  async open(proposalId: string): Promise<void> {
    if (!proposalId || proposalId.includes("/")) {
      throw new Error("O identificador da proposta e invalido.");
    }

    await this.page.goto(`/propostas/${encodeURIComponent(proposalId)}`);
    await this.waitUntilReady();
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.tabs.root).toBeVisible();
  }

  getFieldByName(fieldName: string): Locator {
    return this.page.locator(`[name=${JSON.stringify(fieldName)}]`);
  }

  getSearchableCombobox(fieldName: string): SearchableComboboxComponent {
    return new SearchableComboboxComponent(this.page, fieldName);
  }

  getDialog(name?: string | RegExp): DialogComponent {
    return new DialogComponent(this.page, name);
  }
}
