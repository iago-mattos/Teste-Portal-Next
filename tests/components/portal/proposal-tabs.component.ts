import { expect, type Locator, type Page } from "@playwright/test";

export type ProposalTabName =
  | "Sobre Você"
  | "Cônjuge"
  | "Composição de Renda"
  | "Motivo da Contratação"
  | "Imóvel"
  | "Garantidor";

export class ProposalTabsComponent {
  readonly root: Locator;

  constructor(page: Page) {
    this.root = page.getByRole("tablist");
  }

  getTab(name: ProposalTabName): Locator {
    return this.root.getByRole("tab", { name, exact: true });
  }

  async select(name: ProposalTabName): Promise<void> {
    const tab = this.getTab(name);
    await expect(tab).toBeVisible();
    await expect(tab).toBeEnabled();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }
}
