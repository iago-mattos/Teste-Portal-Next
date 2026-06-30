describe("Abertura da proposta padrao", () => {
  it("abre a proposta configurada no connect.ts", () => {
    cy.writeFile(".codex-tmp/open-proposal-smoke.json", {
      step: "inicio",
      at: new Date().toISOString(),
    });

    cy.openDefaultProposal();
    cy.writeFile(".codex-tmp/open-proposal-smoke.json", {
      step: "proposta aberta",
      at: new Date().toISOString(),
    });
  });
});
