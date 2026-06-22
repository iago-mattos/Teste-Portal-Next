import { registerClientCases, type ClientCase } from "../../support/client-cases";
import { portalConnect } from "../../config/active-connect";

const cases = [
  {
    id: "LOGIN-01",
    rule: "O portal do cadastro tem uma URL única, onde é permitida a entrada do cliente sendo enviada por e-mail a cada simulação que ele fizer e tokenizada",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "LOGIN-02",
    rule: "O link será único para todos os clientes e será validado por token enviado por e-mail a cada login",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "LOGIN-03",
    rule: "Em caso de sucesso, direcionar para página de simulações realizadas pelo cliente. Deverá constar todas as simulações, em todos os status.",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "LOGIN-04",
    rule: "Ao consultar proposta com CPF/CNPJ inválido, deverá apresentar a mensagem “CPF/CNPJ invalido.” sem enviar a solicitação de login",
    sourceStatus: "OK",
    sourceObservation: null,
  },
] as const satisfies readonly ClientCase[];

const implementations = {
  "LOGIN-01": () => {
    expect(portalConnect.accessUrl).to.match(
      new RegExp(`^${Cypress._.escapeRegExp(portalConnect.portalUrl)}/?\\?.+`),
    );
    cy.openProposalList();
    cy.wait(2_000);
    cy.location("pathname").should("equal", portalConnect.paths.propostas);
    cy.wait(3_000);
  },
  "LOGIN-02": () => {
    cy.openProposalList();
    cy.contains("h1", "Minhas propostas").should("be.visible");
    cy.contains(/Link de acesso inv[aá]lido ou expirado/i).should("not.exist");
  },
  "LOGIN-03": () => {
    cy.openProposalList();
    cy.contains("h1", "Minhas propostas").should("be.visible");
    cy.contains(
      `Proposta #${portalConnect.testData.expectedProposal.visibleNumber}`,
    ).should("be.visible");
  },
  "LOGIN-04": () => {
    let loginRequests = 0;
    cy.intercept("POST", "**/api/auth/login", () => {
      loginRequests += 1;
    });

    cy.portalVisit("/");
    cy.contains(/Consultar proposta/i, { timeout: 30_000 }).click();
    cy.location("pathname").should("equal", portalConnect.paths.login);

    cy.getByName("cpfCnpj").type(portalConnect.testData.cpfInvalido);
    cy.contains("button", "Continuar").click();

    cy.contains('[role="alert"]', "CPF invalido.").should("be.visible");
    cy.then(() => {
      expect(loginRequests, "requisicoes de login").to.equal(0);
    });
  },
};

registerClientCases("Login", cases, implementations);
