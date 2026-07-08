import { expect, test } from "../fixtures/test";

test(
  "abre a proposta padrão configurada para o ambiente",
  { tag: ["@smoke", "@readonly"] },
  async ({ proposalPage, proposalsPage, portalConfig }) => {
    const proposalNumber = portalConfig.testData.expectedProposal.visibleNumber;
    expect(
      proposalNumber,
      "Configure testData.expectedProposal.visibleNumber para o ambiente.",
    ).not.toBe("");

    await proposalsPage.open();
    await proposalsPage.loadAll();

    const proposalCard = proposalsPage.getProposalCard(proposalNumber);
    await expect(proposalCard).toBeVisible();

    await proposalsPage.openProposal(proposalNumber);
    await expect(proposalPage.heading).toBeVisible();
    await expect(proposalPage.tabs.root).toBeVisible();
  },
);
