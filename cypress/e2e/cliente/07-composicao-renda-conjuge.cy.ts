import { registerClientCases, type ClientCase } from "../../support/client-cases";

const cases = [
  {
    id: "RENDA-CONJ-01",
    rule: "Se cônjuge habilitar campos: Renda do cônjuge, Profissão do Conjuge e Tipo de Profissão do Cônjuge para preenchimento obrigatório E por isso são sinalizados com (*)",
    sourceStatus: "NOK",
    sourceObservation: "Renda do cônjuge, Profissão do Conjuge  não estão obrigatórios",
  },
  {
    id: "RENDA-CONJ-02",
    rule: "O campo renda deve aceitar apenas valores numéricos. Valores diferentes de numérico não deverão ser aceitos, mostrando em tela um erro",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "RENDA-CONJ-03",
    rule: "O campo profissão do cônjuge deve conter as mesmas profissões da lista existente na prognum em originação, no campo profissão, não considerando: Outros; Outros Declarantes não especificados; Outros servidores civis e militares; outros trabal de nivel superior, ligados ao ensino; Outros trabalhadores administrativos e assemelhado; Outros trabalhadores de serviços assemelhados; Outros Trabalhadores do comercio e assemelhados",
    sourceStatus: "NOK",
    sourceObservation: "Possui outros",
  },
  {
    id: "RENDA-CONJ-04",
    rule: "O campo profissão do cônjuge deve permitir o cliente digitar para filtrar as opções sem necessidade ficar rolando a barra",
    sourceStatus: "NOK",
    sourceObservation: "Não está habilitando para filtrar",
  },
  {
    id: "RENDA-CONJ-05",
    rule: "O campo tipo de profissão do cônjuge deve ter os mesmos campos do campo tipo de funcionário, sendo: Autônomo, Empresário, Pensionista, Profissional Liberal, Aposentado, Renda de Aluguel, Produtor Rural, Assalariado",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "RENDA-CONJ-06",
    rule: "Deve ser obrigatório o preenchimento de “Autorizo a consulta de dados dos demais participantes no Sistema de informações de crédito (SCR) e demais instituições de proteções e fraudes, lavagem de dinheiro e risco de crédito",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
] as const satisfies readonly ClientCase[];

function radioSelector(label: string): Cypress.Chainable<string> {
  return cy
    .contains("label", new RegExp(`^${Cypress._.escapeRegExp(label)}$`, "i"))
    .invoke("attr", "for")
    .then((inputId) => {
      expect(inputId, `radio ${label}`).to.be.a("string").and.not.be.empty;
      return `#${CSS.escape(inputId as string)}`;
    });
}

function chooseRadio(label: string): void {
  radioSelector(label).then((selector) => {
    cy.get(selector).click({ force: true });
    radioSelector(label).then((updatedSelector) => {
      cy.get(updatedSelector).should("be.checked");
    });
  });
}

function expectRequired(name: string): void {
  cy.getByName(name).then(($field) => {
    const id = $field.attr("id");
    expect(id, `id de ${name}`).to.be.a("string").and.not.be.empty;
    cy.get(`label[for="${CSS.escape(id as string)}"]`).should(
      "contain.text",
      "*",
    );
  });
}

beforeEach(() => {
  cy.openDefaultProposal();
  cy.contains('[role="tab"]', "Composição de Renda").click();
  chooseRadio("Sim");
  chooseRadio("Conjuge");
  cy.contains("Dados do Cônjuge para Composição de Renda").should(
    "be.visible",
  );
  cy.wait(2_000);
});

afterEach(() => {
  cy.wait(3_000);
});

const implementations = {
  "RENDA-CONJ-01": () => {
    for (const field of [
      "CONJUGE.VA_RENDA_BRUTA",
      "CONJUGE.CO_PROFISSAO",
      "CONJUGE.CO_ATIVIDADE_PROFISSIONAL",
    ]) {
      cy.getByName(field).should("be.visible");
      expectRequired(field);
    }
  },
  "RENDA-CONJ-02": () => {
    cy.getByName("CONJUGE.VA_RENDA_BRUTA")
      .clear()
      .type("abc123")
      .invoke("val")
      .then((value) => {
        expect(String(value).toLowerCase()).not.to.contain("abc");
      });
  },
  "RENDA-CONJ-03": () => {
    const forbidden = [
      "Outros",
      "Outros Declarantes não especificados",
      "Outros servidores civis e militares",
      "Outros trabal de nivel superior, ligados ao ensino",
      "Outros trabalhadores administrativos e assemelhado",
      "Outros trabalhadores de serviços assemelhados",
      "Outros Trabalhadores do comercio e assemelhados",
    ];
    cy.getByName("CONJUGE.CO_PROFISSAO").click();
    cy.get('[role="listbox"]:visible [role="option"]').then(($options) => {
      const options = [...$options].map((option) =>
        option.textContent?.trim().toLowerCase(),
      );
      for (const item of forbidden) {
        expect(options).not.to.include(item.toLowerCase());
      }
    });
  },
  "RENDA-CONJ-04": () => {
    cy.getByName("CONJUGE.CO_PROFISSAO").click().type("ADMIN");
    cy.get('[role="listbox"]:visible').within(() => {
      cy.contains('[role="option"]', "ADMINISTRADOR").should("be.visible");
      cy.get('[role="option"]').each(($option) => {
        expect($option.text().toUpperCase()).to.contain("ADMIN");
      });
    });
  },
  "RENDA-CONJ-05": () => {
    cy.getByName("CONJUGE.CO_ATIVIDADE_PROFISSIONAL").click();
    cy.get('[role="listbox"]:visible [role="option"]').then(($options) => {
      expect(
        [...$options]
          .map((option) => option.textContent?.trim())
          .filter(Boolean),
      ).to.deep.equal([
        "AUTONOMO",
        "EMPRESARIO",
        "PENSIONISTA",
        "PROFISSIONAL LIBERAL",
        "APOSENTADO",
        "RENDA DE ALUGUEL",
        "PRODUTOR RURAL",
        "ASSALARIADO",
      ]);
    });
  },
  "RENDA-CONJ-06": () => {
    cy.getByName("CONJUGE.IN_AUTORZC").should("be.visible");
    expectRequired("CONJUGE.IN_AUTORZC");
  },
};

registerClientCases(
  "Cadastro de Operação: Composição de Renda com cônjuge",
  cases,
  implementations,
);
