import { portalConnect } from "../config/active-connect";

interface PortalAdminConfig {
  url: string;
  username: string;
  password: string;
  cpf: string;
}

function requireValue(value: string, field: string): string {
  if (!value.trim()) {
    throw new Error(
      `Configure "${field}" nas variaveis de ambiente ou no arquivo local de compatibilidade antes de executar este caso.`,
    );
  }

  return value;
}

function validateAdminConfig(
  rawConfig: PortalAdminConfig | null,
): PortalAdminConfig {
  const config = {
    url: String(rawConfig?.url ?? "").replace(/\/$/, ""),
    username: String(rawConfig?.username ?? ""),
    password: String(rawConfig?.password ?? ""),
    cpf: String(rawConfig?.cpf ?? "").replace(/\D/g, ""),
  };
  const configuredValues = Object.values(config).filter(Boolean).length;

  if (configuredValues === 0) {
    throw new Error(
      "Geracao automatica indisponivel: configure o Admin no .env.local.",
    );
  }
  if (configuredValues !== Object.keys(config).length) {
    throw new Error(
      "Preencha PORTAL_ADMIN_URL, PORTAL_ADMIN_USER, PORTAL_ADMIN_PASSWORD e PORTAL_TEST_CPF no .env.local.",
    );
  }

  const adminUrl = new URL(config.url);
  const portalUrl = new URL(portalConnect.portalUrl);
  const safeEnvironment = /(^|[.-])(dev|hml|homolog|localhost)([.-]|$)/i.test(
    adminUrl.hostname,
  );

  if (!safeEnvironment || adminUrl.hostname !== portalUrl.hostname) {
    throw new Error(
      `Geracao automatica de link bloqueada fora de DEV/HT: ${adminUrl.hostname}`,
    );
  }

  return config;
}

function getInputByLabel(
  labelText: string,
): Cypress.Chainable<JQuery<HTMLInputElement>> {
  return cy
    .get("label")
    .filter((_, label) => label.textContent?.trim() === labelText)
    .should("have.length", 1)
    .then(($label) => {
      const inputId = $label.attr("for");

      if (inputId) {
        return cy.get<HTMLInputElement>(`#${CSS.escape(inputId)}`);
      }

      return cy.wrap($label).find<HTMLInputElement>("input");
    });
}

function authenticateWithAccessUrl(
  accessUrl: string,
): Cypress.Chainable<null> {
  cy.visit(accessUrl, { log: false });
  cy.location("pathname", { timeout: 30_000 }).should(
    "equal",
    portalConnect.paths.propostas,
  );
  cy.contains("h1", "Minhas propostas", { timeout: 30_000 }).should(
    "be.visible",
  );
  cy.getCookie("__Host-session").should("exist");
  return cy.wrap(null, { log: false });
}

Cypress.Commands.add("portalVisit", (path = "/") => {
  requireValue(portalConnect.portalUrl, "portalUrl");
  return cy.visit(path);
});

Cypress.Commands.add("openPortalAccess", () => {
  cy.portalSession();
  return cy.visit(`${portalConnect.portalUrl}${portalConnect.paths.propostas}`);
});

