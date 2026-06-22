import { portalConnect } from "../config/active-connect";

interface PortalAccessPayload {
  cpf: string;
  token: string;
  proposta?: string;
}

interface PortalSessionCookieCache {
  accessUrl: string;
  cookie: Cypress.Cookie;
}

function cacheCurrentPortalCookie(
  accessUrl: string,
): Cypress.Chainable<unknown> {
  return cy.getCookie("__Host-session").then((cookie) => {
    if (!cookie) {
      throw new Error(
        "O portal autenticou, mas nao criou o cookie __Host-session.",
      );
    }

    return cy.task("writePortalSessionCookie", {
      accessUrl,
      cookie,
    } satisfies PortalSessionCookieCache);
  });
}

function requireValue(value: string, field: string): string {
  if (!value.trim()) {
    throw new Error(
      `Preencha "${field}" em cypress/config/connect.ts antes de executar este caso.`,
    );
  }

  return value;
}

function parsePortalAccessUrl(accessUrl: string): PortalAccessPayload {
  const encoded = new URL(accessUrl).search.slice(1);

  if (!encoded) {
    throw new Error("O accessUrl nao contem payload tokenizado na query string.");
  }

  const json = decodeURIComponent(escape(atob(encoded)));
  const payload = JSON.parse(json) as Partial<PortalAccessPayload>;

  if (!payload.cpf || !payload.token) {
    throw new Error("O payload do accessUrl nao contem cpf e token.");
  }

  return {
    cpf: payload.cpf,
    token: payload.token,
    proposta: payload.proposta,
  };
}

Cypress.Commands.add("portalVisit", (path = "/") => {
  requireValue(portalConnect.portalUrl, "portalUrl");
  return cy.visit(path);
});

Cypress.Commands.add("openPortalAccess", () => {
  const accessUrl = requireValue(portalConnect.accessUrl, "accessUrl");
  return cy.visit(accessUrl);
});

Cypress.Commands.add("portalSession", (accessUrlOverride?: string) => {
  const accessUrl = requireValue(
    accessUrlOverride ?? portalConnect.accessUrl,
    "accessUrl",
  );
  const access = parsePortalAccessUrl(accessUrl);
  const authenticateWithToken = (): Cypress.Chainable<unknown> =>
    cy
      .request({
        method: "POST",
        url: "/api/auth/token",
        failOnStatusCode: false,
        body: {
          codigo: access.token,
          cpfCnpj: access.cpf,
          ...(access.proposta ? { nuPretendente: access.proposta } : {}),
          semLogin: true,
        },
      })
      .then((response) => {
        if (response.status === 429) {
          throw new Error(
            "O portal bloqueou novas tentativas para este CPF/token temporariamente (HTTP 429). Aguarde o cooldown ou gere um novo link antes de rodar mais specs.",
          );
        }

        if (response.status === 401) {
          cy.visit(accessUrl);
          cy.location("pathname", { timeout: 30_000 }).should(
            "equal",
            portalConnect.paths.propostas,
          );
          cy.contains("h1", "Minhas propostas", { timeout: 30_000 }).should(
            "be.visible",
          );
          return cacheCurrentPortalCookie(accessUrl);
        }

        if (response.status !== 200) {
          throw new Error(
            `Nao foi possivel autenticar com o accessUrl. HTTP ${response.status}. Atualize accessUrl em cypress/config/connect.ts.`,
          );
        }

        return cacheCurrentPortalCookie(accessUrl);
      });

  return cy.session(
    ["portal-access", accessUrl],
    () => {
      cy.task<PortalSessionCookieCache | null>(
        "readPortalSessionCookie",
        accessUrl,
      ).then((cached) => {
        if (!cached || cached.accessUrl !== accessUrl) {
          return authenticateWithToken();
        }

        const { name, value, path, secure, httpOnly, sameSite, expiry } =
          cached.cookie;
        cy.setCookie(name, value, {
          path,
          secure,
          httpOnly,
          sameSite,
          expiry,
        });

        return cy
          .request({
            url: "/api/auth/me",
            failOnStatusCode: false,
          })
          .then((response) => {
            if (
              response.status === 200 &&
              response.body?.autenticado === true
            ) {
              return;
            }

            return authenticateWithToken();
          });
      });
      cy.visit(portalConnect.paths.propostas);
      cy.contains("h1", "Minhas propostas").should("be.visible");
      cy.location("pathname").should("equal", portalConnect.paths.propostas);
    },
    {
      cacheAcrossSpecs: true,
      validate() {
        cy.request("/api/auth/me")
          .its("body.autenticado")
          .should("equal", true);
      },
    },
  );
});

Cypress.Commands.add("openProposalList", (accessUrl?: string) => {
  cy.portalSession(accessUrl);
  cy.visit(`${portalConnect.portalUrl}${portalConnect.paths.propostas}`);
  cy.contains("h1", "Minhas propostas", { timeout: 30_000 }).should(
    "be.visible",
  );
  cy.get('article [data-slot="skeleton"]', { timeout: 30_000 }).should(
    "not.exist",
  );
  return cy.wrap(null);
});

Cypress.Commands.add("openDefaultProposal", () => {
  const proposalNumber = requireValue(
    portalConnect.testData.expectedProposal.visibleNumber,
    "testData.expectedProposal.visibleNumber",
  );

  cy.openProposalList();
  cy.contains("article", `Proposta #${proposalNumber}`, {
    timeout: 30_000,
  }).within(() => {
    cy.contains(
      "button",
      /Completar cadastro|Acompanhar proposta/i,
    ).click();
  });
  cy.location("pathname", { timeout: 30_000 }).should(
    "match",
    /^\/propostas\/[^/]+$/,
  );
  cy.contains("h2", "Cadastro da Proposta", { timeout: 30_000 }).should(
    "be.visible",
  );
  return cy.wrap(null);
});

Cypress.Commands.add("getByName", (name: string) => {
  return cy.get(`[name="${CSS.escape(name)}"]`);
});

Cypress.Commands.add(
  "selectSearchOption",
  (name: string, option: string) => {
    cy.getByName(name).click();
    cy.get('[role="listbox"]:visible').within(() => {
      cy.contains(
        '[role="option"]',
        new RegExp(`^${Cypress._.escapeRegExp(option)}$`, "i"),
      ).click();
    });
  },
);

declare global {
  namespace Cypress {
    interface Chainable {
      portalVisit(path?: string): Chainable<AUTWindow>;
      openPortalAccess(): Chainable<AUTWindow>;
      portalSession(accessUrl?: string): Chainable<null>;
      openProposalList(accessUrl?: string): Chainable<null>;
      openDefaultProposal(): Chainable<null>;
      getByName(name: string): Chainable<JQuery<HTMLElement>>;
      selectSearchOption(name: string, option: string): Chainable<void>;
    }
  }
}

export {};
