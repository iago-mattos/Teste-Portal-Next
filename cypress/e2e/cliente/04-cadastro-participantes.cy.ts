import { registerClientCases, type ClientCase } from "../../support/client-cases";

const cases = [
  {
    id: "PART-01",
    rule: "A aba Participantes deve ser a primeira aba habilitada, junto com Composição de Renda, Motivo da Contratação e Imóvel",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PART-02",
    rule: "É de preenchimento obrigatório os campos: Renda, Estado Civil, Nacionalidade, Profissão e Tipo de profissão E por isso são sinalizados com (*)",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PART-03",
    rule: "O campo renda deve aceitar apenas valores numéricos. Valores diferentes de numérico não deverão ser aceitos, mostrando em tela um erro",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PART-04",
    rule: "Quando leads enviados pela WEB, a renda é coletada na simulação e deve refletir no portal cadastro para o cliente validar e alterar.",
    sourceStatus: "Necessário massa",
    sourceObservation: null,
  },
  {
    id: "PART-05",
    rule: "Quando lead de APP, não tem informação de renda e o cliente deve permitir alterar.Quando lead de API, não tem informação de renda e o cliente deve editar",
    sourceStatus: "Necessário massa",
    sourceObservation: null,
  },
  {
    id: "PART-06",
    rule: "No campo Estado Civil, deve permitir a lista: Solteiro, Casado, Divorciado, Desquitado, Viúvo, Separação Judicial, Separação Consensual, Divorciado Consensualmente, Convivente",
    sourceStatus: "NOK",
    sourceObservation: "Tem a opção Outros, que não havia sido prevista",
  },
  {
    id: "PART-07",
    rule: "A informação de nacionalidade deve ser default brasileira, permitindo o cliente alterar",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PART-08",
    rule: "O campo profissão deve conter as mesmas profissões da lista existente na prognum em originação, no campo profissão, não considerando: Outros; Outros Declarantes não especificados; Outros servidores civis e militares; outros trabal de nivel superior, ligados ao ensino; Outros trabalhadores administrativos e assemelhado; Outros trabalhadores de serviços assemelhados; Outros Trabalhadores do comercio e assemelhados",
    sourceStatus: "NOK",
    sourceObservation: null,
  },
  {
    id: "PART-09",
    rule: "O campo profissão deve permitir o cliente digitar para filtrar as opções sem necessidade ficar rolando a barra",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PART-10",
    rule: "O campo tipo de profissão deve ter os mesmos campos do campo tipo de funcionário, sendo: Autônomo, Empresário, Pensionista, Profissional Liberal, Aposentado, Renda de Aluguel, Produtor Rural, Assalariado",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PART-11",
    rule: "O botão voltar não existirá, o cliente irá trafegar entre as abas de preenchimento e caso queira voltar, será via “voltar do browser”",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PART-12",
    rule: "A opção de salvar acontecerá de duas formas: Clicando entre as abas de preenchimento Clicando em salvar e continuar",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PART-13",
    rule: "Toda vez que salvar e tiver dado obrigatório não preenchido ele criticará, mas ainda assim salvará as informações",
    sourceStatus: "NOK",
    sourceObservation: "Está salvando, mas não tem apresentado crítica",
  },
] as const satisfies readonly ClientCase[];

beforeEach(() => {
  cy.openDefaultProposal();
});

