import { registerClientCases, type ClientCase } from "../../support/client-cases";

const cases = [
  {
    id: "DETALHE-01",
    rule: "O botão não estará em tela, será via jornada a partir da proposta e será habilitado apenas quando cadastro completo",
    sourceStatus: "NOK",
    sourceObservation: "Botão está aparecendo",
  },
] as const satisfies readonly ClientCase[];

beforeEach(() => {
  cy.openDefaultProposal();
  cy.contains("h2", "Cadastro da Proposta").should("be.visible");
});

const implementations = {
  "DETALHE-01": () => {
    cy.contains("Ainda faltam campos obrigatórios").should("be.visible");
    cy.contains("button", /Ver Detalhes da Operação/i).should("not.exist");
  },
};

registerClientCases("Detalhamento", cases, implementations);
