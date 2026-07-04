import { registerClientCases, type ClientCase } from "../../support/client-cases";

const cases = [
  {
    id: "IMOVEL-01",
    rule: "Valor Estimado do Imóvel, Endereço do Imóvel de garantia devem ser preenchidos com informações do lead",
    sourceStatus: "Necessário massa",
    sourceObservation: null,
  },
  {
    id: "IMOVEL-02",
    rule: "Terá uma mensagem informativa para o cliente: “Alteração das informações da simulação poderá ser feita no momento de negociação Comercial\"",
    sourceStatus: "NOK",
    sourceObservation: "Não encontrada a frase",
  },
  {
    id: "IMOVEL-03",
    rule: "Tipo de Imóvel deve permitir: “Residencial”; “Comercial”",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "IMOVEL-04",
    rule: "O campo uso do imóvel deve ser uma lista composta por: Casa, Apartamento, Casa em condomínio, Loja, Sala Comercial, Misto, Prédio Comercial, Prédio Comercial misto, Laje corporativa, Sobrado, Flat,Terreno em condominio",
    sourceStatus: "NOK",
    sourceObservation: "Mais itens do que previsto",
  },
  {
    id: "IMOVEL-05",
    rule: "Se marcado Casa em condomínio o campo tipo do imóvel deverá ser residencial por default e não habilita para alteração",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "IMOVEL-06",
    rule: "Se marcado Loja, Sala Comercial, Misto, Prédio Comercial, Prédio Comercial misto, Laje corporativa, o campo tipo do imóvel deverá ser comercial por default e não habilita para alteração",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "IMOVEL-07",
    rule: "Se marcado Casa, Apartamento, Sobrado, Flat e Terreno em condomínio o cliente deve escolher o tipo sendo campo obrigatório",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "IMOVEL-08",
    rule: "Após o endereço do imóvel deve vir a pergunta “Você reside neste imóvel?”",
    sourceStatus: "Cenário alterado",
    sourceObservation: "Em tempo de construção, acordado entre prognum e C6(negócio e produto) alteração da jornada, sendo essa informação pertinente na aba \"Sobre Você\"",
  },
  {
    id: "IMOVEL-09",
    rule: "Quando o cliente selecionar “Não” deve habilitar o campo de endereço de residência para preenchimento",
    sourceStatus: "Cenário alterado",
    sourceObservation: "Em tempo de construção, acordado entre prognum e C6(negócio e produto) alteração da jornada, sendo essa informação pertinente na aba \"Sobre Você\"",
  },
  {
    id: "IMOVEL-10",
    rule: "Número do imóvel que vem do lead poderá vir em número, mas deverá ser concatenado para integração com a tela da prognum",
    sourceStatus: "Cenário alterado",
    sourceObservation: "Em tempo de construção, acordado entre prognum e C6(negócio e produto) alteração da jornada, sendo essa informação pertinente na aba \"Sobre Você\"",
  },
  {
    id: "IMOVEL-11",
    rule: "Condição do imóvel deverá ter a lista: Próprio, quitado; Próprio, alienado/ financiado, De terceiro, quitado; De terceiro, alienado/financiado; Em nome de empresa (CNPJ), quitado; Em nome de empresa (CNPJ), alienado/financiado",
    sourceStatus: "OK",
    sourceObservation: "Aguradando retorno de negócio sobre estar PJ e não CNPJ em telas",
  },
  {
    id: "IMOVEL-12",
    rule: "Caso preenchido alienado habilita campos Valor estimado saldo devedor e instituição para preenchimento obrigatório e portando deve ter “(*)”",
    sourceStatus: "OK",
    sourceObservation: null,
  },
] as const satisfies readonly ClientCase[];

beforeEach(() => {
  cy.openDefaultProposal();
  cy.contains('[role="tab"]', "Imóvel").click();
  cy.getByName("IMOVEL_OPERACAO.NO_ENDERECO").should("be.visible");
});

