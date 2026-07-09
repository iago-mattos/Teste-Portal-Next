import { expect, type Locator, type Page } from "@playwright/test";
import { DialogComponent } from "../../components/portal/dialog.component";
import { ProposalTabsComponent } from "../../components/portal/proposal-tabs.component";
import { SearchableComboboxComponent } from "../../components/portal/searchable-combobox.component";

export class ProposalPage {
  readonly heading: Locator;
  readonly tabs: ProposalTabsComponent;
  readonly proponentInfo: Locator;
  readonly phasesNav: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole("heading", {
      name: /^Proposta #\d+$/,
      level: 1,
    });
    this.tabs = new ProposalTabsComponent(page);
    this.proponentInfo = page.getByText(/^Proponente:\s*$/i).locator("..");
    this.phasesNav = page.getByRole("navigation", { name: "Fases da proposta" });
  }

  getAlert(text?: string | RegExp): Locator {
    const alert = this.page.getByRole("status");
    return text ? alert.filter({ hasText: text }) : alert;
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

  async expectDraftSaved(): Promise<void> {
    const heading = this.page.getByRole("heading", { name: "Cadastro da Proposta", level: 2 });
    const container = heading.locator("..");
    await expect(container.getByText("Rascunho salvo")).toBeVisible({ timeout: 30000 });
  }
}
