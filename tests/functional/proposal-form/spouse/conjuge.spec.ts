import { expect, test } from "../../../fixtures/test";
import type { Page } from "@playwright/test";
import type { ProposalPage } from "../../../pages/proposal.page";

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

test.describe("Cadastro da Operação: Dados do Cônjuge", () => {
  test.beforeEach(async ({ proposalsPage, proposalPage, portalConfig }) => {
    const defaultProposalId = portalConfig.testData.expectedProposal.visibleNumber;
    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(defaultProposalId);
    await proposalPage.waitUntilReady();
    await proposalPage.tabs.select("Sobre Você");

    // Define estado civil como Casado (2)
    const civilStatusSelect = proposalPage.getFieldByName("PESSOA.CO_ESTCIV");
    await civilStatusSelect.selectOption("2");

    // Seleciona a aba Cônjuge
    await proposalPage.tabs.select("Cônjuge");
    await expect(proposalPage.getFieldByName("CONJUGE.NO_PESSOA")).toBeVisible();
  });

  test.afterEach(async ({ proposalPage, page }) => {
    // Retorna para Sobre Você
    await proposalPage.tabs.select("Sobre Você");

    const civilStatusSelect = proposalPage.getFieldByName("PESSOA.CO_ESTCIV");
    await civilStatusSelect.selectOption("");

    // Salva o estado limpando o cônjuge ao navegar para Composição de Renda
    await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          response.request().method() === "PUT" &&
          url.pathname.includes("/cadastro")
        );
      }, { timeout: 30000 }),
      proposalPage.tabs.select("Composição de Renda"),
    ]);
  });

  test(
    "CONJ-01 | Se o estado civil diferente de casado ou convivente não habilita aba cônjuge, demais opções deverá habilitar o preenchimento",
    functionalMutation,
    async ({ proposalPage }) => {
      // Vai para Sobre Você
      await proposalPage.tabs.select("Sobre Você");

      const civilStatusSelect = proposalPage.getFieldByName("PESSOA.CO_ESTCIV");
      
      // Seleciona Solteiro (1)
      await civilStatusSelect.selectOption("1");
      const spouseTab = proposalPage.tabs.getTabButton("Cônjuge");
      await expect(spouseTab).toHaveCount(0);

      // Seleciona Casado (2)
      await civilStatusSelect.selectOption("2");
      await expect(spouseTab).toHaveCount(1);
      await expect(spouseTab).toBeVisible();

      // Seleciona Convivente (9)
      await civilStatusSelect.selectOption("9");
      await expect(spouseTab).toHaveCount(1);
      await expect(spouseTab).toBeVisible();
    },
  );

  test(
    "CONJ-02 | É de preenchimento obrigatório os campos: Nome do Cônjuge, CPF, Data de Nascimento e Regime de Comunhão. E por isso são sinalizados com (*)",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const requiredFields = [
        "CONJUGE.NO_PESSOA",
        "CONJUGE.NU_CPFCNPJ",
        "CONJUGE.DT_NASCIMENTO",
        "PESSOA.CO_REGIME_CASAMENTO",
      ];
      for (const field of requiredFields) {
        await expectRequired(page, proposalPage, field);
      }
    },
  );

  test(
    "CONJ-03 | É de preenchimento opcional Data de Comunhão, E-mail e Telefone. Sendo sinalizados como opcional",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const optionalFields = [
        "PESSOA.DT_CASAMENTO",
        "CONJUGE.NO_EMAIL",
        "CONJUGE.NU_DDD_CEL",
        "CONJUGE.NU_CELULAR",
      ];
      for (const field of optionalFields) {
        await expectOptional(page, proposalPage, field);
      }
    },
  );

  test(
    "CONJ-04 | O campo telefone deve possuir o DDD",
    functionalMutation,
    async ({ proposalPage }) => {
      const dddInput = proposalPage.getFieldByName("CONJUGE.NU_DDD_CEL");
      const phoneInput = proposalPage.getFieldByName("CONJUGE.NU_CELULAR");
      await expect(dddInput).toBeVisible();
      await expect(phoneInput).toBeVisible();
    },
  );

  test(
    "CONJ-05 | O campo CPF deve ser um campo válido",
    functionalMutation,
    async ({ proposalPage }) => {
      const cpfInput = proposalPage.getFieldByName("CONJUGE.NU_CPFCNPJ");
      await cpfInput.clear();
      await cpfInput.fill("11111111111");
      await cpfInput.blur();

      await expect(cpfInput).toHaveAttribute("aria-invalid", "true");
      await cpfInput.clear();
    },
  );

  test(
    "CONJ-06 | Data de nascimento deverá permitir apenas números",
    functionalMutation,
    async ({ proposalPage }) => {
      const field = proposalPage.getFieldByName("CONJUGE.DT_NASCIMENTO");
      await field.clear();
      await field.pressSequentially("abc01012000");
      
      const val = await field.inputValue();
      expect(/[a-z]/i.test(val)).toBe(false);
      await field.clear();
    },
  );

  test(
    "CONJ-07 | Data de comunhão deverá permitir apenas números",
    functionalMutation,
    async ({ proposalPage }) => {
      const field = proposalPage.getFieldByName("PESSOA.DT_CASAMENTO");
      await field.clear();
      await field.pressSequentially("abc01012000");

      const val = await field.inputValue();
      expect(/[a-z]/i.test(val)).toBe(false);
      await field.clear();
    },
  );

  test(
    "CONJ-08 | Telefone deverá permitir apenas números",
    functionalMutation,
    async ({ proposalPage }) => {
      const dddField = proposalPage.getFieldByName("CONJUGE.NU_DDD_CEL");
      const phoneField = proposalPage.getFieldByName("CONJUGE.NU_CELULAR");

      await dddField.clear();
      await dddField.pressSequentially("ab11");
      const dddVal = await dddField.inputValue();

      await phoneField.clear();
      await phoneField.pressSequentially("abc912345678");
      const phoneVal = await phoneField.inputValue();

      await dddField.clear();
      await phoneField.clear();

      expect(/[a-z]/i.test(dddVal)).toBe(false);
      expect(/[a-z]/i.test(phoneVal)).toBe(false);
    },
  );

  test(
    "CONJ-09 | Não será permitido finalizar o nome e e-mail com espaço",
    functionalMutation,
    async ({ proposalPage, page }) => {
      const nameInput = proposalPage.getFieldByName("CONJUGE.NO_PESSOA");
      const emailInput = proposalPage.getFieldByName("CONJUGE.NO_EMAIL");

      await nameInput.clear();
      await nameInput.fill("Nome Teste ");

      await emailInput.clear();
      await emailInput.fill("teste@exemplo.com ");

      // Salva navegando para outra aba
      await Promise.all([
        page.waitForResponse((response) => {
          const url = new URL(response.url());
          return (
            response.request().method() === "PUT" &&
            url.pathname.includes("/cadastro")
          );
        }, { timeout: 30000 }),
        proposalPage.tabs.select("Motivo da Contratação"),
      ]);

      // Retorna para a aba Cônjuge
      await proposalPage.tabs.select("Cônjuge");

      await expect(nameInput).toHaveValue("Nome Teste");
      await expect(emailInput).toHaveValue("teste@exemplo.com");

      await nameInput.clear();
      await emailInput.clear();
    },
  );

  test(
    "CONJ-10 | O regime de comunhão deverá ser uma lista: Comunhão Universal de Bens, Separação Total de Bens, Comunhão Parcial de Bens, Participação Final nos Aquestos, União Estável, Separação Obrigatória de Bens",
    functionalMutation,
    async ({ proposalPage }) => {
      const expected = [
        "Comunhão Universal de Bens",
        "Separação Total de Bens",
        "Comunhão Parcial de Bens",
        "Participação Final nos Aquestos",
        "União Estável",
        "Separação Obrigatória de Bens",
      ];
      const combobox = proposalPage.getSearchableCombobox("PESSOA.CO_REGIME_CASAMENTO");
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
});