const implementations = {
  "PART-01": () => {
    cy.get('[role="tablist"]').within(() => {
      cy.get('[role="tab"]').then(($tabs) => {
        const requiredTabs = [
          "Sobre Você",
          "Composição de Renda",
          "Motivo da Contratação",
          "Imóvel",
        ];
        const renderedTabs = [...$tabs].map((tab) => tab.textContent?.trim());

        expect(renderedTabs[0], "primeira aba").to.equal("Sobre Você");
        expect(
          renderedTabs.filter((tab) => tab && requiredTabs.includes(tab)),
          "ordem das abas obrigatorias",
        ).to.deep.equal(requiredTabs);
      });
      cy.contains('[role="tab"]', "Sobre Você")
        .should("have.attr", "aria-selected", "true");
    });
  },
  "PART-02": () => {
    for (const label of [
      "Renda",
      "Estado Civil",
      "Nacionalidade",
      "Profissão",
      "Tipo de Profissão",
    ]) {
      cy.contains("label", label).should("contain.text", "*");
    }
  },
  "PART-03": () => {
    cy.getByName("PESSOA.VA_RENDA_BRUTA")
      .clear()
      .type("abc123")
      .invoke("val")
      .then((value) => {
        expect(String(value).toLowerCase()).not.to.contain("abc");
      });
  },
  "PART-04": () => {
    cy.getByName("PESSOA.VA_RENDA_BRUTA")
      .should("not.be.disabled")
      .invoke("val")
      .should("not.be.empty");
  },
  "PART-05": () => {
    cy.getByName("PESSOA.VA_RENDA_BRUTA")
      .should("not.be.disabled")
      .invoke("val")
      .should("not.be.empty");
  },
  "PART-06": () => {
    const expected = [
      "Solteiro",
      "Casado",
      "Divorciado",
      "Desquitado",
      "Viuvo",
      "Separação Judicial",
      "Separação Consensual",
      "Divorciado Consensualmente",
      "Convivente",
    ];
    cy.getByName("PESSOA.CO_ESTCIV").find("option").then(($options) => {
      const options = [...$options].map((option) => option.textContent?.trim());
      expect(options.slice(1)).to.deep.equal(expected);
      expect(options).not.to.include("Outros");
    });
  },
  "PART-07": () => {
    cy.contains("label", "Nacionalidade").should("contain.text", "*");
    cy.getByName("PESSOA.CO_NACIONALIDADE")
      .should("have.attr", "role", "combobox")
      .and("not.be.disabled");
  },
  "PART-08": () => {
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
    cy.get('[role="listbox"]:visible [role="option"]')
      .then(($options) => {
        const options = [...$options].map((option) =>
          option.textContent?.trim().toLowerCase(),
        );
        for (const item of forbidden) {
          expect(options).not.to.include(item.toLowerCase());
        }
      });
  },
  "PART-09": () => {
    cy.getByName("PESSOA.CO_PROFISSAO").click().clear().type("ADMIN");
    cy.get('[role="listbox"]:visible').within(() => {
      cy.contains('[role="option"]', "ADMINISTRADOR").should("be.visible");
      cy.get('[role="option"]').each(($option) => {
        expect($option.text().toUpperCase()).to.contain("ADMIN");
      });
    });
    cy.getByName("PESSOA.CO_PROFISSAO").clear();
  },
  "PART-10": () => {
    cy.getByName("PESSOA.CO_ATIVIDADE_PROFISSIONAL").click();
    cy.get('[role="listbox"]:visible [role="option"]')
      .then(($options) => {
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
  "PART-11": () => {
    cy.contains("button", /^Voltar$/i).should("not.exist");
  },
  "PART-12": () => {
    cy.getByName("PESSOA.VA_RENDA_BRUTA").clear().type("123456");
    cy.contains('[role="tab"]', "Composição de Renda").click();
    cy.contains("h2", "Cadastro da Proposta")
      .parent()
      .contains("Rascunho salvo", { timeout: 30_000 })
      .should("be.visible");
  },
  "PART-13": () => {
    cy.getByName("PESSOA.VA_RENDA_BRUTA").clear().type("654321");
    cy.contains('[role="tab"]', "Composição de Renda").click();
    cy.contains("h2", "Cadastro da Proposta")
      .parent()
      .contains("Rascunho salvo", { timeout: 30_000 })
      .should("be.visible");
    cy.contains('[role="tab"]', "Imóvel").click();
    cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL")
      .invoke("val")
      .then((originalCondition) => {
        expect(originalCondition, "condicao original do imovel")
          .to.be.a("string")
          .and.not.be.empty;
        cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL")
          .scrollIntoView()
          .select("", { force: true });
        cy.contains("button", /^Confirmar/i).click();
        cy.contains(/Ainda faltam campos obrigatórios/i, {
          timeout: 30_000,
        }).should("be.visible");
        cy.get('[role="dialog"]')
          .should("contain.text", "Revise o cadastro antes de concluir")
          .contains("button", "Entendi")
          .click();
        cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select(
          originalCondition as string,
          { force: true },
        );
        cy.contains('[role="tab"]', "Sobre Você").click();
        cy.contains("h2", "Cadastro da Proposta")
          .parent()
          .contains("Rascunho salvo", { timeout: 30_000 })
          .should("be.visible");
      });
  },
};

registerClientCases(
  "Cadastro da Operação: Participantes",
  cases,
  implementations,
);
