import { aejsConnect } from "../../config/aejs";
import { integrationData } from "../../config/integration-data";
import { portalConnect } from "../../config/active-connect";

function waitExtJs(timeout = 1_000): void {
  cy.wait(timeout);
}

function loginAejs(): void {
  cy.visit(aejsConnect.baseUrl);
  cy.get("input").filter(":visible").eq(0).type(aejsConnect.username);
  cy.get('input[type="password"]').type(aejsConnect.password, { log: false });
  cy.get("input").filter(":visible").eq(2).type(aejsConnect.path);
  cy.contains("Login").click();
  cy.contains("Manutenção", { timeout: 30_000 }).should("be.visible");
}

function openOperation(): void {
  const operation = portalConnect.testData.propostaPadraoId;
  cy.contains("Originação").click();
  cy.contains("Cadastro de operações").click();
  waitExtJs(2_000);
  cy.get('input[name="operacao"]')
    .should("be.visible")
    .clear()
    .type(`${operation}{enter}`);
  waitExtJs(2_000);
  cy.contains(operation).should("be.visible").dblclick();
  waitExtJs(3_000);
}

function closePersonModal(): void {
  cy.contains("span", "Fechar tela").click({ force: true });
  waitExtJs(2_000);
}

describe("Integrações - verificação no SCCI/AEJS", () => {
  it("INT-AEJS | valida os dados integrados da proposta cancelada", () => {
    loginAejs();
    openOperation();

    cy.contains('.x-tab:visible', "Pretendente").click({ force: true });
    waitExtJs(2_000);
    cy.get(".x-grid-row").filter(":visible").first().dblclick({ force: true });
    waitExtJs(3_000);

    cy.get('input[name="PESSOA$CO_ESTCIV"]')
      .should("be.visible")
      .should("have.value", "Casado");
    cy.get('input[name="PESSOA$CO_NACIONALIDADE"]').should(
      "have.value",
      integrationData.titular.nacionalidade,
    );
    cy.contains('.x-tab:visible', "Ocupação").click({ force: true });
    waitExtJs(1_500);
    cy.get('input[name="PESSOA$VA_RENDA_BRUTA"]').should(
      "have.value",
      "12.345,67",
    );
    cy.get('input[name="PESSOA$CO_PROFISSAO"]').should(
      "have.value",
      integrationData.titular.profissao,
    );
    cy.get('input[name="PESSOA$CO_ATIVIDADE_PROFISSIONAL"]').should(
      "have.value",
      integrationData.titular.tipoProfissao,
    );

    cy.contains('.x-tab:visible', "Cônjuge").click({ force: true });
    waitExtJs(1_500);
    cy.get('input[name="CONJUGE$NO_PESSOA"]').should(
      "have.value",
      integrationData.conjuge.nome,
    );
    cy.get('input[name="CONJUGE$NU_CPFCNPJ"]')
      .invoke("val")
      .should("match", /639\.766\.660-33/);
    cy.get('input[name="CONJUGE$CO_REGIME_CASAMENTO"]').should(
      "have.value",
      integrationData.conjuge.regimeComunhao,
    );
    cy.contains('.x-tab:visible', "Ocupação").click({ force: true });
    waitExtJs(1_500);
    cy.get('input[name="CONJUGE$VA_RENDA_BRUTA"]').should(
      "have.value",
      "14.000,00",
    );
    cy.get('input[name="CONJUGE$CO_PROFISSAO"]').should(
      "have.value",
      integrationData.conjuge.profissao,
    );
    cy.get('input[name="CONJUGE$CO_ATIVIDADE_PROFISSIONAL"]').should(
      "have.value",
      integrationData.conjuge.tipoProfissao,
    );
    cy.get('input[name="CONJUGE$IN_EADQUIRENTE"]').should("be.checked");
    cy.get('input[name="CONJUGE$IN_AUTORZC"]').should("be.checked");
    closePersonModal();

    cy.contains('.x-tab:visible', "Finalidade do Crédito").click({ force: true });
    waitExtJs(1_500);
    cy.contains(
      ".x-grid-cell-inner:visible",
      integrationData.motivo.finalidade,
    ).should("be.visible");
    cy.get('textarea[name="OPERACAO_CREDITO$TE_OBS_MOTIVO_EMPRESTIMO"]')
      .should("have.value", integrationData.motivo.descricao);

    cy.contains('.x-tab:visible', "Imóvel Operação").click({ force: true });
    waitExtJs(1_500);
    cy.get('input[name="IMOVEL_OPERACAO$VA_AVALIACAO_PROVISORIA"]').should(
      "have.value",
      "2.250.000,00",
    );
    cy.get('input[name="IMOVEL_OPERACAO$IN_TIPO_IMOVEL"]').should(
      "have.value",
      integrationData.imovel.tipo.toUpperCase(),
    );
    cy.get('input[name="IMOVEL_OPERACAO$IN_USO_DO_IMOVEL"]').should(
      "have.value",
      integrationData.imovel.uso,
    );
    cy.get('input[name="IMOVEL_OPERACAO$CO_CONDICAO_IMOVEL"]').should(
      "contain.value",
      "empresa",
    );
    cy.get('input[name="OPERACAO_CREDITO$VA_INTERVENIENTE"]').should(
      "have.value",
      "250.000,00",
    );
    cy.wait(3_000);
  });
});
