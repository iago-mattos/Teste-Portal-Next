import "./commands";
import { setPortalRuntimeConfig } from "../config/active-connect";
import type {
  PortalConnect,
  PortalEnvironment,
} from "../config/runtime-config";

let react418QuarantineEnabled = false;

before(() => {
  cy.env<{
    allowReact418Quarantine: boolean;
    portalConnect: PortalConnect;
    portalEnvironment: PortalEnvironment;
  }>([
    "allowReact418Quarantine",
    "portalConnect",
    "portalEnvironment",
  ]).then((runtime) => {
    setPortalRuntimeConfig(runtime.portalConnect, runtime.portalEnvironment);
    react418QuarantineEnabled = runtime.allowReact418Quarantine;
  });
});

// Quarentena temporaria e explicita para o defeito conhecido de hidratacao.
// Responsavel: time do frontend Portal. Revisar ate 31/08/2026.
Cypress.on("uncaught:exception", (error) => {
  if (
    react418QuarantineEnabled &&
    error.message.includes("Minified React error #418")
  ) {
    Cypress.log({
      name: "quarantine",
      message: "React #418 conhecido; execucao autorizada explicitamente.",
      consoleProps: () => ({ error }),
    });
    return false;
  }
});
