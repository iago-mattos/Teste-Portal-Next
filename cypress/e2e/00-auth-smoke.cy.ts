describe("Autenticacao do portal", () => {
  it("cria sessao pelo accessUrl configurado", () => {
    cy.portalSession();
    cy.request("/api/auth/me")
      .its("body.autenticado")
      .should("equal", true);
  });
});
