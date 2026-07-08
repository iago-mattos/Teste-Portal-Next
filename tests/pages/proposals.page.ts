import { expect, type Locator, type Page } from "@playwright/test";
import { DialogComponent } from "../components/portal/dialog.component";

export class ProposalsPage {
  readonly heading: Locator;
  readonly proposalCards: Locator;
  private readonly skeletons: Locator;

  constructor(
    private readonly page: Page,
    private readonly proposalsPath: string,
  ) {
    this.heading = page.getByRole("heading", {
      name: "Minhas propostas",
      level: 1,
    });
    this.proposalCards = page.getByRole("article");
    this.skeletons = page.locator('article [data-slot="skeleton"]');
  }

  async open(): Promise<void> {
    await this.page.goto(this.proposalsPath);
    await this.waitUntilReady();
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.skeletons).toHaveCount(0);
  }

  getProposalCard(number: string): Locator {
    return this.proposalCards.filter({ hasText: `Proposta #${number}` });
  }

  getDialog(name?: string | RegExp): DialogComponent {
    return new DialogComponent(this.page, name);
  }

  async loadAll(): Promise<void> {
    const loadMoreButton = this.page.getByRole("button", {
      name: "Carregar mais",
      exact: true,
    });

    while ((await loadMoreButton.count()) > 0) {
      if (!(await loadMoreButton.isVisible())) return;

      const previousCount = await this.proposalCards.count();
      await Promise.all([
        this.page.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === "GET" &&
            url.pathname === "/api/portal/propostas"
          );
        }),
        loadMoreButton.click(),
      ]);
      await expect(
        this.page.getByRole("button", {
          name: "Carregando...",
          exact: true,
        }),
      ).toBeHidden();

      const currentCount = await this.proposalCards.count();
      if (currentCount <= previousCount && (await loadMoreButton.isVisible())) {
        throw new Error(
          "O Portal manteve a acao Carregar mais sem adicionar propostas.",
        );
      }
    }
  }

  async openProposal(number: string): Promise<void> {
    const card = this.getProposalCard(number);
    await expect(card).toHaveCount(1);

    const openButton = card
      .getByRole("button", { name: "Completar cadastro", exact: true })
      .or(card.getByRole("button", { name: "Acompanhar proposta", exact: true }));
    await expect(openButton).toHaveCount(1);

    await Promise.all([
      this.page.waitForURL((url) => /^\/propostas\/[^/]+$/.test(url.pathname)),
      openButton.click(),
    ]);
  }
}
