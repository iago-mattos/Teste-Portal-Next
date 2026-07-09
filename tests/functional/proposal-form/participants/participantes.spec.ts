import { expect, test } from "../../../fixtures/test";

const functionalMutation = { tag: ["@functional", "@mutation"] };

test.describe("Cadastro da Operação: Participantes", () => {
  test.beforeEach(async ({ proposalsPage, proposalPage, portalConfig }) => {
    const defaultProposalId = portalConfig.testData.expectedProposal.visibleNumber;
    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(defaultProposalId);
    await proposalPage.waitUntilReady();
  });

  test(
    "PART-01 | A aba Participantes deve ser a primeira aba habilitada, junto com Composição de Renda, Motivo da Contratação e Imóvel",
    functionalMutation,
    async ({ proposalPage }) => {
      const requiredTabs = [
        "Sobre Você",
        "Composição de Renda",
        "Motivo da Contratação",
        "Imóvel",
      ];
      const tabs = proposalPage.tabs.tabs;
      await expect(tabs.first()).toBeVisible();

      const count = await tabs.count();
      const renderedTabs: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await tabs.nth(i).textContent();
        if (text) {
          renderedTabs.push(text.trim());
        }
      }

      expect(renderedTabs[0]).toBe("Sobre Você");
      const filteredTabs = renderedTabs.filter((tab) => requiredTabs.includes(tab));
      expect(filteredTabs).toEqual(requiredTabs);

      const firstTab = proposalPage.tabs.getTabButton("Sobre Você");
      await expect(firstTab).toHaveAttribute("aria-selected", "true");
    },
  );

  test(
    "PART-02 | É de preenchimento obrigatório os campos: Renda, Estado Civil, Nacionalidade, Profissão e Tipo de profissão E por isso são sinalizados com (*)",
    functionalMutation,
    async ({ page }) => {
      const labels = [
        /^Renda\s*\*?$/,
        /^Estado Civil\s*\*?$/,
        /^Nacionalidade\s*\*?$/,
        /^Profissão\s*\*?$/,
        /^Tipo de Profissão\s*\*?$/,
      ];
      for (const label of labels) {
        const element = page.locator("label", { hasText: label });
        await expect(element).toContainText("*");
      }
    },
  );

  test(
    "PART-03 | O campo renda deve aceitar apenas valores numéricos. Valores diferentes de numérico não deverão ser aceitos, mostrando em tela um erro",
    functionalMutation,
    async ({ proposalPage }) => {
      const rendaInput = proposalPage.getFieldByName("PESSOA.VA_RENDA_BRUTA");
      await rendaInput.clear();
      await rendaInput.pressSequentially("abc123");
      const val = await rendaInput.inputValue();
      expect(val.toLowerCase()).not.toContain("abc");
    },
  );

  test(
    "PART-04 | Quando leads enviados pela WEB, a renda é coletada na simulação e deve refletir no portal cadastro para o cliente validar e alterar.",
    functionalMutation,
    async ({ proposalPage }) => {
      const rendaInput = proposalPage.getFieldByName("PESSOA.VA_RENDA_BRUTA");
      await expect(rendaInput).toBeEnabled();
      const val = await rendaInput.inputValue();
      expect(val).not.toBe("");
    },
  );

  test(
    "PART-05 | Quando lead de APP, não tem informação de renda e o cliente deve permitir alterar.Quando lead de API, não tem informação de renda e o cliente deve editar",
    functionalMutation,
    async ({ proposalPage }) => {
      const rendaInput = proposalPage.getFieldByName("PESSOA.VA_RENDA_BRUTA");
      await expect(rendaInput).toBeEnabled();
      const val = await rendaInput.inputValue();
      expect(val).not.toBe("");
    },
  );

  test(
    "PART-06 | No campo Estado Civil, deve permitir a lista: Solteiro, Casado, Divorciado, Desquitado, Viúvo, Separação Judicial, Separação Consensual, Divorciado Consensualmente, Convivente",
    functionalMutation,
    async ({ proposalPage }) => {
      const expected = [
        "Solteiro",
        "Casado",
        "Divorciado",
        "Desquitado",
        "Viuvo",
        "Separação Judicial",
        "Separação Consensual",
        "Divorciado Consensualmente",
        "Convivente",
      ];
      const select = proposalPage.getFieldByName("PESSOA.CO_ESTCIV");
      const options = select.locator("option");
      await expect(options.nth(1)).toBeAttached();

      const count = await options.count();
      const optionTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text) {
          optionTexts.push(text.trim());
        }
      }

      expect(optionTexts.slice(1)).toEqual(expected);
      expect(optionTexts).not.toContain("Outros");
    },
  );

  test(
    "PART-07 | A informação de nacionalidade deve ser default brasileira, permitindo o cliente alterar",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const label = page.locator("label", { hasText: /^Nacionalidade\s*\*?$/ });
      await expect(label).toContainText("*");

      const field = proposalPage.getFieldByName("PESSOA.CO_NACIONALIDADE");
      await expect(field).toHaveAttribute("role", "combobox");
      await expect(field).toBeEnabled();
    },
  );

  test(
    "PART-08 | O campo profissão deve conter as mesmas profissões da lista existente na prognum em originação, no campo profissão, não considerando: Outros; Outros Declarantes não especificados; Outros servidores civis e militares; outros trabal de nivel superior, ligados ao ensino; Outros trabalhadores administrativos e assemelhado; Outros trabalhadores de serviços assemelhados; Outros Trabalhadores do comercio e assemelhados",
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
        if (text) {
          optionTexts.push(text.trim().toLowerCase());
        }
      }

      for (const item of forbidden) {
        expect(optionTexts).not.toContain(item.toLowerCase());
      }
    },
  );

  test(
    "PART-09 | O campo profissão deve permitir o cliente digitar para filtrar as opções sem necessidade ficar rolando a barra",
    functionalMutation,
    async ({ proposalPage }) => {
      const combobox = proposalPage.getSearchableCombobox("PESSOA.CO_PROFISSAO");
      await combobox.open();
      await combobox.search("ADMIN");

      const listbox = combobox.listbox;
      const option = listbox.getByRole("option", { name: "ADMINISTRADOR" });
      await expect(option).toBeVisible();

      const options = combobox.options;
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        expect(text?.toUpperCase()).toContain("ADMIN");
      }

      await combobox.input.clear();
    },
  );

  test(
    "PART-10 | O campo tipo de profissão deve ter os mesmos campos do campo tipo de funcionário, sendo: Autônomo, Empresário, Pensionista, Profissional Liberal, Aposentado, Renda de Aluguel, Produtor Rural, Assalariado",
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
      const combobox = proposalPage.getSearchableCombobox("PESSOA.CO_ATIVIDADE_PROFISSIONAL");
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
    "PART-11 | O botão voltar não existirá, o cliente irá trafegar entre as abas de preenchimento e caso queira voltar, será via “voltar do browser”",
    functionalMutation,
    async ({ page }) => {
      const button = page.getByRole("button", { name: /^Voltar$/i });
      await expect(button).toHaveCount(0);
    },
  );

  test(
    "PART-12 | A opção de salvar acontecerá de duas formas: Clicando entre as abas de preenchimento Clicando em salvar e continuar",
    functionalMutation,
    async ({ proposalPage }) => {
      const rendaInput = proposalPage.getFieldByName("PESSOA.VA_RENDA_BRUTA");
      await rendaInput.clear();
      await rendaInput.pressSequentially("123456");

      await proposalPage.tabs.select("Composição de Renda");
      await proposalPage.expectDraftSaved();
    },
  );

  test(
    "PART-13 | Toda vez que salvar e tiver dado obrigatório não preenchido ele criticará, mas ainda assim salvará as informações",
    functionalMutation,
    async ({ proposalPage, page }) => {
      const rendaInput = proposalPage.getFieldByName("PESSOA.VA_RENDA_BRUTA");
      await rendaInput.clear();
      await rendaInput.pressSequentially("654321");

      await proposalPage.tabs.select("Composição de Renda");
      await proposalPage.expectDraftSaved();

      await proposalPage.tabs.select("Imóvel");

      const conditionSelect = proposalPage.getFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL");
      const originalCondition = await conditionSelect.inputValue();
      expect(originalCondition).not.toBe("");

      await conditionSelect.scrollIntoViewIfNeeded();
      await conditionSelect.selectOption("");

      const confirmButton = page.getByRole("button", { name: /^Confirmar/i });
      await confirmButton.click();

      const warning = page.getByText(/Ainda faltam campos obrigatórios/i);
      await expect(warning).toBeVisible({ timeout: 30000 });

      const dialog = proposalPage.getDialog("Revise o cadastro antes de concluir");
      await expect(dialog.root).toBeVisible();
      await dialog.clickButton("Entendi");

      await conditionSelect.selectOption(originalCondition);

      await proposalPage.tabs.select("Sobre Você");
      await proposalPage.expectDraftSaved();
    },
  );
});
