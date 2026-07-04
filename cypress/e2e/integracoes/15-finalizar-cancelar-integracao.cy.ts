import { integrationData } from "../../config/integration-data";
import { registerClientCases, type ClientCase } from "../../support/client-cases";

const cases = [
  {
    id: "INT-CONFIRM",
    rule: "Confirma o cadastro completo e aguarda a abertura da tarefa seguinte",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "INT-CANCEL",
    rule: "Cancela a proposta na tarefa seguinte com justificativa controlada",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
] as const satisfies readonly ClientCase[];

function clickDialogAction(label: RegExp): void {
  cy.get('[role="alertdialog"], [role="dialog"]')
    .filter(":visible")
    .last()
    .within(() => {
      cy.contains("button", label).click();
    });
}

const implementations = {
  "INT-CONFIRM": () => {
    cy.openDefaultProposal();
    cy.contains('[role="tab"]', "Garantidor").click();
    cy.contains("button", /^Confirmar$/i).should("be.visible");

    cy.intercept("PUT", "**/cadastro*").as("saveBeforeConfirm");
    cy.intercept("POST", "**/finalizar").as("confirmIntegration");
    cy.contains("button", /^Confirmar$/i).click();
    cy.wait("@saveBeforeConfirm", { timeout: 30_000 })
      .its("response.statusCode")
      .should("eq", 200);

    cy.get("body").then(($body) => {
      const dialog = $body.find(
        '[role="alertdialog"]:visible, [role="dialog"]:visible',
      );
      if (dialog.length > 0) {
        clickDialogAction(/^Confirmar$/i);
      }
    });

    cy.wait("@confirmIntegration", { timeout: 60_000 }).then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(interception.response?.body?.sucesso).to.eq(true);
    });
    cy.contains(/Etapa concluída|Cadastro concluído|sucesso/i, {
      timeout: 60_000,
    }).should("be.visible");
    cy.get("body").then(($body) => {
      const continueButton = $body
        .find('[role="alertdialog"]:visible, [role="dialog"]:visible')
        .find("button")
        .filter((_, button) => /continuar|fechar|ok/i.test(button.textContent ?? ""));
      if (continueButton.length > 0) {
        cy.wrap(continueButton.first()).click();
      }
    });
  },
  "INT-CANCEL": () => {
    cy.openDefaultProposal();
    cy.contains("button", /^Cancelar$/i, { timeout: 30_000 })
      .scrollIntoView()
      .should("be.visible")
      .click();

    cy.get('[role="dialog"]:visible textarea')
      .should("be.visible")
      .type(integrationData.cancelamento.justificativa);
    cy.intercept("POST", "**/finalizar").as("cancelIntegration");
    clickDialogAction(/^Cancelar$/i);
    cy.wait("@cancelIntegration", { timeout: 60_000 }).then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(interception.response?.body?.sucesso).to.eq(true);
    });
    cy.contains(/cancelad|etapa concluída|sucesso/i, { timeout: 60_000 }).should(
      "be.visible",
    );
  },
};

registerClientCases(
  "Integrações - confirmar e cancelar proposta",
  cases,
  implementations,
);