Cypress.Commands.add("generatePortalAccess", () => {
  return cy
    .task<PortalAdminConfig | null>("readPortalAdminConfig", null, {
      log: false,
    })
    .then((rawConfig) => {
      const admin = validateAdminConfig(rawConfig);

      cy.visit(`${admin.url}/login`);
      cy.location("pathname").then((pathname) => {
        if (pathname !== "/admin/login") return;

        getInputByLabel("Usuário").type(admin.username, { log: false });
        getInputByLabel("Senha").type(admin.password, { log: false });
        cy.contains("button", "Entrar").click();
        cy.location("pathname", { timeout: 30_000 }).should("equal", "/admin");
      });

      cy.visit(`${admin.url}/pascal`);
      cy.contains("h1", "Backend", { timeout: 30_000 }).should("be.visible");
      cy.contains("h4", "Gerar link de acesso")
        .scrollIntoView()
        .should("be.visible");
      getInputByLabel("CPF/CNPJ para o link")
        .clear({ log: false })
        .type(admin.cpf, { log: false });
      cy.contains("button", "Gerar link").should("be.enabled").click();

      return getInputByLabel("Link de acesso")
        .should("be.visible")
        .then(($input) => {
          const accessUrl = String($input.val() ?? "");
          const parsed = new URL(accessUrl);

          expect(
            parsed.origin === portalConnect.portalUrl &&
              parsed.search.length > 1,
            "link gerado para o Portal DEV/HT",
          ).to.equal(true);

          cy.contains("button", "Copiar link").click();
          cy.wrap($input).invoke("css", "filter", "blur(12px)");
          cy.contains(/^Token:/).invoke("css", "filter", "blur(12px)");

          return cy.wrap(accessUrl, { log: false });
        });
    });
});

Cypress.Commands.add("portalSession", (accessUrlOverride?: string) => {
  const fallbackAccessUrl = accessUrlOverride ?? portalConnect.accessUrl;
  const sessionId = [
    "portal-access-managed",
    portalConnect.portalUrl,
    portalConnect.testData.cpfComPropostas,
    Boolean(accessUrlOverride),
  ];

  const createFreshSession = (): Cypress.Chainable<null> =>
    cy
      .task<PortalAdminConfig | null>("readPortalAdminConfig", null, {
        log: false,
      })
      .then((rawConfig) => {
        if (!rawConfig) {
          return authenticateWithAccessUrl(
            requireValue(fallbackAccessUrl, "accessUrl"),
          );
        }

        return cy
          .generatePortalAccess()
          .then((accessUrl) => authenticateWithAccessUrl(accessUrl));
      });

  return cy.session(
    sessionId,
    () => {
      createFreshSession();
      cy.visit(`${portalConnect.portalUrl}${portalConnect.paths.propostas}`);
      cy.contains("h1", "Minhas propostas").should("be.visible");
      cy.location("pathname").should("equal", portalConnect.paths.propostas);
    },
    {
      cacheAcrossSpecs: true,
      validate() {
        cy.request(`${portalConnect.portalUrl}/api/auth/me`)
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

  const loadRemainingProposals = (): Cypress.Chainable<null> =>
    cy.get("body").then(($body) => {
      const $loadMoreButton = $body
        .find("button")
        .filter(
          (_index, button) => button.textContent?.trim() === "Carregar mais",
        );

      if ($loadMoreButton.length === 0) return cy.wrap(null);

      cy.wrap($loadMoreButton)
        .should("have.length", 1)
        .and("be.enabled")
        .click();
      cy.contains("button", "Carregando...", { timeout: 30_000 }).should(
        "not.exist",
      );
      return loadRemainingProposals();
    });

  loadRemainingProposals();
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
    cy.contains("button", /Completar cadastro|Acompanhar proposta/i).click();
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

Cypress.Commands.add("selectSearchOption", (name: string, option: string) => {
  cy.getByName(name).click();
  cy.get('[role="listbox"]:visible').within(() => {
    cy.contains(
      '[role="option"]',
      new RegExp(`^${Cypress._.escapeRegExp(option)}$`, "i"),
    ).click();
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      portalVisit(path?: string): Chainable<AUTWindow>;
      openPortalAccess(): Chainable<AUTWindow>;
      generatePortalAccess(): Chainable<string>;
      portalSession(accessUrl?: string): Chainable<null>;
      openProposalList(accessUrl?: string): Chainable<null>;
      openDefaultProposal(): Chainable<null>;
      getByName(name: string): Chainable<JQuery<HTMLElement>>;
      selectSearchOption(name: string, option: string): Chainable<void>;
    }
  }
}

export {};
