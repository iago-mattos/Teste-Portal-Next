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
  readonly tablist: Locator;
  readonly tabs: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByRole("region", { name: "Conteudo da subtela" });
    this.tablist = page.getByRole("tablist");
    this.tabs = this.tablist.getByRole("tab");
  }

  getTab(name: ProposalTabName): Locator {
    return this.page.getByText(name, { exact: true });
  }

  getTabButton(name: ProposalTabName): Locator {
    return this.tablist.getByRole("tab", { name, exact: true });
  }

  async select(name: ProposalTabName): Promise<void> {
    const tab = this.getTab(name);
    await expect(tab).toBeVisible();
    await expect(tab).toBeEnabled();
    await tab.click();
    await expect(tab).toBeVisible();
  }
}
