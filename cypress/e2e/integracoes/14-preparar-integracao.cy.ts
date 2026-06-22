import { integrationData } from "../../config/integration-data";

function fill(name: string, value: string, index = 0): void {
  cy.getByName(name)
    .eq(index)
    .scrollIntoView()
    .should("be.visible")
    .clear()
    .type(value)
    .blur();
}

function chooseRadio(label: string): void {
  cy.contains(
    "label",
    new RegExp(`^${Cypress._.escapeRegExp(label)}$`, "i"),
  )
    .invoke("attr", "for")
    .then((inputId) => {
      expect(inputId, `radio ${label}`).to.be.a("string").and.not.be.empty;
      cy.get(`#${CSS.escape(inputId as string)}`)
        .click({ force: true })
        .should("be.checked");
    });
}

function openTab(name: string): void {
  cy.contains('[role="tab"]', name).scrollIntoView().click();
}

function saveAndAdvance(nextTab: string, alias: string): void {
  cy.intercept("PUT", "**/cadastro*").as(alias);
  cy.contains("button", /^Confirmar e avançar cadastro$/i).click();
  cy.wait(`@${alias}`, { timeout: 30_000 })
    .its("response.statusCode")
    .should("eq", 200);
  cy.contains(`[role="tab"][aria-selected="true"]`, nextTab).should(
    "be.visible",
  );
  cy.contains(/Rascunho salvo|Dados gravados/i, { timeout: 30_000 }).should(
    "be.visible",
  );
}

function saveByOpeningTab(name: string, alias: string): void {
  cy.intercept("PUT", "**/cadastro*").as(alias);
  openTab(name);
  cy.wait(`@${alias}`, { timeout: 30_000 })
    .its("response.statusCode")
    .should("eq", 200);
}

function selectFirstSearchOption(name: string): void {
  cy.getByName(name).click();
  cy.get('[role="listbox"]:visible [role="option"]')
    .filter(":visible")
    .first()
    .click();
}

function fillGuarantorPj(): void {
  fill("PESSOA.NO_PESSOA", integrationData.empresa.razaoSocial);
  fill("PESSOA.NU_CPFCNPJ", integrationData.empresa.cnpj);
  fill("PESSOA.DT_NASCIMENTO", integrationData.empresa.dataFundacao);
  fill("PESSOA.NU_TELEFONE_COM", integrationData.empresa.telefone);
  fill("PESSOA.NO_EMAIL", integrationData.empresa.email);
  fill("PESSOA.NU_CEP", integrationData.empresa.cep);
  cy.getByName("PESSOA.NO_ENDERECO")
    .invoke("val")
    .then((address) => {
      if (!String(address).trim()) {
        fill("PESSOA.NO_ENDERECO", integrationData.empresa.endereco);
        fill("PESSOA.NO_BAIRRO", integrationData.empresa.bairro);
        cy.selectSearchOption("PESSOA.CO_UF", integrationData.empresa.uf);
        cy.selectSearchOption(
          "PESSOA.CO_MUNICIPIO",
          integrationData.empresa.municipio,
        );
      }
    });
  cy.getByName("PESSOA.NO_ENDERECO").invoke("val").should("not.be.empty");
  cy.getByName("PESSOA.NO_BAIRRO").invoke("val").should("not.be.empty");
  cy.getByName("PESSOA.CO_UF").invoke("val").should("not.be.empty");
  cy.getByName("PESSOA.CO_MUNICIPIO").invoke("val").should("not.be.empty");
  fill("PESSOA.NU_APTO", integrationData.empresa.numero);
  fill("PESSOA.NO_COMPLEMENTO", integrationData.empresa.complemento);

  const firstPartner = integrationData.socios[0];
  fill("NO_PESSOA", firstPartner.nome, 0);
  fill("NU_CPFCNPJ", firstPartner.cpf, 0);
  fill("DT_NASCIMENTO", firstPartner.dataNascimento, 0);
  fill("NU_DDD_CEL", firstPartner.ddd, 0);
  fill("NU_CELULAR", firstPartner.celular, 0);
  fill("NO_EMAIL", firstPartner.email, 0);

  cy.getByName("NO_PESSOA").its("length").then((partnerCount) => {
    if (partnerCount < 2) {
      cy.contains("button", /adicionar.*sócio/i).click();
    }
  });
  cy.getByName("NO_PESSOA").should("have.length.at.least", 2);
  const secondPartner = integrationData.socios[1];
  fill("NO_PESSOA", secondPartner.nome, 1);
  fill("NU_CPFCNPJ", secondPartner.cpf, 1);
  fill("DT_NASCIMENTO", secondPartner.dataNascimento, 1);
  fill("NU_DDD_CEL", secondPartner.ddd, 1);
  fill("NU_CELULAR", secondPartner.celular, 1);
  fill("NO_EMAIL", secondPartner.email, 1);
}

