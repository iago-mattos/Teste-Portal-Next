import { expect, test } from "../../../fixtures/test";

const functionalReadonly = { tag: ["@functional", "@readonly"] };

test.describe("Detalhamento", () => {
  test.beforeEach(async ({ proposalsPage, proposalPage, portalConfig }) => {
    const defaultProposalId = portalConfig.testData.expectedProposal.visibleNumber;
    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(defaultProposalId);
    await proposalPage.waitUntilReady();
  });

  test(
    "DETALHE-01 | O botão não estará em tela, será via jornada a partir da proposta e será habilitado apenas quando cadastro completo",
    functionalReadonly,
    async ({ page }) => {
      await expect(page.getByText("Ainda faltam campos obrigatórios")).toBeVisible();

      const detailsButton = page.locator("button", { hasText: /Ver Detalhes da Operação/i });
      await expect(detailsButton).toHaveCount(0);
    },
  );
});
