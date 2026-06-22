import { registerClientCases, type ClientCase } from "../../support/client-cases";

const cases = [
  {
    id: "CONJ-01",
    rule: "Se o estado civil diferente de casado ou convivente não habilita aba cônjuge, demais opções deverá habilitar o preenchimento",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "CONJ-02",
    rule: "É de preenchimento obrigatório os campos: Nome do Cônjuge, CPF, Data de Nascimento e Regime de Comunhão. E por isso são sinalizados com (*)",
    sourceStatus: "NOK",
    sourceObservation: "Quando diferente de casado n;ao está vindo todos os campos",
  },
  {
    id: "CONJ-03",
    rule: "É de preenchimento opcional Data de Comunhão, E-mail e Telefone. Sendo sinalizados como opcional",
    sourceStatus: "NOK",
    sourceObservation: "Quando diferente de casado n;ao está vindo todos os campos",
  },
  {
    id: "CONJ-04",
    rule: "O campo telefone deve possuir o DDD",
    sourceStatus: "NOK",
    sourceObservation: "Não possui telefone em tela",
  },
  {
    id: "CONJ-05",
    rule: "O campo CPF seve ser um campo válido",
    sourceStatus: "NOK",
    sourceObservation: "Não consta telefone",
  },
  {
    id: "CONJ-06",
    rule: "Data de nascimento deverá permitir apenas números",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "CONJ-07",
    rule: "Data de comunhão deverá permitir apenas números",
    sourceStatus: "NOK",
    sourceObservation: "Precisa constar quando diferente de casado",
  },
  {
    id: "CONJ-08",
    rule: "Telefone deverá permitir apenas números",
    sourceStatus: "NOK",
    sourceObservation: "Não possui telefone em tela",
  },
  {
    id: "CONJ-09",
    rule: "Não será permitido finalizar o nome e e-mail com espaço",
    sourceStatus: "NOK",
    sourceObservation: "Não possui em tela",
  },
  {
    id: "CONJ-10",
    rule: "O regime de comunhão deverá ser uma lista: Comunhão Universal de Bens, Separação Total de Bens, Comunhão Parcial de Bens, Participação Final nos Aquestos, União Estável, Separação Obrigatória de Bens",
    sourceStatus: "OK",
    sourceObservation: null,
  },
] as const satisfies readonly ClientCase[];

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

function expectOptional(name: string): void {
  cy.getByName(name).then(($field) => {
    const id = $field.attr("id");
    expect(id, `id de ${name}`).to.be.a("string").and.not.be.empty;
    cy.get(`label[for="${CSS.escape(id as string)}"]`).should(
      "contain.text",
      "opcional",
    );
  });
}

beforeEach(() => {
  cy.openDefaultProposal();
  cy.getByName("PESSOA.CO_ESTCIV").select("2");
  cy.contains('[role="tab"]', "Cônjuge").click();
  cy.wait(2_000);
});

afterEach(() => {
  cy.wait(3_000);
  cy.contains('[role="tab"]', "Sobre Você").click();
  cy.intercept("PUT", "**/cadastro*").as("clearSpouseState");
  cy.getByName("PESSOA.CO_ESTCIV").select("");
  cy.contains('[role="tab"]', "Composição de Renda").click();
  cy.wait("@clearSpouseState", { timeout: 30_000 })
    .its("response.statusCode")
    .should("eq", 200);
});

