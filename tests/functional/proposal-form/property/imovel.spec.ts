import { expect, test } from "../../../fixtures/test";
import type { Page } from "@playwright/test";
import type { ProposalPage } from "../../../pages/proposal.page";

const functionalReadonly = { tag: ["@functional", "@readonly"] };

async function expectRequiredLabel(page: Page, proposalPage: ProposalPage, name: string): Promise<void> {
  const field = proposalPage.getFieldByName(name);
  await expect(field).toBeVisible();
  const id = await field.getAttribute("id");
  expect(id).not.toBeNull();
  expect(id).not.toBe("");

  const label = page.locator(`label[for="${id}"]`);
  await expect(label).toContainText("*");
}

test.describe("Cadastro da Operação: Imóvel", () => {
  test.beforeEach(async ({ proposalsPage, proposalPage, portalConfig }) => {
    const defaultProposalId = portalConfig.testData.expectedProposal.visibleNumber;
    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(defaultProposalId);
    await proposalPage.waitUntilReady();

    await proposalPage.tabs.select("Imóvel");
    await expect(proposalPage.getFieldByName("IMOVEL_OPERACAO.NO_ENDERECO")).toBeVisible();
  });

  test(
    "IMOVEL-01 | Valor Estimado do Imóvel, Endereço do Imóvel de garantia devem ser preenchidos com informações do lead",
    functionalReadonly,
    async ({ proposalPage }) => {
      const precoInput = proposalPage.getFieldByName("OPERACAO_CREDITO.VA_PRECO_IMOVEL");
      await expect(precoInput).not.toHaveValue("");

      const enderecoInput = proposalPage.getFieldByName("IMOVEL_OPERACAO.NO_ENDERECO");
      await expect(enderecoInput).not.toHaveValue("");
    },
  );

  test(
    "IMOVEL-02 | Terá uma mensagem informativa para o cliente: “Alteração das informações da simulação poderá ser feita no momento de negociação Comercial”",
    functionalReadonly,
    async ({ page }) => {
      const msg = "Alteração das informações da simulação poderá ser feita no momento de negociação Comercial";
      await expect(page.getByText(msg)).toBeVisible();
    },
  );

  test(
    "IMOVEL-03 | Tipo de Imóvel deve permitir: “Residencial”; “Comercial”",
    functionalReadonly,
    async ({ proposalPage }) => {
      const select = proposalPage.getFieldByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL");
      const options = select.locator("option");

      await expect(options.nth(1)).toBeAttached();

      const count = await options.count();
      const optionTexts: string[] = [];
      for (let i = 1; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text && text.trim()) {
          optionTexts.push(text.trim());
        }
      }
      expect(optionTexts).toEqual(["Residencial", "Comercial"]);
    },
  );

  test(
    "IMOVEL-04 | O campo uso do imóvel deve ser uma lista composta por: Casa, Apartamento, Casa em condomínio, Loja, Sala Comercial, Misto, Prédio Comercial, Prédio Comercial misto, Laje corporativa, Sobrado, Flat,Terreno em condominio",
    functionalReadonly,
    async ({ proposalPage }) => {
      const expected = [
        "Não Informado",
        "Casa",
        "Apartamento",
        "Casa em condomínio",
        "Loja",
        "Sala Comercial",
        "Misto",
        "Prédio Comercial",
        "Prédio Comercial misto",
        "Laje corporativa",
        "Sobrado",
        "Flat",
        "Terreno em condominio",
      ];
      const combobox = proposalPage.getSearchableCombobox("IMOVEL_OPERACAO.IN_USO_DO_IMOVEL");
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

      const normalize = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

      const actualNormalized = optionTexts.map(normalize);
      const expectedNormalized = expected.map(normalize);

      expect(actualNormalized.length).toBe(expectedNormalized.length);
      expect(actualNormalized).toEqual(expect.arrayContaining(expectedNormalized));
    },
  );

  test(
    "IMOVEL-05 | Se marcado Casa em condomínio o campo tipo do imóvel deverá ser residencial por default e não habilita para alteração",
    functionalReadonly,
    async ({ proposalPage }) => {
      const combobox = proposalPage.getSearchableCombobox("IMOVEL_OPERACAO.IN_USO_DO_IMOVEL");
      await combobox.selectOption("Casa em condomínio");

      const select = proposalPage.getFieldByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL");
      await expect(select).toBeDisabled();

      const selectedText = await select.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text);
      expect(selectedText?.trim()).toBe("Residencial");

      await combobox.selectOption("Não Informado");
    },
  );

  test(
    "IMOVEL-06 | Se marcado Loja, Sala Comercial, Misto, Prédio Comercial, Prédio Comercial misto, Laje corporativa, o campo tipo do imóvel deverá ser comercial por default e não habilita para alteração",
    functionalReadonly,
    async ({ proposalPage }) => {
      const usages = [
        "Loja",
        "Sala Comercial",
        "Misto",
        "Prédio Comercial",
        "Prédio Comercial Misto",
        "Laje corporativa",
      ];
      const combobox = proposalPage.getSearchableCombobox("IMOVEL_OPERACAO.IN_USO_DO_IMOVEL");
      const select = proposalPage.getFieldByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL");

      for (const usage of usages) {
        await combobox.selectOption(usage);
        await expect(select).toBeDisabled();

        const selectedText = await select.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text);
        expect(selectedText?.trim()).toBe("Comercial");
      }

      await combobox.selectOption("Não Informado");
    },
  );

  test(
    "IMOVEL-07 | Se marcado Casa, Apartamento, Sobrado, Flat e Terreno em condomínio o cliente deve escolher o tipo sendo campo obrigatório",
    functionalReadonly,
    async ({ page, proposalPage }) => {
      const usages = [
        "Casa",
        "Apartamento",
        "Sobrado",
        "Flat",
        "Terreno em condomínio",
      ];
      const combobox = proposalPage.getSearchableCombobox("IMOVEL_OPERACAO.IN_USO_DO_IMOVEL");
      const select = proposalPage.getFieldByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL");

      for (const usage of usages) {
        await combobox.selectOption(usage);
        await expect(select).not.toBeDisabled();

        const id = await select.getAttribute("id");
        expect(id).not.toBeNull();
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toContainText("*");
      }

      await combobox.selectOption("Não Informado");
    },
  );

  test(
    "IMOVEL-08 | Após o endereço do imóvel deve vir a pergunta “Você reside neste imóvel?”",
    functionalReadonly,
    async ({ page, proposalPage }) => {
      await proposalPage.tabs.select("Sobre Você");

      const resideInput = proposalPage.getFieldByName("PESSOA.IN_RESIDE_NO_IMOVEL");
      await expect(resideInput.first()).toBeVisible();

      const msg = page.locator("label", { hasText: "Reside no imóvel da operação" });
      await expect(msg).toBeVisible();
    },
  );

  test(
    "IMOVEL-09 | Quando o cliente selecionar “Não” deve habilitar o campo de endereço de residência para preenchimento",
    functionalReadonly,
    async ({ page, proposalPage }) => {
      const label = page.getByText("Endereço do Imóvel");
      await expect(label.first()).toBeVisible();

      const municipioInput = proposalPage.getFieldByName("IMOVEL_OPERACAO.NU_MUNICIPIO");
      await expect(municipioInput).toBeVisible();
      await expect(municipioInput).not.toHaveValue("");
    },
  );

  test(
    "IMOVEL-10 | Número do imóvel que vem do lead poderá vir em número, mas deverá ser concatenado para integração com a tela da prognum",
    functionalReadonly,
    async ({ proposalPage }) => {
      const enderecoInput = proposalPage.getFieldByName("IMOVEL_OPERACAO.NO_ENDERECO");
      await expect(enderecoInput).toBeVisible();
      await expect(enderecoInput).toHaveValue(/\d+/);
    },
  );

  test(
    "IMOVEL-11 | Condição do imóvel deverá ter a lista: Próprio, quitado; Próprio, alienado/ financiado, De terceiro, quitado; De terceiro, alienado/financiado; Em nome de empresa (CNPJ), quitado; Em nome de empresa (CNPJ), alienado/financiado",
    functionalReadonly,
    async ({ proposalPage }) => {
      const select = proposalPage.getFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL");
      const options = select.locator("option");

      await expect(options.nth(1)).toBeAttached();

      const count = await options.count();
      const optionTexts: string[] = [];
      for (let i = 1; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text && text.trim()) {
          optionTexts.push(text.trim());
        }
      }

      expect(optionTexts).toEqual([
        "Próprio quitado",
        "Próprio alienado/financiado",
        "De terceiro (PF) quitado",
        "De terceiro (PF) alienado/financiado",
        "Em nome de empresa (PJ) quitado",
        "Em nome de empresa (PJ) alienado/financiado",
      ]);
    },
  );

  test(
    "IMOVEL-12 | Caso preenchido alienado habilita campos Valor estimado saldo devedor e instituição para preenchimento obrigatório e portando deve ter “(*)”",
    functionalReadonly,
    async ({ page, proposalPage }) => {
      const select = proposalPage.getFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL");

      await select.selectOption("6");

      const intervenienteInput = proposalPage.getFieldByName("OPERACAO_CREDITO.VA_INTERVENIENTE");
      await expect(intervenienteInput).toBeVisible();
      await expectRequiredLabel(page, proposalPage, "OPERACAO_CREDITO.VA_INTERVENIENTE");

      const codigoInput = proposalPage.getFieldByName("INTERVENIENTE.CODIGO");
      await expect(codigoInput).toBeVisible();
      await expectRequiredLabel(page, proposalPage, "INTERVENIENTE.CODIGO");

      await select.selectOption("");
    },
  );
});
