import { registerClientCases, type ClientCase } from "../../support/client-cases";

const cases = [
  {
    id: "RENDA-01",
    rule: "Deve ter informativo que é permitido compor renda com terceiros",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "RENDA-02",
    rule: "Se cliente selecionar a opção não, então não habilita outras informações",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "RENDA-03",
    rule: "Se cliente selecionar a opção sim, habilitar opção “cônjuge” ou “outra pessoa”",
    sourceStatus: "OK",
    sourceObservation: null,
  },
] as const satisfies readonly ClientCase[];

function radioSelector(label: string): Cypress.Chainable<string> {
  return cy
    .contains("label", new RegExp(`^${Cypress._.escapeRegExp(label)}$`, "i"))
    .invoke("attr", "for")
    .then((inputId) => {
      expect(inputId, `radio ${label}`).to.be.a("string").and.not.be.empty;
      return `#${CSS.escape(inputId as string)}`;
    });
}

function chooseRadio(label: string): void {
  radioSelector(label).then((selector) => {
    cy.get(selector).click({ force: true });
    radioSelector(label).then((updatedSelector) => {
      cy.get(updatedSelector).should("be.checked");
    });
  });
}

beforeEach(() => {
  cy.openDefaultProposal();
  cy.contains('[role="tab"]', "Composição de Renda").click();
  cy.wait(2_000);
});

afterEach(() => {
  cy.wait(3_000);
});

const implementations = {
  "RENDA-01": () => {
    cy.contains(
      /É possível compor renda com terceiros, preferencialmente com pessoas de vínculo familiar/i,
    ).should("be.visible");
  },
  "RENDA-02": () => {
    chooseRadio("Não");
    radioSelector("Não").then((selector) => {
      cy.get(selector).should("be.checked");
    });
    cy.contains(/Quem irá compor renda/i).should("not.exist");
  },
  "RENDA-03": () => {
    chooseRadio("Sim");
    cy.contains(/Quem irá compor renda/i).should("be.visible");
    cy.contains("label", "Conjuge").should("be.visible");
    cy.contains("label", "Outra Pessoa").should("be.visible");
    chooseRadio("Não");
    cy.contains(/Quem irá compor renda/i).should("not.exist");
  },
};

registerClientCases(
  "Cadastro da Operação: Composição de Renda",
  cases,
  implementations,
);
