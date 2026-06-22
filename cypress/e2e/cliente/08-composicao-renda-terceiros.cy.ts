import { registerClientCases, type ClientCase } from "../../support/client-cases";

const cases = [
  {
    id: "RENDA-TERC-01",
    rule: "Se terceiro, habilitar campos: Nome Completo, CPF, Data de Nascimento Renda, Profissão e Tipo de Profissão, Telefone de Contato e E-mail para preenchimento.",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "RENDA-TERC-02",
    rule: "Para preenchimento obrigatório temos: Nome Completo, CPF, Data de Nascimento, Renda, Profissão e Tipo de Profissão, Telefone de Contato e E-mail E por isso são sinalizados com (*)",
    sourceStatus: "NOK",
    sourceObservation: "Faltou incluir as marcações de obrigatoriedade",
  },
  {
    id: "RENDA-TERC-03",
    rule: "O campo CPF seve ser um campo válido",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "RENDA-TERC-04",
    rule: "Data de nascimento deverá permitir apenas números",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "RENDA-TERC-05",
    rule: "Telefone deverá permitir apenas números",
    sourceStatus: "NOK",
    sourceObservation: "Permitiu letras",
  },
  {
    id: "RENDA-TERC-06",
    rule: "Não será permitido finalizar o nome e e-mail com espaço",
    sourceStatus: "NOK",
    sourceObservation: "Permitiu espaço",
  },
  {
    id: "RENDA-TERC-07",
    rule: "O campo renda deve aceitar apenas valores numéricos. Valores diferentes de numérico não deverão ser aceitos, mostrando em tela um erro",
    sourceStatus: "OK",
    sourceObservation: "Mesmo não mostrando erro não permitiu incluir dados não numérico.",
  },
  {
    id: "RENDA-TERC-08",
    rule: "O campo profissão do cônjuge deve conter as mesmas profissões da lista existente na prognum em originação, no campo profissão, não considerando: Outros; Outros Declarantes não especificados; Outros servidores civis e militares; outros trabal de nivel superior, ligados ao ensino; Outros trabalhadores administrativos e assemelhado; Outros trabalhadores de serviços assemelhados; Outros Trabalhadores do comercio e assemelhados",
    sourceStatus: "NOK",
    sourceObservation: "Lista de outros apareceu, diferente do solicitado",
  },
  {
    id: "RENDA-TERC-09",
    rule: "O campo profissão do cônjuge deve permitir o cliente digitar para filtrar as opções sem necessidade ficar rolando a barra",
    sourceStatus: "NOK",
    sourceObservation: "Não está permitindo digitar",
  },
  {
    id: "RENDA-TERC-10",
    rule: "O campo tipo de profissão do cônjuge deve ter os mesmos campos do campo tipo de funcionário, sendo: Autônomo, Empresário, Pensionista, Profissional Liberal, Aposentado, Renda de Aluguel, Produtor Rural, Assalariado",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "RENDA-TERC-11",
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
  const labelPattern = new RegExp(
    `^${Cypress._.escapeRegExp(label)}$`,
    "i",
  );

  radioSelector(label).then((selector) => {
    cy.get(selector).then(($radio) => {
      if (!$radio.is(":checked")) {
        cy.contains("label", labelPattern).click({ force: true });
      }
    });
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
  cy.wait(1_000);
  chooseRadio("Sim");
  cy.contains(
    "label",
    new RegExp(`^${Cypress._.escapeRegExp("Outra Pessoa")}$`, "i"),
  ).should("be.visible");
  chooseRadio("Outra Pessoa");
  cy.contains("Dados do Parente para Composição de Renda").should("be.visible");
  cy.wait(2_000);
});

afterEach(() => {
  cy.wait(3_000);
});

const implementations = {
  "RENDA-TERC-01": () => {
    for (const field of [
      "PESSOA.NO_PESSOA",
      "PESSOA.NU_CPFCNPJ",
      "PESSOA.DT_NASCIMENTO",
      "PESSOA.VA_RENDA_BRUTA",
      "PESSOA.CO_PROFISSAO",
      "PESSOA.CO_ATIVIDADE_PROFISSIONAL",
      "PESSOA.NU_DDD_CEL",
      "PESSOA.NU_CELULAR",
      "PESSOA.NO_EMAIL",
    ]) {
      cy.getByName(field).should("be.visible");
    }
  },
  "RENDA-TERC-02": () => {
    for (const field of [
      "PESSOA.NO_PESSOA",
      "PESSOA.NU_CPFCNPJ",
      "PESSOA.DT_NASCIMENTO",
      "PESSOA.VA_RENDA_BRUTA",
      "PESSOA.CO_PROFISSAO",
      "PESSOA.CO_ATIVIDADE_PROFISSIONAL",
      "PESSOA.NU_DDD_CEL",
      "PESSOA.NU_CELULAR",
      "PESSOA.NO_EMAIL",
    ]) {
      expectRequired(field);
    }
  },
  "RENDA-TERC-03": () => {
    cy.getByName("PESSOA.NU_CPFCNPJ")
      .clear()
      .type("11111111111")
      .blur();
    cy.contains('[role="alert"]', "CPF/CNPJ invalido.").should("be.visible");
  },
  "RENDA-TERC-04": () => {
    cy.getByName("PESSOA.DT_NASCIMENTO")
      .clear()
      .type("abc01012000")
      .invoke("val")
      .then((value) => {
        expect(String(value).toLowerCase()).not.to.contain("abc");
      });
  },
  "RENDA-TERC-05": () => {
    cy.getByName("PESSOA.NU_DDD_CEL")
      .clear()
      .type("ab11")
      .should("have.value", "11");
    cy.getByName("PESSOA.NU_CELULAR")
      .clear()
      .type("abc912345678")
      .invoke("val")
      .then((value) => {
        expect(String(value)).not.to.match(/[a-z]/i);
      });
  },
  "RENDA-TERC-06": () => {
    let nameHasTrailingSpace = false;
    let emailHasTrailingSpace = false;

    cy.getByName("PESSOA.NO_PESSOA").clear().type("Terceiro Cypress ");
    cy.getByName("PESSOA.NO_EMAIL")
      .clear()
      .type("terceiro.cypress@exemplo.com ");
    cy.contains('[role="tab"]', "Motivo da Contratação").click();
    cy.contains("h2", "Cadastro da Proposta")
      .parent()
      .contains("Rascunho salvo", { timeout: 30_000 })
      .should("be.visible");
    cy.contains('[role="tab"]', /Composi.*Renda/i).click();
    chooseRadio("Sim");
    chooseRadio("Outra Pessoa");
    cy.contains(/Dados do Parente para Composi.*Renda/i).should("be.visible");
    cy.getByName("PESSOA.NO_PESSOA")
      .invoke("val")
      .then((value) => {
        expect(String(value).trim(), "nome salvo no rascunho").to.equal(
          "Terceiro Cypress",
        );
        nameHasTrailingSpace = /\s$/.test(String(value));
      });
    cy.getByName("PESSOA.NO_EMAIL")
      .invoke("val")
      .then((value) => {
        expect(String(value).trim(), "e-mail salvo no rascunho").to.equal(
          "terceiro.cypress@exemplo.com",
        );
        emailHasTrailingSpace = /\s$/.test(String(value));
      });

    cy.then(() => {
      expect(nameHasTrailingSpace, "nome com espaço final persistido").to.equal(
        false,
      );
      expect(
        emailHasTrailingSpace,
        "e-mail com espaço final persistido",
      ).to.equal(false);
    });
  },
  "RENDA-TERC-07": () => {
    cy.getByName("PESSOA.VA_RENDA_BRUTA")
      .clear()
      .type("abc123")
      .invoke("val")
      .then((value) => {
        expect(String(value).toLowerCase()).not.to.contain("abc");
      });
  },
  "RENDA-TERC-08": () => {
    const forbidden = [
      "Outros",
      "Outros Declarantes não especificados",
      "Outros servidores civis e militares",
      "Outros trabal de nivel superior, ligados ao ensino",
      "Outros trabalhadores administrativos e assemelhado",
      "Outros trabalhadores de serviços assemelhados",
      "Outros Trabalhadores do comercio e assemelhados",
    ];
    cy.getByName("PESSOA.CO_PROFISSAO").click();
    cy.get('[role="listbox"]:visible [role="option"]').then(($options) => {
      const options = [...$options].map((option) =>
        option.textContent?.trim().toLowerCase(),
      );
      for (const item of forbidden) {
        expect(options).not.to.include(item.toLowerCase());
      }
    });
  },
  "RENDA-TERC-09": () => {
    cy.getByName("PESSOA.CO_PROFISSAO").click().type("ADMIN");
    cy.get('[role="listbox"]:visible').within(() => {
      cy.contains('[role="option"]', "ADMINISTRADOR").should("be.visible");
      cy.get('[role="option"]').each(($option) => {
        expect($option.text().toUpperCase()).to.contain("ADMIN");
      });
    });
  },
  "RENDA-TERC-10": () => {
    cy.getByName("PESSOA.CO_ATIVIDADE_PROFISSIONAL")
      .find("option")
      .then(($options) => {
      expect(
        [...$options]
          .map((option) => option.textContent?.trim())
          .filter((option) => option && option !== "Selecione"),
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
  "RENDA-TERC-11": () => {
    cy.getByName("PESSOA.IN_AUTORZC").should("be.visible");
    expectRequired("PESSOA.IN_AUTORZC");
  },
};

registerClientCases(
  "Cadastro de Operação: Composição de Renda com terceiros",
  cases,
  implementations,
);
