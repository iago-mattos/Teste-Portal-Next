import { portalConnect } from "../config/active-connect";

describe("Abertura da proposta padrao", () => {
  it("abre a proposta configurada no connect.ts", () => {
    cy.writeFile(".codex-tmp/open-proposal-smoke.json", {
      step: "inicio",
      at: new Date().toISOString(),
    });

    cy.portalSession();
    cy.writeFile(".codex-tmp/open-proposal-smoke.json", {
      step: "sessao criada",
      at: new Date().toISOString(),
    });

    cy.visit(portalConnect.paths.propostas);
    cy.contains("h1", "Minhas propostas", { timeout: 30_000 }).should(
      "be.visible",
    );
    cy.writeFile(".codex-tmp/open-proposal-smoke.json", {
      step: "listagem aberta",
      at: new Date().toISOString(),
    });

    cy.contains(
      "article",
      `Proposta #${portalConnect.testData.expectedProposal.visibleNumber}`,
    )
      .should("be.visible")
      .within(() => {
        cy.contains(
          "button",
          /Completar cadastro|Acompanhar proposta/i,
        ).click();
      });
    cy.writeFile(".codex-tmp/open-proposal-smoke.json", {
      step: "cta clicado",
      at: new Date().toISOString(),
    });

    cy.location("pathname", { timeout: 30_000 }).should(
      "match",
      /^\/propostas\/[^/]+$/,
    );
    cy.contains("h2", "Cadastro da Proposta", { timeout: 30_000 }).should(
      "be.visible",
    );
    cy.writeFile(".codex-tmp/open-proposal-smoke.json", {
      step: "proposta aberta",
      at: new Date().toISOString(),
    });
  });
});
