describe("Descoberta da massa configurada", () => {
  it("registra os cards disponiveis sem alterar a proposta", () => {
    cy.openProposalList();
    cy.get('article [data-slot="skeleton"]', { timeout: 30_000 }).should(
      "not.exist",
    );
    cy.get("article")
      .should("have.length.at.least", 1)
      .then(($cards) => {
        const cards = [...$cards].map((card) => ({
          text: card.innerText?.replace(/\s+/g, " ").trim() ?? "",
          html: card.outerHTML,
        }));
        cy.writeFile(".codex-tmp/discovered-proposals.json", { cards });
        cy.screenshot("discovered-proposals");
      });
    cy.get("article").first().within(() => {
      cy.contains("button", /Completar cadastro|Acompanhar proposta/i).click();
    });
    cy.location("pathname", { timeout: 30_000 }).should(
      "match",
      /^\/propostas\/[^/]+$/,
    );
    cy.location("pathname").then((pathname) => {
      cy.contains("Proponente:")
        .parent()
        .invoke("text")
        .then((header) => {
          cy.writeFile(".codex-tmp/discovered-proposal-detail.json", {
            pathname,
            header: header.replace(/\s+/g, " ").trim(),
          });
        });
    });
  });
});