const implementations = {
  "IMOVEL-01": () => {
    cy.getByName("OPERACAO_CREDITO.VA_PRECO_IMOVEL")
      .invoke("val")
      .should("not.be.empty");
    cy.getByName("IMOVEL_OPERACAO.NO_ENDERECO")
      .invoke("val")
      .should("not.be.empty");
  },
  "IMOVEL-02": () => {
    cy.contains(
      "Alteração das informações da simulação poderá ser feita no momento de negociação Comercial",
    ).should("be.visible");
  },
  "IMOVEL-03": () => {
    cy.getByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL")
      .find("option")
      .then(($options) => {
        expect([...$options].slice(1).map((option) => option.textContent?.trim()))
          .to.deep.equal(["Residencial", "Comercial"]);
      });
  },
  "IMOVEL-04": () => {
    const expected = [
      "Não Informado",
      "Casa",
      "Apartamento",
      "Casa em condomínio",
      "Loja",
      "Sala Comercial",
      "Misto",
      "Prédio Comercial",
      "Prédio Comercial misto",
      "Laje corporativa",
      "Sobrado",
      "Flat",
      "Terreno em condominio",
    ];
    cy.getByName("IMOVEL_OPERACAO.IN_USO_DO_IMOVEL").click();
    cy.get('[role="listbox"]:visible [role="option"]')
      .then(($options) => {
        const normalize = (value: string) =>
          value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        const actual = [...$options]
          .map((option) => option.textContent?.trim())
          .filter((option): option is string => Boolean(option))
          .map(normalize);
        expect(actual).to.have.length(expected.length);
        expect(actual).to.have.members(expected.map(normalize));
      });
  },
  "IMOVEL-05": () => {
    cy.selectSearchOption(
      "IMOVEL_OPERACAO.IN_USO_DO_IMOVEL",
      "Casa em condomínio",
    );
    cy.getByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL")
      .should("be.disabled")
      .find("option:selected")
      .should("have.text", "Residencial");
    cy.selectSearchOption(
      "IMOVEL_OPERACAO.IN_USO_DO_IMOVEL",
      "Não Informado",
    );
  },
  "IMOVEL-06": () => {
    for (const usage of [
      "Loja",
      "Sala Comercial",
      "Misto",
      "Prédio Comercial",
      "Prédio Comercial Misto",
      "Laje corporativa",
    ]) {
      cy.selectSearchOption("IMOVEL_OPERACAO.IN_USO_DO_IMOVEL", usage);
      cy.getByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL")
        .should("be.disabled")
        .find("option:selected")
        .should("have.text", "Comercial");
    }
    cy.selectSearchOption(
      "IMOVEL_OPERACAO.IN_USO_DO_IMOVEL",
      "Não Informado",
    );
  },
  "IMOVEL-07": () => {
    for (const usage of [
      "Casa",
      "Apartamento",
      "Sobrado",
      "Flat",
      "Terreno em condomínio",
    ]) {
      cy.selectSearchOption("IMOVEL_OPERACAO.IN_USO_DO_IMOVEL", usage);
      cy.getByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL")
        .should("not.be.disabled");
      cy.contains("label", "Tipo do Imóvel").should("contain.text", "*");
    }
    cy.selectSearchOption(
      "IMOVEL_OPERACAO.IN_USO_DO_IMOVEL",
      "Não Informado",
    );
  },
  "IMOVEL-08": () => {
    cy.contains('[role="tab"]', "Sobre Você").click();
    cy.getByName("PESSOA.IN_RESIDE_NO_IMOVEL").should("be.visible");
    cy.contains("Reside no imóvel da operação").should("be.visible");
  },
  "IMOVEL-09": () => {
    cy.contains("Endereço do Imóvel").should("be.visible");
    cy.getByName("IMOVEL_OPERACAO.NU_MUNICIPIO")
      .should("be.visible")
      .invoke("val")
      .should("not.be.empty");
  },
  "IMOVEL-10": () => {
    cy.getByName("IMOVEL_OPERACAO.NO_ENDERECO")
      .should("be.visible")
      .invoke("val")
      .should("match", /\d+/);
  },
  "IMOVEL-11": () => {
    cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL")
      .find("option")
      .then(($options) => {
        expect([...$options].slice(1).map((option) => option.textContent?.trim()))
          .to.deep.equal([
            "Próprio quitado",
            "Próprio alienado/financiado",
            "De terceiro (PF) quitado",
            "De terceiro (PF) alienado/financiado",
            "Em nome de empresa (PJ) quitado",
            "Em nome de empresa (PJ) alienado/financiado",
          ]);
      });
  },
  "IMOVEL-12": () => {
    cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select("6");
    cy.getByName("OPERACAO_CREDITO.VA_INTERVENIENTE").should("be.visible");
    cy.contains("label", "Valor Estimado do Saldo Devedor").should(
      "contain.text",
      "*",
    );
    cy.getByName("INTERVENIENTE.CODIGO").should("be.visible");
    cy.contains("label", "Interveniente Quitante").should(
      "contain.text",
      "*",
    );
    cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select("");
  },
};

registerClientCases(
  "Cadastro da Operação: Imóvel",
  cases,
  implementations,
);
