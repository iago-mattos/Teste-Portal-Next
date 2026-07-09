import { expect, test } from "../../../fixtures/test";
import type { Page } from "@playwright/test";
import type { ProposalPage } from "../../../pages/portal/proposal.page";

const functionalMutation = { tag: ["@functional", "@mutation"] };

async function chooseRadio(page: Page, labelText: string): Promise<void> {
  const label = page.locator("label", { hasText: new RegExp(`^${labelText}$`, "i") });
  await expect(label).toBeVisible();
  const inputId = await label.getAttribute("for");
  expect(inputId).not.toBeNull();
  expect(inputId).not.toBe("");

  await label.click();

  const input = page.locator(`#${inputId}`);
  await expect(input).toBeChecked();
}

async function expectRequired(page: Page, proposalPage: ProposalPage, name: string): Promise<void> {
  const field = proposalPage.getFieldByName(name);
  await expect(field).toBeVisible();
  const id = await field.getAttribute("id");
  expect(id).not.toBeNull();
  expect(id).not.toBe("");

  const label = page.locator(`label[for="${id}"]`);
  await expect(label).toContainText("*");
}

test.describe("Cadastro de Operação: Composição de Renda com cônjuge", () => {
  test.beforeEach(async ({ proposalsPage, proposalPage, portalConfig, page }) => {
    const defaultProposalId = portalConfig.testData.expectedProposal.visibleNumber;
    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(defaultProposalId);
    await proposalPage.waitUntilReady();

    await proposalPage.tabs.select("Composição de Renda");
    await expect(page.getByText(/Composição de Renda/i).first()).toBeVisible();

    await chooseRadio(page, "Sim");
    await chooseRadio(page, "Conjuge");
    await expect(page.getByText("Dados do Cônjuge para Composição de Renda")).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await chooseRadio(page, "Não");
  });

  test(
    "RENDA-CONJ-01 | Se cônjuge habilitar campos: Renda do cônjuge, Profissão do Conjuge e Tipo de Profissão do Cônjuge para preenchimento obrigatório E por isso são sinalizados com (*)",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const requiredFields = [
        "CONJUGE.VA_RENDA_BRUTA",
        "CONJUGE.CO_PROFISSAO",
        "CONJUGE.CO_ATIVIDADE_PROFISSIONAL",
      ];
      for (const field of requiredFields) {
        await expectRequired(page, proposalPage, field);
      }
    },
  );

  test(
    "RENDA-CONJ-02 | O campo renda deve aceitar apenas valores numéricos. Valores diferentes de numérico não deverão ser aceitos, mostrando em tela um erro",
    functionalMutation,
    async ({ proposalPage }) => {
      const field = proposalPage.getFieldByName("CONJUGE.VA_RENDA_BRUTA");
      await field.clear();
      await field.pressSequentially("abc123");

      const val = await field.inputValue();
      expect(val.toLowerCase()).not.toContain("abc");
      await field.clear();
    },
  );

  test(
    "RENDA-CONJ-03 | O campo profissão do cônjuge deve conter as mesmas profissões da lista existente na prognum em originação, no campo profissão, não considerando: Outros; Outros Declarantes não especificados; Outros servidores civis e militares; outros trabal de nivel superior, ligados ao ensino; Outros trabalhadores administrativos e assemelhado; Outros trabalhadores de serviços assemelhados; Outros Trabalhadores do comercio e assemelhados",
    functionalMutation,
    async ({ proposalPage }) => {
      const forbidden = [
        "Outros",
        "Outros Declarantes não especificados",
        "Outros servidores civis e militares",
        "Outros trabal de nivel superior, ligados ao ensino",
        "Outros trabalhadores administrativos e assemelhado",
        "Outros trabalhadores de serviços assemelhados",
        "Outros Trabalhadores do comercio e assemelhados",
      ];
      const combobox = proposalPage.getSearchableCombobox("CONJUGE.CO_PROFISSAO");
      await combobox.open();

      const options = combobox.options;
      await expect(options.first()).toBeVisible();

      const count = await options.count();
      const optionTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text && text.trim()) {
          optionTexts.push(text.trim().toLowerCase());
        }
      }

      for (const item of forbidden) {
        expect(optionTexts).not.toContain(item.toLowerCase());
      }
    },
  );

  test(
    "RENDA-CONJ-04 | O campo profissão do cônjuge deve permitir o cliente digitar para filtrar as opções sem necessidade ficar rolando a barra",
    functionalMutation,
    async ({ proposalPage }) => {
      const combobox = proposalPage.getSearchableCombobox("CONJUGE.CO_PROFISSAO");
      await combobox.search("ADMIN");

      const options = combobox.options;
      await expect(options.first()).toBeVisible();

      const adminOption = combobox.getOption("ADMINISTRADOR");
      await expect(adminOption).toBeVisible();

      const count = await options.count();
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        expect(text?.toUpperCase()).toContain("ADMIN");
      }
    },
  );

  test(
    "RENDA-CONJ-05 | O campo tipo de profissão do cônjuge deve ter os mesmos campos do campo tipo de funcionário, sendo: Autônomo, Empresário, Pensionista, Profissional Liberal, Aposentado, Renda de Aluguel, Produtor Rural, Assalariado",
    functionalMutation,
    async ({ proposalPage }) => {
      const expected = [
        "AUTONOMO",
        "EMPRESARIO",
        "PENSIONISTA",
        "PROFISSIONAL LIBERAL",
        "APOSENTADO",
        "RENDA DE ALUGUEL",
        "PRODUTOR RURAL",
        "ASSALARIADO",
      ];
      const combobox = proposalPage.getSearchableCombobox("CONJUGE.CO_ATIVIDADE_PROFISSIONAL");
      await combobox.open();

      const options = combobox.options;
      await expect(options.first()).toBeVisible();

      const count = await options.count();
      const optionTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text && text.trim()) {
          optionTexts.push(text.trim());
        }
      }

      expect(optionTexts).toEqual(expected);
    },
  );

  test(
    "RENDA-CONJ-06 | Deve ser obrigatório o preenchimento de “Autorizo a consulta de dados dos demais participantes no Sistema de informações de crédito (SCR) e demais instituições de proteções e fraudes, lavagem de dinheiro e risco de crédito",
    functionalMutation,
    async ({ page, proposalPage }) => {
      await expectRequired(page, proposalPage, "CONJUGE.IN_AUTORZC");
    },
  );
});
