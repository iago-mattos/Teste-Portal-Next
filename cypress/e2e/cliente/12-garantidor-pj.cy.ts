import { registerClientCases, type ClientCase } from "../../support/client-cases";

const cases = [
  {
    id: "GAR-PJ-01",
    rule: "Caso preenchido em nome de empresa quitado ou alienado, habilita garantidor PJ",
    sourceStatus: "NOK",
    sourceObservation: "Habilitando apenas garantidor PF, a decisaão está no campo preenchido na tela anterior. Se o cliente tiver que escolher PF ou PJ aumenta as chances de erro por uma informação preenchida previamente",
  },
  {
    id: "GAR-PJ-02",
    rule: "Quando Garantidor PJ habilitado, os campos “Razão Social da Empresa”, “CNPJ”, “CEP”, “Endereço”, “Número”, “Bairro”, “Município”, “UF” são de preenchimento obrigatório e por isso devem ter “(*)”",
    sourceStatus: "NOK",
    sourceObservation: "Habilitando apenas garantidor PF, a decisão está no campo preenchido na tela anterior. Se o cliente tiver que escolher PF ou PJ aumenta as chances de erro por uma informação preenchida previamente",
  },
  {
    id: "GAR-PJ-03",
    rule: "Quando Garantidor PJ, os campos “Telefone de contato”, “E-mail” e “Complemento” são opcionais",
    sourceStatus: "NOK",
    sourceObservation: "Habilitando apenas garantidor PF, a decisão está no campo preenchido na tela anterior. Se o cliente tiver que escolher PF ou PJ aumenta as chances de erro por uma informação preenchida previamente",
  },
  {
    id: "GAR-PJ-04",
    rule: "Ao digitar o CEP, os campos Endereço, Bairro, Município e UF devem ser preenchidos automaticamente",
    sourceStatus: "NOK",
    sourceObservation: "Habilitando apenas garantidor PF, a decisão está no campo preenchido na tela anterior. Se o cliente tiver que escolher PF ou PJ aumenta as chances de erro por uma informação preenchida previamente",
  },
  {
    id: "GAR-PJ-05",
    rule: "Deve existir em tela uma indicação que o endereço é da empresa do imóvel",
    sourceStatus: "NOK",
    sourceObservation: "Não encontrada",
  },
  {
    id: "GAR-PJ-06",
    rule: "A Lista de Sócios deve permitir adicionar um novo sócio",
    sourceStatus: "NOK",
    sourceObservation: "Devesempre ter o dono da empresa PJ",
  },
  {
    id: "GAR-PJ-07",
    rule: "Campo “Nome Completo”, “CPF”, “Telefone”, “Data de nascimento” e “E-mail” são obrigatórias para todos os sócios e por isso devem ter “(*)”",
    sourceStatus: "NOK",
    sourceObservation: "Informação não veio em tela",
  },
  {
    id: "GAR-PJ-08",
    rule: "Telefone deve permitir apenas celular",
    sourceStatus: "NOK",
    sourceObservation: "Informação não veio em tela",
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

let guarantorPjReady = false;

beforeEach(() => {
  guarantorPjReady = false;
  cy.openDefaultProposal();
  cy.contains('[role="tab"]', "Imóvel").click();
  cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select("5");
  cy.contains('[role="tab"]', "Garantidor").click();
  cy.contains("Dados da Empresa").should("be.visible");
  cy.then(() => {
    guarantorPjReady = true;
  });
});

afterEach(() => {
  if (!guarantorPjReady) {
    return;
  }

  cy.contains('[role="tab"]', "Imóvel").click();
  cy.intercept("PUT", "**/cadastro*").as("clearGuarantorPjState");
  cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select("");
  cy.contains('[role="tab"]', "Sobre Você").click();
  cy.wait("@clearGuarantorPjState", { timeout: 30_000 })
    .its("response.statusCode")
    .should("eq", 200);
});

const implementations = {
  "GAR-PJ-01": () => {
    cy.getByName("PESSOA.IN_FISICA_JURIDICA")
      .should("be.disabled")
      .find("option:selected")
      .should("contain.text", "Jurídica");

    cy.contains('[role="tab"]', "Imóvel").click();
    cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select("6");
    cy.contains('[role="tab"]', "Garantidor").should("be.visible").click();
    cy.getByName("PESSOA.IN_FISICA_JURIDICA")
      .should("be.disabled")
      .find("option:selected")
      .should("contain.text", "Jurídica");
  },
  "GAR-PJ-02": () => {
    for (const field of [
      "PESSOA.NO_PESSOA",
      "PESSOA.NU_CPFCNPJ",
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
  "GAR-PJ-03": () => {
    for (const field of [
      "PESSOA.NU_TELEFONE_COM",
      "PESSOA.NO_EMAIL",
      "PESSOA.NO_COMPLEMENTO",
    ]) {
      expectOptional(field);
    }
  },
  "GAR-PJ-04": () => {
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
  "GAR-PJ-05": () => {
    cy.contains("Endereço da Empresa").should("be.visible");
  },
  "GAR-PJ-06": () => {
    cy.contains("Lista de Sócios").should("be.visible");
    cy.getByName("NO_PESSOA").its("length").then((initialCount) => {
      cy.contains("button", /adicionar.*sócio/i)
        .scrollIntoView()
        .should("be.visible")
        .click();
      cy.getByName("NO_PESSOA").should("have.length", initialCount + 1);
    });
  },
  "GAR-PJ-07": () => {
    for (const field of [
      "NO_PESSOA",
      "NU_CPFCNPJ",
      "DT_NASCIMENTO",
      "NU_DDD_CEL",
      "NU_CELULAR",
      "NO_EMAIL",
    ]) {
      expectRequired(field);
    }
  },
  "GAR-PJ-08": () => {
    let invalid = false;
    cy.getByName("NU_CELULAR").filter(":visible").first().as("partnerPhone");
    cy.get("@partnerPhone").clear().type("212345678").blur();
    cy.get("@partnerPhone")
      .should("have.attr", "aria-invalid", "true")
      .then(() => {
        invalid = true;
      });
    cy.get("@partnerPhone").clear();
    cy.then(() => {
      expect(invalid, "telefone fixo deve ser rejeitado").to.equal(true);
    });
  },
};

registerClientCases(
  "Cadastro da Operação: Garantidor PJ",
  cases,
  implementations,
);