function prepareIntegrationProposal(): void {
    cy.openDefaultProposal();
    cy.wait(2_000);

    fill("PESSOA.VA_RENDA_BRUTA", integrationData.titular.renda);
    cy.getByName("PESSOA.CO_ESTCIV").select(
      integrationData.titular.estadoCivil,
    );
    cy.selectSearchOption(
      "PESSOA.CO_PROFISSAO",
      integrationData.titular.profissao,
    );
    cy.selectSearchOption(
      "PESSOA.CO_ATIVIDADE_PROFISSIONAL",
      integrationData.titular.tipoProfissao,
    );
    cy.selectSearchOption(
      "PESSOA.CO_NACIONALIDADE",
      integrationData.titular.nacionalidade,
    );
    cy.selectSearchOption(
      "PESSOA.CO_UFNASC",
      integrationData.titular.ufNaturalidade,
    );
    cy.selectSearchOption(
      "PESSOA.CO_UFIDENTIDADE",
      integrationData.titular.ufIdentidade,
    );
    cy.getByName("PESSOA.IN_RESIDE_NO_IMOVEL").select(
      integrationData.titular.resideNoImovel,
    );

    saveAndAdvance("Cônjuge", "saveTitular");
    fill("CONJUGE.NO_PESSOA", integrationData.conjuge.nome);
    fill("CONJUGE.NU_CPFCNPJ", integrationData.conjuge.cpf);
    fill("CONJUGE.DT_NASCIMENTO", integrationData.conjuge.dataNascimento);
    cy.selectSearchOption(
      "CONJUGE.CO_NACIONALIDADE",
      integrationData.conjuge.nacionalidade,
    );
    cy.selectSearchOption(
      "CONJUGE.CO_UFNASC",
      integrationData.conjuge.ufNaturalidade,
    );
    cy.selectSearchOption(
      "CONJUGE.CO_UFIDENTIDADE",
      integrationData.conjuge.ufIdentidade,
    );
    fill("PESSOA.DT_CASAMENTO", integrationData.conjuge.dataComunhao);
    cy.selectSearchOption(
      "PESSOA.CO_REGIME_CASAMENTO",
      integrationData.conjuge.regimeComunhao,
    );
    fill("CONJUGE.NU_DDD_CEL", integrationData.conjuge.ddd);
    fill("CONJUGE.NU_CELULAR", integrationData.conjuge.celular);
    fill("CONJUGE.NO_EMAIL", integrationData.conjuge.email);

    saveAndAdvance("Composição de Renda", "saveConjuge");
    chooseRadio("Sim");
    chooseRadio("Conjuge");
    cy.contains("Dados do Cônjuge para Composição de Renda").should(
      "be.visible",
    );
    fill("CONJUGE.VA_RENDA_BRUTA", integrationData.conjuge.renda);
    cy.selectSearchOption(
      "CONJUGE.CO_PROFISSAO",
      integrationData.conjuge.profissao,
    );
    cy.selectSearchOption(
      "CONJUGE.CO_ATIVIDADE_PROFISSIONAL",
      integrationData.conjuge.tipoProfissao,
    );
    cy.getByName("CONJUGE.IN_AUTORZC").check({ force: true });

    saveAndAdvance("Motivo da Contratação", "saveRenda");
    cy.getByName("CO_MOTIVO_EMPRESTIMO").select(
      integrationData.motivo.finalidade,
    );
    fill(
      "OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO",
      integrationData.motivo.descricao,
    );

    saveAndAdvance("Imóvel", "saveMotivo");
    cy.selectSearchOption(
      "IMOVEL_OPERACAO.IN_USO_DO_IMOVEL",
      integrationData.imovel.uso,
    );
    cy.getByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL").select(
      integrationData.imovel.tipo,
    );
    cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select(
      integrationData.imovel.condicao,
    );
    fill(
      "OPERACAO_CREDITO.VA_INTERVENIENTE",
      integrationData.imovel.saldoDevedor,
    );
    selectFirstSearchOption("INTERVENIENTE.CODIGO");
    cy.getByName("IMOVEL_OPERACAO.NO_ENDERECO")
      .invoke("val")
      .should("match", /\d+/);

    openTab("Garantidor");
    fillGuarantorPj();
    saveByOpeningTab("Imóvel", "saveGarantidor");
    saveAndAdvance("Garantidor", "saveImovel");
    cy.contains("button", /^Confirmar$/i).should("be.visible");
    cy.wait(3_000);
}

function clickDialogConfirm(): void {
  cy.get('[role="alertdialog"], [role="dialog"]')
    .filter(":visible")
    .last()
    .within(() => {
      cy.contains("button", /^Confirmar$/i).click();
    });
}

describe("Integrações - preparação da proposta", () => {
  const selectedCaseId = Cypress.config("reporterOptions")?.caseId as
    | string
    | undefined;

  if (selectedCaseId === "INT-CONFIRM") {
    it("INT-CONFIRM | preenche e confirma a proposta na mesma sessão", () => {
      prepareIntegrationProposal();
      cy.intercept("PUT", "**/cadastro*").as("saveBeforeFinalization");
      cy.intercept("POST", "**/finalizar").as("confirmIntegration");
      cy.contains("button", /^Confirmar$/i).click();
      cy.wait("@saveBeforeFinalization", { timeout: 30_000 })
        .its("response.statusCode")
        .should("eq", 200);
      clickDialogConfirm();
      cy.wait("@confirmIntegration", { timeout: 60_000 }).then(
        (interception) => {
          expect(interception.response?.statusCode).to.eq(200);
          expect(interception.response?.body?.sucesso).to.eq(true);
        },
      );
      cy.contains(/Etapa concluída|Cadastro concluído|sucesso/i, {
        timeout: 60_000,
      }).should("be.visible");
      cy.wait(10_000);
    });
  } else {
    it("INT-PREPARE | preenche e salva a massa de maior cobertura", () => {
      prepareIntegrationProposal();
    });
  }
});
