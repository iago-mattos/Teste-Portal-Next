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

test.describe("Cadastro da Operação: Garantidor PJ", () => {
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
    await condicaoSelect.selectOption("5"); // Em nome de empresa (PJ) quitado

    await proposalPage.tabs.select("Garantidor");
    await expect(page.getByText("Dados da Empresa")).toBeVisible();
  });

  test(
    "GAR-PJ-01 | Caso preenchido em nome de empresa quitado ou alienado, habilita garantidor PJ",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const select = proposalPage.getFieldByName("PESSOA.IN_FISICA_JURIDICA");
      await expect(select).toBeDisabled();
      const selectedText = await select.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text);
      expect(selectedText?.trim()).toBe("Jurídica");

      await proposalPage.tabs.select("Imóvel");
      const condicaoSelect = proposalPage.getFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL");
      await condicaoSelect.selectOption("6"); // Em nome de empresa (PJ) alienado/financiado

      await proposalPage.tabs.select("Garantidor");
      await expect(page.getByText("Dados da Empresa")).toBeVisible();

      await expect(select).toBeDisabled();
      const selectedText2 = await select.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text);
      expect(selectedText2?.trim()).toBe("Jurídica");
    },
  );

  test(
    "GAR-PJ-02 | Quando Garantidor PJ habilitado, os campos “Razão Social da Empresa”, “CNPJ”, “CEP”, “Endereço”, “Número”, “Bairro”, “Município”, “UF” são de preenchimento obrigatório e por isso devem ter “(*)”",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const fields = [
        "PESSOA.NO_PESSOA",
        "PESSOA.NU_CPFCNPJ",
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
    "GAR-PJ-03 | Quando Garantidor PJ, os campos “Telefone de contato”, “E-mail” e “Complemento” são opcionais",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const fields = [
        "PESSOA.NU_TELEFONE_COM",
        "PESSOA.NO_EMAIL",
        "PESSOA.NO_COMPLEMENTO",
      ];
      for (const field of fields) {
        await expectOptional(page, proposalPage, field);
      }
    },
  );

  test(
    "GAR-PJ-04 | Ao digitar o CEP, os campos Endereço, Bairro, Município e UF devem ser preenchidos automaticamente",
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
    "GAR-PJ-05 | Deve existir em tela uma indicação que o endereço é da empresa do imóvel",
    functionalMutation,
    async ({ page }) => {
      await expect(page.getByText("Endereço da Empresa")).toBeVisible();
    },
  );

  test(
    "GAR-PJ-06 | A Lista de Sócios deve permitir adicionar um novo sócio",
    functionalMutation,
    async ({ page }) => {
      await expect(page.getByText("Lista de Sócios")).toBeVisible();

      const partnerNameFields = page.locator('[name="NO_PESSOA"]');
      const initialCount = await partnerNameFields.count();

      const addPartnerBtn = page.locator("button", { hasText: /adicionar.*sócio/i });
      await addPartnerBtn.scrollIntoViewIfNeeded();
      await expect(addPartnerBtn).toBeVisible();
      await addPartnerBtn.click();

      await expect(partnerNameFields).toHaveCount(initialCount + 1);
    },
  );

  test(
    "GAR-PJ-07 | Campo “Nome Completo”, “CPF”, “Telefone”, “Data de nascimento” e “E-mail” são obrigatórias para todos os sócios e por isso devem ter “(*)”",
    functionalMutation,
    async ({ page }) => {
      const partnerFields = [
        "NO_PESSOA",
        "NU_CPFCNPJ",
        "DT_NASCIMENTO",
        "NU_DDD_CEL",
        "NU_CELULAR",
        "NO_EMAIL",
      ];
      for (const field of partnerFields) {
        const input = page.locator(`[name="${field}"]`).first();
        await expect(input).toBeVisible();
        const id = await input.getAttribute("id");
        expect(id).not.toBeNull();

        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toContainText("*");
      }
    },
  );

  test(
    "GAR-PJ-08 | Telefone deve permitir apenas celular",
    functionalMutation,
    async ({ page }) => {
      const partnerCell = page.locator('[name="NU_CELULAR"]').first();
      await partnerCell.clear();
      await partnerCell.fill("212345678");
      await partnerCell.blur();

      await expect(partnerCell).toHaveAttribute("aria-invalid", "true");
      await partnerCell.clear();
    },
  );
});
