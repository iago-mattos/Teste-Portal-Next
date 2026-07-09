import { expect, test } from "../../../fixtures/test";
import type { Page } from "@playwright/test";
import type { ProposalPage } from "../../../pages/portal/proposal.page";

const functionalMutation = { tag: ["@functional", "@mutation"] };

async function expectRequired(page: Page, proposalPage: ProposalPage, name: string): Promise<void> {
  const field = proposalPage.getFieldByName(name);
  await expect(field).toBeVisible();
  const id = await field.getAttribute("id");
  expect(id).not.toBeNull();
  expect(id).not.toBe("");

  const label = page.locator(`label[for="${id}"]`);
  await expect(label).toContainText("*");
}

async function expectOptional(page: Page, proposalPage: ProposalPage, name: string): Promise<void> {
  const field = proposalPage.getFieldByName(name);
  await expect(field).toBeVisible();
  const id = await field.getAttribute("id");
  expect(id).not.toBeNull();
  expect(id).not.toBe("");

  const label = page.locator(`label[for="${id}"]`);
  await expect(label).toContainText("opcional");
}

async function clearAddress(proposalPage: ProposalPage): Promise<void> {
  const fields = [
    "PESSOA.NU_CEP",
    "PESSOA.NO_ENDERECO",
    "PESSOA.NU_APTO",
    "PESSOA.NO_COMPLEMENTO",
    "PESSOA.NO_BAIRRO",
  ];
  for (const name of fields) {
    await proposalPage.getFieldByName(name).clear();
  }
  const ufCombobox = proposalPage.getSearchableCombobox("PESSOA.CO_UF");
  await ufCombobox.input.clear();
}

test.describe("Cadastro da Operação: Garantidor PF", () => {
  test.beforeEach(async ({ proposalsPage, proposalPage, portalConfig, page, teardownRegistry }) => {
    const defaultProposalId = portalConfig.testData.expectedProposal.visibleNumber;
    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(defaultProposalId);
    await proposalPage.waitUntilReady();

    // Registra o teardown da condição do imóvel no teardownRegistry
    teardownRegistry.add(async () => {
      await proposalPage.tabs.select("Imóvel");
      const condicaoSelect = proposalPage.getFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL");
      await condicaoSelect.selectOption("");

      // Salva navegando para outra aba
      await proposalPage.tabs.select("Sobre Você");
      await proposalPage.expectDraftSaved();
    });

    await proposalPage.tabs.select("Imóvel");
    const condicaoSelect = proposalPage.getFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL");
    await expect(condicaoSelect).toBeVisible();
    await condicaoSelect.selectOption("3"); // De terceiro (PF) quitado

    await proposalPage.tabs.select("Garantidor");
    await expect(page.getByText("Dados Pessoais")).toBeVisible();
  });

  test(
    "GAR-PF-01 | Caso preenchido de terceiro quitado ou alienado, habilita garantidor PF",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const select = proposalPage.getFieldByName("PESSOA.IN_FISICA_JURIDICA");
      await expect(select).toBeDisabled();
      const selectedText = await select.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text);
      expect(selectedText?.trim()).toBe("Física");

      await proposalPage.tabs.select("Imóvel");
      const condicaoSelect = proposalPage.getFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL");
      await condicaoSelect.selectOption("4"); // De terceiro (PF) alienado/financiado

      await proposalPage.tabs.select("Garantidor");
      await expect(page.getByText("Dados Pessoais")).toBeVisible();

      await expect(select).toBeDisabled();
      const selectedText2 = await select.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text);
      expect(selectedText2?.trim()).toBe("Física");
    },
  );

  test(
    "GAR-PF-02 | Quando Garantidor PF habilitado, os campos “Nome do proprietário”, “CPF do proprietário”, “Estado Civil”, “CEP”, “Endereço”, “Número”, “Bairro”, “Município”, “UF”, Telefone de contato”, “E-mail” e “Data de Nascimento são de preenchimento obrigatório e por isso devem ter “(*)”",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const fields = [
        "PESSOA.NO_PESSOA",
        "PESSOA.NU_CPFCNPJ",
        "PESSOA.CO_ESTCIV",
        "PESSOA.DT_NASCIMENTO",
        "PESSOA.NU_CELULAR",
        "PESSOA.NO_EMAIL",
        "PESSOA.NU_CEP",
        "PESSOA.NO_ENDERECO",
        "PESSOA.NU_APTO",
        "PESSOA.NO_BAIRRO",
        "PESSOA.CO_UF",
      ];
      for (const field of fields) {
        await expectRequired(page, proposalPage, field);
      }

      const ufCombobox = proposalPage.getSearchableCombobox("PESSOA.CO_UF");
      await ufCombobox.selectOption("SP");
      await expectRequired(page, proposalPage, "PESSOA.CO_MUNICIPIO");

      await ufCombobox.input.clear();
    },
  );

  test(
    "GAR-PF-03 | Telefone deve permitir apenas celular",
    functionalMutation,
    async ({ proposalPage }) => {
      const cellInput = proposalPage.getFieldByName("PESSOA.NU_CELULAR");
      await cellInput.clear();
      await cellInput.fill("212345678");
      await cellInput.blur();

      await expect(cellInput).toHaveAttribute("aria-invalid", "true");
      await cellInput.clear();
    },
  );

  test(
    "GAR-PF-04 | Quando Garantidor PF, o campo “Complemento” é opcional",
    functionalMutation,
    async ({ page, proposalPage }) => {
      await expectOptional(page, proposalPage, "PESSOA.NO_COMPLEMENTO");
    },
  );

  test(
    "GAR-PF-05 | Ao digitar o CEP, os campos Endereço, Bairro, Município e UF devem ser preenchidos automaticamente",
    functionalMutation,
    async ({ proposalPage }) => {
      const cepInput = proposalPage.getFieldByName("PESSOA.NU_CEP");
      await cepInput.clear();
      await cepInput.pressSequentially("01001000");
      await cepInput.blur();

      const fields = [
        "PESSOA.NO_ENDERECO",
        "PESSOA.NO_BAIRRO",
        "PESSOA.CO_UF",
        "PESSOA.CO_MUNICIPIO",
      ];
      for (const field of fields) {
        const input = proposalPage.getFieldByName(field);
        await expect(input).toBeVisible();
        await expect(input).not.toHaveValue("");
      }

      await clearAddress(proposalPage);
    },
  );

  test(
    "GAR-PF-06 | Deve existir em tela uma indicação que o endereço é do proprietário do imóvel",
    functionalMutation,
    async ({ page }) => {
      await expect(page.getByText("Endereço residencial do proprietário do imóvel")).toBeVisible();
    },
  );
});
