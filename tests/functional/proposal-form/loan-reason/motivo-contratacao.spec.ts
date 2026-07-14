import { expect, test } from "../../../fixtures/test";

const functionalMutation = { tag: ["@functional", "@mutation"] };

test.describe("Cadastro da Operação: Motivo da Contratação", () => {
  test.beforeEach(async ({ proposalsPage, proposalPage, portalConfig }) => {
    const defaultProposalId = portalConfig.testData.expectedProposal.visibleNumber;
    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(defaultProposalId);
    await proposalPage.waitUntilReady();

    await proposalPage.tabs.select("Motivo da Contratação");
    await expect(proposalPage.getFieldByName("CO_MOTIVO_EMPRESTIMO")).toBeVisible();
  });

  test(
    "MOTIVO-01 | Valor solicitado do Crédito, Prazo estimado, Tipo de juros devem ser preenchidos com dados do lead",
    functionalMutation,
    async ({ page, portalConfig }) => {
      const expected = portalConfig.testData.expectedProposal;
      const fields = [
        ["Valor solicitado do Crédito", expected.financedValue],
        ["Prazo estimado", expected.term.replace(/\s*meses$/i, "")],
        ["Tipo de Juros", expected.interestType],
      ] as const;

      for (const [name, value] of fields) {
        const field = page.getByRole("textbox", { name, exact: true });
        await expect(field).toBeVisible();
        await expect(field).toBeDisabled();
        await expect(field).toHaveValue(value);
      }
    },
  );

  test(
    "MOTIVO-02 | Finalidade do crédito será preenchida com a lista da prognum, permitindo os campos: “Outros”; Construções e/ou reformas; Quitar dívidas bancárias; Quitar dívidas não bancárias; Adquirir bens; Investir; Saúde",
    functionalMutation,
    async ({ proposalPage }) => {
      const expected = [
        "Outros",
        "Construção e/ou reformas",
        "Quitar dívidas bancárias",
        "Quitar dívidas não bancárias",
        "Adquirir bens",
        "Investir",
        "Saúde",
      ];
      const select = proposalPage.getFieldByName("CO_MOTIVO_EMPRESTIMO");
      const options = select.locator("option");

      // Wait for options to load from the API
      await expect(options.nth(1)).toBeAttached();

      const count = await options.count();
      const optionTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text && text.trim()) {
          optionTexts.push(text.trim());
        }
      }

      for (const item of expected) {
        expect(optionTexts).toContain(item);
      }
    },
  );

  test(
    "MOTIVO-03 | Descrição profissional / Defesa para o crédito deverá ser “Utilize esse espaço para nos contar mais sobre você e seus objetivos financeiros no momento” e esse campo deverá validar texto para não permitir palavras soltas ou menor que 10 palavras",
    functionalMutation,
    async ({ page, proposalPage }) => {
      const instruction =
        "Utilize esse espaço para nos contar mais sobre você e seus objetivos financeiros no momento";
      const validDescription =
        "Pretendo organizar minhas finanças familiares e investir em melhorias importantes para nossa residência";

      const label = page.locator("label", { hasText: instruction });
      await expect(label).toBeVisible();

      const textarea = proposalPage.getFieldByName("OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO");
      await expect(textarea).toHaveAttribute("placeholder", instruction);

      // Digita descrição curta (menor que 10 palavras)
      await textarea.clear();
      await textarea.fill("objetivo financeiro");

      // Seleciona uma finalidade para poder tentar avançar
      const select = proposalPage.getFieldByName("CO_MOTIVO_EMPRESTIMO");
      await select.selectOption("Investir");

      // Clica em Confirmar e avançar cadastro
      const advanceButton = page.locator("button", { hasText: "Confirmar e avançar cadastro" });
      await advanceButton.click();

      // Verifica que o avanço foi bloqueado (a aba ativa continua sendo "Motivo da Contratação")
      const activeTab = proposalPage.tabs.getTabButton("Motivo da Contratação");
      await expect(activeTab).toHaveAttribute("aria-selected", "true");

      // Retorna para a aba e digita descrição válida
      await proposalPage.tabs.select("Motivo da Contratação");
      await textarea.clear();
      await textarea.fill(validDescription);

      // Clica na aba Imóvel para disparar gravação do rascunho
      await proposalPage.tabs.select("Imóvel");
      await proposalPage.expectDraftSaved();

      // Limpeza / Teardown do estado no banco
      await proposalPage.tabs.select("Motivo da Contratação");
      await textarea.clear();
      await select.selectOption("");
      await proposalPage.tabs.select("Imóvel");
      await proposalPage.expectDraftSaved();
    },
  );
});
