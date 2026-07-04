import { registerClientCases, type ClientCase } from "../../support/client-cases";

const cases = [
  {
    id: "GAR-PF-01",
    rule: "Caso preenchido de terceiro quitado ou alienado, habilita garantidor PF",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "GAR-PF-02",
    rule: "Quando Garantidor PF habilitado, os campos “Nome do proprietário”, “CPF do proprietário”, “Estado Civil”, “CEP”, “Endereço”, “Número”, “Bairro”, “Município”, “UF”, Telefone de contato”, “E-mail” e “Data de Nascimento são de preenchimento obrigatório e por isso devem ter “(*)”",
    sourceStatus: "NOK",
    sourceObservation: "Não encontrado número, município e data de nascimento",
  },
  {
    id: "GAR-PF-03",
    rule: "Telefone deve permitir apenas celular",
    sourceStatus: "NOK",
    sourceObservation: "Permitindo qualquer telefone e com um direcionador para outra url",
  },
  {
    id: "GAR-PF-04",
    rule: "Quando Garantidor PF, o campo “Complemento” é opcional",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "GAR-PF-05",
    rule: "Ao digitar o CEP, os campos Endereço, Bairro, Município e UF devem ser preenchidos automaticamente",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "GAR-PF-06",
    rule: "Deve existir em tela uma indicação que o endereço é do proprietário do imóvel",
    sourceStatus: "NOK",
    sourceObservation: "Não encontrada a identificação",
  },
] as const satisfies readonly ClientCase[];

function expectRequired(name: string): void {
  cy.getByName(name).should("be.visible").then(($field) => {
    const id = $field.attr("id");
    expect(id, `id de ${name}`).to.be.a("string").and.not.be.empty;
    cy.get(`label[for="${CSS.escape(id as string)}"]`).should(
      "contain.text",
      "*",
    );
  });
}

function expectOptional(name: string): void {
  cy.getByName(name).should("be.visible").then(($field) => {
    const id = $field.attr("id");
    expect(id, `id de ${name}`).to.be.a("string").and.not.be.empty;
    cy.get(`label[for="${CSS.escape(id as string)}"]`).should(
      "contain.text",
      "opcional",
    );
  });
}

function clearAddress(): void {
  for (const field of [
    "PESSOA.NU_CEP",
    "PESSOA.NO_ENDERECO",
    "PESSOA.NU_APTO",
    "PESSOA.NO_COMPLEMENTO",
    "PESSOA.NO_BAIRRO",
  ]) {
    cy.getByName(field).clear();
  }
  cy.getByName("PESSOA.CO_UF").clear({ force: true });
}

let guarantorPfReady = false;

beforeEach(() => {
  guarantorPfReady = false;
  cy.openDefaultProposal();
  cy.contains('[role="tab"]', "Imóvel").click();
  cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select("3");
  cy.contains('[role="tab"]', "Garantidor").click();
  cy.contains("Dados Pessoais").should("be.visible");
  cy.then(() => {
    guarantorPfReady = true;
  });
});

afterEach(() => {
  if (!guarantorPfReady) {
    return;
  }

  cy.contains('[role="tab"]', "Imóvel").click();
  cy.intercept("PUT", "**/cadastro*").as("clearGuarantorPfState");
  cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select("");
  cy.contains('[role="tab"]', "Sobre Você").click();
  cy.wait("@clearGuarantorPfState", { timeout: 30_000 })
    .its("response.statusCode")
    .should("eq", 200);
});

const implementations = {
  "GAR-PF-01": () => {
    cy.getByName("PESSOA.IN_FISICA_JURIDICA")
      .should("be.disabled")
      .find("option:selected")
      .should("contain.text", "Física");

    cy.contains('[role="tab"]', "Imóvel").click();
    cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select("4");
    cy.contains('[role="tab"]', "Garantidor").should("be.visible").click();
    cy.getByName("PESSOA.IN_FISICA_JURIDICA")
      .should("be.disabled")
      .find("option:selected")
      .should("contain.text", "Física");
  },
  "GAR-PF-02": () => {
    for (const field of [
      "PESSOA.NO_PESSOA",
      "PESSOA.NU_CPFCNPJ",
      "PESSOA.CO_ESTCIV",
      "PESSOA.DT_NASCIMENTO",
      "PESSOA.NU_CELULAR",
      "PESSOA.NO_EMAIL",
      "PESSOA.NU_CEP",
      "PESSOA.NO_ENDERECO",
      "PESSOA.NU_APTO",
      "PESSOA.NO_BAIRRO",
      "PESSOA.CO_UF",
    ]) {
      expectRequired(field);
    }

    cy.selectSearchOption("PESSOA.CO_UF", "SP");
    expectRequired("PESSOA.CO_MUNICIPIO");
    cy.getByName("PESSOA.CO_UF").clear({ force: true });
  },
  "GAR-PF-03": () => {
    let invalid = false;
    cy.getByName("PESSOA.NU_CELULAR")
      .clear()
      .type("212345678")
      .blur();
    cy.getByName("PESSOA.NU_CELULAR")
      .should("have.attr", "aria-invalid", "true")
      .then(() => {
        invalid = true;
      });
    cy.getByName("PESSOA.NU_CELULAR").clear();
    cy.then(() => {
      expect(invalid, "telefone fixo deve ser rejeitado").to.equal(true);
    });
  },
  "GAR-PF-04": () => {
    expectOptional("PESSOA.NO_COMPLEMENTO");
  },
  "GAR-PF-05": () => {
    cy.getByName("PESSOA.NU_CEP").clear().type("01001000").blur();

    for (const field of [
      "PESSOA.NO_ENDERECO",
      "PESSOA.NO_BAIRRO",
      "PESSOA.CO_UF",
      "PESSOA.CO_MUNICIPIO",
    ]) {
      cy.getByName(field).should("be.visible").invoke("val").should("not.be.empty");
    }

    clearAddress();
  },
  "GAR-PF-06": () => {
    cy.contains(
      "Endereço residencial do proprietário do imóvel",
    ).should("be.visible");
  },
};

registerClientCases(
  "Cadastro da Operação: Garantidor PF",
  cases,
  implementations,
);
