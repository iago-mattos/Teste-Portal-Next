import { expect, test } from "../../../fixtures/test";
import type { Page } from "@playwright/test";

const functionalMutation = { tag: ["@functional", "@mutation"] };

async function chooseRadio(page: Page, labelText: string): Promise<void> {
  const panel = page.getByRole("tabpanel", { name: "Composição de Renda" });
  const radio = panel.getByRole("radio", { name: labelText, exact: true });
  await expect(radio).toBeVisible();
  await radio.check();
  await expect(radio).toBeChecked();
}

test.describe("Cadastro da Operação: Composição de Renda", () => {
  test.beforeEach(async ({ proposalsPage, proposalPage, portalConfig, page }) => {
    const defaultProposalId = portalConfig.testData.expectedProposal.visibleNumber;
    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(defaultProposalId);
    await proposalPage.waitUntilReady();

    await proposalPage.tabs.select("Composição de Renda");
    await expect(page.getByText(/Composição de Renda/i).first()).toBeVisible();
  });

  test(
    "RENDA-01 | Deve ter informativo que é permitido compor renda com terceiros",
    functionalMutation,
    async ({ page }) => {
      const text = page.getByText(
        /É possível compor renda com terceiros, preferencialmente com pessoas de vínculo familiar/i
      );
      await expect(text).toBeVisible();
    },
  );

  test(
    "RENDA-02 | Se cliente selecionar a opção não, então não habilita outras informações",
    functionalMutation,
    async ({ page }) => {
      await chooseRadio(page, "Não");

      const section = page.getByText(/Quem irá compor renda/i);
      await expect(section).toHaveCount(0);
    },
  );

  test(
    "RENDA-03 | Se cliente selecionar a opção sim, habilitar opção “cônjuge” ou “outra pessoa”",
    functionalMutation,
    async ({ page }) => {
      await chooseRadio(page, "Sim");

      const section = page.getByText(/Quem irá compor renda/i);
      await expect(section).toBeVisible();

      const conjugeLabel = page.locator("label", { hasText: "Conjuge" });
      await expect(conjugeLabel).toBeVisible();

      const outraPessoaLabel = page.locator("label", { hasText: "Outra Pessoa" });
      await expect(outraPessoaLabel).toBeVisible();

      await chooseRadio(page, "Não");
      await expect(section).toHaveCount(0);
    },
  );
});