const implementations = {
  "CONJ-01": () => {
    cy.contains('[role="tab"]', "Sobre Você").click();
    cy.getByName("PESSOA.CO_ESTCIV").select("1");
    cy.contains('[role="tab"]', "Cônjuge").should("not.exist");
    cy.getByName("PESSOA.CO_ESTCIV").select("2");
    cy.contains('[role="tab"]', "Cônjuge").should("be.visible");
    cy.getByName("PESSOA.CO_ESTCIV").select("9");
    cy.contains('[role="tab"]', "Cônjuge").should("be.visible");
  },
  "CONJ-02": () => {
    for (const field of [
      "CONJUGE.NO_PESSOA",
      "CONJUGE.NU_CPFCNPJ",
      "CONJUGE.DT_NASCIMENTO",
      "PESSOA.CO_REGIME_CASAMENTO",
    ]) {
      cy.getByName(field).should("be.visible");
      expectRequired(field);
    }
  },
  "CONJ-03": () => {
    for (const field of [
      "PESSOA.DT_CASAMENTO",
      "CONJUGE.NO_EMAIL",
      "CONJUGE.NU_DDD_CEL",
      "CONJUGE.NU_CELULAR",
    ]) {
      cy.getByName(field).should("be.visible");
      expectOptional(field);
    }
  },
  "CONJ-04": () => {
    cy.getByName("CONJUGE.NU_DDD_CEL").should("be.visible");
    cy.getByName("CONJUGE.NU_CELULAR").should("be.visible");
  },
  "CONJ-05": () => {
    let invalid = false;
    cy.getByName("CONJUGE.NU_CPFCNPJ")
      .clear()
      .type("11111111111")
      .blur();
    cy.getByName("CONJUGE.NU_CPFCNPJ")
      .should("have.attr", "aria-invalid", "true")
      .then(() => {
        invalid = true;
      });
    cy.getByName("CONJUGE.NU_CPFCNPJ").clear();
    cy.then(() => {
      expect(invalid, "CPF inválido deve ser criticado").to.equal(true);
    });
  },
  "CONJ-06": () => {
    let hasLetters = true;
    cy.getByName("CONJUGE.DT_NASCIMENTO")
      .clear()
      .type("abc01012000")
      .invoke("val")
      .then((value) => {
        hasLetters = /[a-z]/i.test(String(value));
      });
    cy.getByName("CONJUGE.DT_NASCIMENTO").clear();
    cy.then(() => {
      expect(hasLetters).to.equal(false);
    });
  },
  "CONJ-07": () => {
    let hasLetters = true;
    cy.getByName("PESSOA.DT_CASAMENTO")
      .clear()
      .type("abc01012000")
      .invoke("val")
      .then((value) => {
        hasLetters = /[a-z]/i.test(String(value));
      });
    cy.getByName("PESSOA.DT_CASAMENTO").clear();
    cy.then(() => {
      expect(hasLetters).to.equal(false);
    });
  },
  "CONJ-08": () => {
    let dddHasLetters = true;
    let phoneHasLetters = true;
    cy.getByName("CONJUGE.NU_DDD_CEL")
      .clear()
      .type("ab11")
      .invoke("val")
      .then((value) => {
        dddHasLetters = /[a-z]/i.test(String(value));
      });
    cy.getByName("CONJUGE.NU_CELULAR")
      .clear()
      .type("abc912345678")
      .invoke("val")
      .then((value) => {
        phoneHasLetters = /[a-z]/i.test(String(value));
      });
    cy.getByName("CONJUGE.NU_DDD_CEL").clear();
    cy.getByName("CONJUGE.NU_CELULAR").clear();
    cy.then(() => {
      expect(dddHasLetters).to.equal(false);
      expect(phoneHasLetters).to.equal(false);
    });
  },
  "CONJ-09": () => {
    cy.getByName("CONJUGE.NO_PESSOA")
      .clear()
      .type("Nome Teste ");
    cy.getByName("CONJUGE.NO_EMAIL")
      .clear()
      .type("teste@exemplo.com ");

    cy.intercept("PUT", "**/cadastro*").as("saveSpouseDraft");
    cy.contains('[role="tab"]', "Motivo da Contratação").click();
    cy.wait("@saveSpouseDraft", { timeout: 30_000 })
      .its("response.statusCode")
      .should("eq", 200);
    cy.contains('[role="tab"]', "Cônjuge").click();

    cy.getByName("CONJUGE.NO_PESSOA").should("have.value", "Nome Teste");
    cy.getByName("CONJUGE.NO_EMAIL").should(
      "have.value",
      "teste@exemplo.com",
    );

    cy.getByName("CONJUGE.NO_PESSOA").clear();
    cy.getByName("CONJUGE.NO_EMAIL").clear();
  },
  "CONJ-10": () => {
    cy.getByName("PESSOA.CO_REGIME_CASAMENTO").click();
    cy.get('[role="listbox"]:visible [role="option"]').then(($options) => {
      expect(
        [...$options]
          .map((option) => option.textContent?.trim())
          .filter(Boolean),
      ).to.deep.equal([
        "Comunhão Universal de Bens",
        "Separação Total de Bens",
        "Comunhão Parcial de Bens",
        "Participação Final nos Aquestos",
        "União Estável",
        "Separação Obrigatória de Bens",
      ]);
    });
  },
};

registerClientCases(
  "Cadastro da Operação: Dados do Conjuge",
  cases,
  implementations,
);
