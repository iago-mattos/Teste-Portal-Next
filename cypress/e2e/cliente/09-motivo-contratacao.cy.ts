import { registerClientCases, type ClientCase } from "../../support/client-cases";
import { portalConnect } from "../../config/active-connect";

const cases = [
  {
    id: "MOTIVO-01",
    rule: "Valor solicitado do Crédito, Prazo estimado, Tipo de juros devem ser preenchidos com dados do lead",
    sourceStatus: "Necessário massa",
    sourceObservation: null,
  },
  {
    id: "MOTIVO-02",
    rule: "Finalidade do crédito será preenchida com a lista da prognum, permitindo os campos: “Outros”; Construções e/ou reformas; Quitar dívidas bancárias; Quitar dívidas não bancárias; Adquirir bens; Investir; Saúde",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "MOTIVO-03",
    rule: "Descrição profissional / Defesa para o crédito deverá ser “Utilize esse espaço para nos contar mais sobre você e seus objetivos financeiros no momento” e esse campo deverá validar texto para não permitir palavras soltas ou menor que 10 palavras",
    sourceStatus: "NOK",
    sourceObservation: "Não está com o título \"Utilize...\" e salvando com palaveas soltas e inferior a 10 palavras",
  },
] as const satisfies readonly ClientCase[];

beforeEach(() => {
  cy.openDefaultProposal();
  cy.contains('[role="tab"]', "Motivo da Contratação").click();
  cy.wait(2_000);
});

afterEach(() => {
  cy.wait(3_000);
});

function getByLabel(label: string): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy
    .contains("label", label)
    .invoke("attr", "for")
    .then((id) => {
      expect(id, `campo ${label}`).to.be.a("string").and.not.be.empty;
      return cy.get(`#${CSS.escape(id as string)}`);
    });
}

const implementations = {
  "MOTIVO-01": () => {
    const expected = portalConnect.testData.expectedProposal;

    getByLabel("Valor solicitado do Crédito").should(
      "have.value",
      expected.financedValue,
    );
    getByLabel("Prazo estimado")
      .invoke("val")
      .should("match", new RegExp(`^${expected.term.replace(/\D/g, "")}`));
    getByLabel("Tipo de Juros").should("have.value", expected.interestType);
  },
  "MOTIVO-02": () => {
    const expected = [
      "Outros",
      "Construção e/ou reformas",
      "Quitar dívidas bancárias",
      "Quitar dívidas não bancárias",
      "Adquirir bens",
      "Investir",
      "Saúde",
    ];
    cy.getByName("CO_MOTIVO_EMPRESTIMO").find("option").then(($options) => {
      const options = [...$options].map((option) => option.textContent?.trim());
      for (const item of expected) {
        expect(options).to.include(item);
      }
    });
  },
  "MOTIVO-03": () => {
    const instruction =
      "Utilize esse espaço para nos contar mais sobre você e seus objetivos financeiros no momento";
    const validDescription =
      "Pretendo organizar minhas finanças familiares e investir em melhorias importantes para nossa residência";
    let blockedShortDescription = false;

    cy.contains("label", instruction).should("be.visible");
    cy.getByName("OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO")
      .should("have.attr", "placeholder", instruction)
      .clear()
      .type("objetivo financeiro");
    cy.getByName("CO_MOTIVO_EMPRESTIMO").select("Investir");
    cy.contains("button", "Confirmar e avançar cadastro").click();
    cy.get('[role="tab"][aria-selected="true"]')
      .invoke("text")
      .then((activeTab) => {
        blockedShortDescription = activeTab.includes("Motivo da Contratação");
      });

    cy.contains('[role="tab"]', "Motivo da Contratação").click();
    cy.getByName("OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO")
      .clear()
      .type(validDescription);
    cy.contains('[role="tab"]', "Imóvel").click();
    cy.contains(/Rascunho salvo|Dados gravados/i, { timeout: 30_000 }).should(
      "be.visible",
    );
    cy.then(() => {
      expect(
        blockedShortDescription,
        "descricao com menos de 10 palavras deve impedir o avanço",
      ).to.equal(true);
    });
  },
};

registerClientCases(
  "Cadastro da Operação: Motivo da Contratação",
  cases,
  implementations,
);
