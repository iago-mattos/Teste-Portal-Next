import { expect, test } from "../../../fixtures/test";
import type { Page } from "@playwright/test";
import type { ProposalPage } from "../../../pages/portal/proposal.page";

const functionalMutation = { tag: ["@functional", "@mutation"] };

async function chooseRadio(page: Page, labelText: string): Promise<void> {
  const panel = page.getByRole("tabpanel", { name: "Composição de Renda" });
  const radio = panel.getByRole("radio", { name: labelText, exact: true });
  await expect(radio).toBeVisible();
  const isChecked = await radio.isChecked();
  if (!isChecked) {
    await radio.check();
  }
  await expect(radio).toBeChecked();
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

test.describe("Cadastro de Operação: Composição de Renda com terceiros", () => {
  test.beforeEach(async ({ proposalsPage, proposalPage, portalConfig, page, teardownRegistry }) => {
    const defaultProposalId = portalConfig.testData.expectedProposal.visibleNumber;
    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(defaultProposalId);
    await proposalPage.waitUntilReady();

    await proposalPage.tabs.select("Composição de Renda");
    await expect(page.getByText(/Composição de Renda/i).first()).toBeVisible();

    // Registra restauração da composição de renda no teardownRegistry
    teardownRegistry.add(async () => {
      await chooseRadio(page, "Não");
    });

    await chooseRadio(page, "Sim");

    const outraPessoaLabel = page.locator("label", { hasText: /^Outra Pessoa$/i });
    await expect(outraPessoaLabel).toBeVisible();
    await chooseRadio(page, "Outra Pessoa");

    await expect(page.getByText("Dados do Parente para Composição de Renda")).toBeVisible();
  });

  test(
    "RENDA-TERC-01 | Se terceiro, habilitar campos: Nome Completo, CPF, Data de Nascimento Renda, Profissão e Tipo de Profissão, Telefone de Contato e E-mail para preenchimento.",
    functionalMutation,
    async ({ proposalPage }) => {
      const fields = [
        "PESSOA.NO_PESSOA",
        "PESSOA.NU_CPFCNPJ",
        "PESSOA.DT_NASCIMENTO",
        "PESSOA.VA_RENDA_BRUTA",
        "PESSOA.CO_PROFISSAO",
        "PESSOA.CO_ATIVIDADE_PROFISSIONAL",
        "PESSOA.NU_DDD_CEL",
        "PESSOA.NU_CELULAR",
        "PESSOA.NO_EMAIL",
      ];
      for (const field of fields) {
        await expect(proposalPage.getFieldByName(field)).toBeVisible();
      }
    },
  );

  test(
    "RENDA-TERC-02 | Para preenchimento obrigatório temos: Nome Completo, CPF, Data de Nascimento, Renda, Profissão e Tipo de Profissão, Telefone de Contato e E-mail E por isso são sinalizados com (*)",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const requiredFields = [
        "PESSOA.NO_PESSOA",
        "PESSOA.NU_CPFCNPJ",
        "PESSOA.DT_NASCIMENTO",
        "PESSOA.VA_RENDA_BRUTA",
        "PESSOA.CO_PROFISSAO",
        "PESSOA.CO_ATIVIDADE_PROFISSIONAL",
        "PESSOA.NU_DDD_CEL",
        "PESSOA.NU_CELULAR",
        "PESSOA.NO_EMAIL",
      ];
      for (const field of requiredFields) {
        await expectRequired(page, proposalPage, field);
      }
    },
  );

  test(
    "RENDA-TERC-03 | O campo CPF seve ser um campo válido",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const cpfInput = proposalPage.getFieldByName("PESSOA.NU_CPFCNPJ");
      await cpfInput.clear();
      await cpfInput.fill("11111111111");
      await cpfInput.blur();

      const alert = page.locator('[role="alert"]', { hasText: "CPF/CNPJ invalido." });
      await expect(alert).toBeVisible();
      await cpfInput.clear();
    },
  );

  test(
    "RENDA-TERC-04 | Data de nascimento deverá permitir apenas números",
    functionalMutation,
    async ({ proposalPage }) => {
      const field = proposalPage.getFieldByName("PESSOA.DT_NASCIMENTO");
      await field.clear();
      await field.pressSequentially("abc01012000");

      const val = await field.inputValue();
      expect(val.toLowerCase()).not.toContain("abc");
      await field.clear();
    },
  );

  test(
    "RENDA-TERC-05 | Telefone deverá permitir apenas números",
    functionalMutation,
    async ({ proposalPage }) => {
      const dddField = proposalPage.getFieldByName("PESSOA.NU_DDD_CEL");
      await dddField.clear();
      await dddField.pressSequentially("ab11");
      await expect(dddField).toHaveValue("11");

      const phoneField = proposalPage.getFieldByName("PESSOA.NU_CELULAR");
      await phoneField.clear();
      await phoneField.pressSequentially("abc912345678");

      const phoneVal = await phoneField.inputValue();
      expect(phoneVal).not.toMatch(/[a-z]/i);

      await dddField.clear();
      await phoneField.clear();
    },
  );

  test(
    "RENDA-TERC-06 | Não será permitido finalizar o nome e e-mail com espaço",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const nameInput = proposalPage.getFieldByName("PESSOA.NO_PESSOA");
      const emailInput = proposalPage.getFieldByName("PESSOA.NO_EMAIL");

      await nameInput.clear();
      await nameInput.fill("Terceiro Cypress ");

      await emailInput.clear();
      await emailInput.fill("terceiro.cypress@exemplo.com ");

      // Salva navegando para outra aba
      await proposalPage.tabs.select("Motivo da Contratação");
      await proposalPage.expectDraftSaved();

      // Retorna para a aba Composição de Renda
      await proposalPage.tabs.select("Composição de Renda");
      await chooseRadio(page, "Sim");
      await chooseRadio(page, "Outra Pessoa");
      await expect(page.getByText("Dados do Parente para Composição de Renda")).toBeVisible();

      const nameVal = await nameInput.inputValue();
      expect(nameVal.trim()).toBe("Terceiro Cypress");
      expect(/\s$/.test(nameVal)).toBe(false);

      const emailVal = await emailInput.inputValue();
      expect(emailVal.trim()).toBe("terceiro.cypress@exemplo.com");
      expect(/\s$/.test(emailVal)).toBe(false);

      await nameInput.clear();
      await emailInput.clear();
    },
  );

  test(
    "RENDA-TERC-07 | O campo renda deve aceitar apenas valores numéricos. Valores diferentes de numérico não deverão ser aceitos, mostrando em tela um erro",
    functionalMutation,
    async ({ proposalPage }) => {
      const field = proposalPage.getFieldByName("PESSOA.VA_RENDA_BRUTA");
      await field.clear();
      await field.pressSequentially("abc123");

      const val = await field.inputValue();
      expect(val.toLowerCase()).not.toContain("abc");
      await field.clear();
    },
  );

  test(
    "RENDA-TERC-08 | O campo profissão do cônjuge deve conter as mesmas profissões da lista existente na prognum em originação, no campo profissão, não considerando: Outros; Outros Declarantes não especificados; Outros servidores civis e militares; outros trabal de nivel superior, ligados ao ensino; Outros trabalhadores administrativos e assemelhado; Outros trabalhadores de serviços assemelhados; Outros Trabalhadores do comercio e assemelhados",
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
      const combobox = proposalPage.getSearchableCombobox("PESSOA.CO_PROFISSAO");
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
    "RENDA-TERC-09 | O campo profissão do cônjuge deve permitir o cliente digitar para filtrar as opções sem necessidade ficar rolando a barra",
    functionalMutation,
    async ({ proposalPage }) => {
      const combobox = proposalPage.getSearchableCombobox("PESSOA.CO_PROFISSAO");
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
    "RENDA-TERC-10 | O campo tipo de profissão do cônjuge deve ter os mesmos campos do campo tipo de funcionário, sendo: Autônomo, Empresário, Pensionista, Profissional Liberal, Aposentado, Renda de Aluguel, Produtor Rural, Assalariado",
    functionalMutation,
    async ({ proposalPage }) => {
      const select = proposalPage.getFieldByName("PESSOA.CO_ATIVIDADE_PROFISSIONAL");
      const options = select.locator("option");

      // Wait for options to be loaded from the API
      await expect(options.nth(1)).toBeAttached();

      const count = await options.count();
      const optionTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        const trimmed = text?.trim();
        if (trimmed && trimmed !== "Selecione") {
          optionTexts.push(trimmed);
        }
      }
      expect(optionTexts).toEqual([
        "AUTONOMO",
        "EMPRESARIO",
        "PENSIONISTA",
        "PROFISSIONAL LIBERAL",
        "APOSENTADO",
        "RENDA DE ALUGUEL",
        "PRODUTOR RURAL",
        "ASSALARIADO",
      ]);
    },
  );

  test(
    "RENDA-TERC-11 | Deve ser obrigatório o preenchimento de “Autorizo a consulta de dados dos demais participantes no Sistema de informações de crédito (SCR) e demais instituições de proteções e fraudes, lavagem de dinheiro e risco de crédito",
    functionalMutation,
    async ({ page, proposalPage }) => {
      await expectRequired(page, proposalPage, "PESSOA.IN_AUTORZC");
    },
  );
});
