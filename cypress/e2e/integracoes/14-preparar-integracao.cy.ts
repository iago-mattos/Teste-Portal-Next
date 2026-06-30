import {
  integrationData,
  resolveIntegrationScenario,
  type IntegrationCaseId,
  type IntegrationRunContext,
  type ResolvedIntegrationScenario,
} from "../../config/integration-data";
import { portalEnvironment } from "../../config/active-connect";

type IntegrationScenario = ResolvedIntegrationScenario;

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
  cy.contains("label", new RegExp(`^${Cypress._.escapeRegExp(label)}$`, "i"))
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

function openIntegrationProposal(scenario: IntegrationScenario): void {
  cy.openProposalList();
  cy.contains("article", `Proposta #${scenario.visibleNumber}`, {
    timeout: 30_000,
  }).within(() => {
    cy.contains("button", /Completar cadastro|Acompanhar proposta/i).click();
  });
  cy.location("pathname", { timeout: 30_000 }).should(
    "equal",
    `/propostas/${scenario.proposalId}`,
  );
  cy.contains("h2", "Cadastro da Proposta", { timeout: 30_000 }).should(
    "be.visible",
  );
}

function fillPersonAddress(data: {
  cep: string;
  endereco: string;
  bairro: string;
  uf: string;
  municipio: string;
  numero: string;
  complemento: string;
}): void {
  fill("PESSOA.NU_CEP", data.cep);
  cy.getByName("PESSOA.NO_ENDERECO")
    .invoke("val")
    .then((address) => {
      if (!String(address).trim()) {
        fill("PESSOA.NO_ENDERECO", data.endereco);
        fill("PESSOA.NO_BAIRRO", data.bairro);
        cy.selectSearchOption("PESSOA.CO_UF", data.uf);
        cy.selectSearchOption("PESSOA.CO_MUNICIPIO", data.municipio);
      }
    });
  cy.getByName("PESSOA.NO_ENDERECO").invoke("val").should("not.be.empty");
  cy.getByName("PESSOA.NO_BAIRRO").invoke("val").should("not.be.empty");
  cy.getByName("PESSOA.CO_UF").invoke("val").should("not.be.empty");
  cy.getByName("PESSOA.CO_MUNICIPIO").invoke("val").should("not.be.empty");
  fill("PESSOA.NU_APTO", data.numero);
  fill("PESSOA.NO_COMPLEMENTO", data.complemento);
}

function fillGuarantorPj(): void {
  fill("PESSOA.NO_PESSOA", integrationData.empresa.razaoSocial);
  fill("PESSOA.NU_CPFCNPJ", integrationData.empresa.cnpj);
  fill("PESSOA.DT_NASCIMENTO", integrationData.empresa.dataFundacao);
  fill("PESSOA.NU_TELEFONE_COM", integrationData.empresa.telefone);
  fill("PESSOA.NO_EMAIL", integrationData.empresa.email);
  fillPersonAddress(integrationData.empresa);

  const firstPartner = integrationData.socios[0];
  fill("NO_PESSOA", firstPartner.nome, 0);
  fill("NU_CPFCNPJ", firstPartner.cpf, 0);
  fill("DT_NASCIMENTO", firstPartner.dataNascimento, 0);
  fill("NU_DDD_CEL", firstPartner.ddd, 0);
  fill("NU_CELULAR", firstPartner.celular, 0);
  fill("NO_EMAIL", firstPartner.email, 0);

  cy.getByName("NO_PESSOA")
    .its("length")
    .then((partnerCount) => {
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

function fillGuarantorPf(): void {
  const data = integrationData.garantidorPf;
  fill("PESSOA.NO_PESSOA", data.nome);
  fill("PESSOA.NU_CPFCNPJ", data.cpf);
  cy.getByName("PESSOA.CO_ESTCIV").select(data.estadoCivil);
  fill("PESSOA.DT_NASCIMENTO", data.dataNascimento);
  fill("PESSOA.NU_DDD_CEL", data.ddd);
  fill("PESSOA.NU_CELULAR", data.celular);
  fill("PESSOA.NO_EMAIL", data.email);
  fillPersonAddress(data);
}

function fillThirdParty(): void {
  const data = integrationData.terceiro;
  fill("PESSOA.NO_PESSOA", data.nome);
  fill("PESSOA.NU_CPFCNPJ", data.cpf);
  fill("PESSOA.DT_NASCIMENTO", data.dataNascimento);
  fill("PESSOA.VA_RENDA_BRUTA", data.renda);
  cy.selectSearchOption("PESSOA.CO_PROFISSAO", data.profissao);
  cy.getByName("PESSOA.CO_ATIVIDADE_PROFISSIONAL").select(data.tipoProfissao);
  fill("PESSOA.NU_DDD_CEL", data.ddd);
  fill("PESSOA.NU_CELULAR", data.celular);
  fill("PESSOA.NO_EMAIL", data.email);
  cy.getByName("PESSOA.IN_AUTORZC").check({ force: true });
}

function fillTitular(hasSpouse: boolean): void {
  fill("PESSOA.VA_RENDA_BRUTA", integrationData.titular.renda);
  cy.getByName("PESSOA.CO_ESTCIV").select(
    hasSpouse ? integrationData.titular.estadoCivil : "1",
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
}

function fillSpouse(): void {
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
}

function fillComposition(profile: IntegrationScenario["profile"]): void {
  if (profile === "spouse-pj") {
    chooseRadio("Sim");
    chooseRadio("Conjuge");
    cy.contains(/Dados do C.*njuge para Composi.*o de Renda/i).should(
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
    return;
  }

  if (profile === "third-party-pf") {
    chooseRadio("Sim");
    chooseRadio("Outra Pessoa");
    cy.contains(/Dados do Parente para Composi.*o de Renda/i).should(
      "be.visible",
    );
    fillThirdParty();
    return;
  }

  chooseRadio("Não");
}

function fillProperty(profile: IntegrationScenario["profile"]): void {
  cy.selectSearchOption(
    "IMOVEL_OPERACAO.IN_USO_DO_IMOVEL",
    integrationData.imovel.uso,
  );
  cy.getByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL").select(
    integrationData.imovel.tipo,
  );

  const condition =
    profile === "spouse-pj" ? "6" : profile === "third-party-pf" ? "4" : "1";
  cy.getByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").select(condition);

  if (condition === "6" || condition === "4") {
    fill(
      "OPERACAO_CREDITO.VA_INTERVENIENTE",
      integrationData.imovel.saldoDevedor,
    );
    cy.selectSearchOption(
      "INTERVENIENTE.CODIGO",
      integrationData.imovel.interveniente,
    );
    cy.getByName("INTERVENIENTE.CODIGO").invoke("val").should("not.be.empty");
  }

  cy.getByName("IMOVEL_OPERACAO.NO_ENDERECO")
    .invoke("val")
    .should("match", /\d+/);

  if (profile === "spouse-pj") {
    openTab("Garantidor");
    fillGuarantorPj();
    saveByOpeningTab("Imóvel", "saveGarantidorPj");
    saveAndAdvance("Garantidor", "saveImovelPj");
  } else if (profile === "third-party-pf") {
    openTab("Garantidor");
    fillGuarantorPf();
    saveByOpeningTab("Imóvel", "saveGarantidorPf");
    saveAndAdvance("Garantidor", "saveImovelPf");
  }

  cy.contains("button", /^Confirmar$/i).should("be.visible");
  cy.wait(3_000);
}

function prepareIntegrationProposal(scenario: IntegrationScenario): void {
  openIntegrationProposal(scenario);
  cy.wait(2_000);

  const hasSpouse = scenario.profile === "spouse-pj";
  fillTitular(hasSpouse);

  if (hasSpouse) {
    saveAndAdvance("Cônjuge", "saveTitular");
    fillSpouse();
    saveAndAdvance("Composição de Renda", "saveConjuge");
  } else {
    saveAndAdvance("Composição de Renda", "saveTitular");
  }

  fillComposition(scenario.profile);
  saveAndAdvance("Motivo da Contratação", "saveRenda");
  cy.getByName("CO_MOTIVO_EMPRESTIMO").select(
    integrationData.motivo.finalidade,
  );
  fill(
    "OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO",
    `${integrationData.motivo.descricao} ${scenario.description}`,
  );

  saveAndAdvance("Imóvel", "saveMotivo");
  fillProperty(scenario.profile);
}

function confirmIntegrationProposal(): void {
  cy.intercept("PUT", "**/cadastro*").as("saveBeforeFinalization");
  cy.intercept("POST", "**/finalizar").as("confirmIntegration");
  cy.contains("button", /^Confirmar$/i).click();
  cy.wait("@saveBeforeFinalization", { timeout: 30_000 })
    .its("response.statusCode")
    .should("eq", 200);
  cy.contains(/Gravando suas informa.*aguarde/i, {
    timeout: 60_000,
  }).should("not.exist");
  cy.get("body").then(($body) => {
    if (/Deseja prosseguir para a próxima fase/i.test($body.text())) {
      cy.get("body")
        .contains(/Deseja prosseguir para a próxima fase/i)
        .closest(
          '[data-slot="alert-dialog-content"], [data-slot="dialog-content"]',
        )
        .should("be.visible")
        .within(() => {
          cy.contains("button", /^Confirmar$/i).click();
        });
    }
  });
  cy.wait("@confirmIntegration", { timeout: 60_000 }).then((interception) => {
    expect(interception.response?.statusCode).to.eq(200);
    expect(interception.response?.body?.sucesso).to.eq(true);
  });
  cy.contains(/Etapa concluída|Cadastro concluído|sucesso/i, {
    timeout: 60_000,
  }).should("be.visible");
  cy.wait(10_000);
}

describe("Integrações - preparação da proposta", () => {
  const configuredCaseId = String(
    Cypress.config("reporterOptions")?.caseId || "",
  ).trim() as IntegrationCaseId;
  const selectedCaseId = Object.hasOwn(
    integrationData.scenarios,
    configuredCaseId,
  )
    ? configuredCaseId
    : undefined;
  const scenario = selectedCaseId
    ? resolveIntegrationScenario(selectedCaseId)
    : undefined;

  if (!selectedCaseId || !scenario) {
    it("CONFIG | exige um cenário de integração conhecido", () => {
      throw new Error(
        "Informe um caseId de integração: INT-CONFIRM-PJ, INT-CONFIRM-PF, INT-CONFIRM-QUITADO ou INT-CONFIRM-WORKFLOW.",
      );
    });
  } else {
    it(`${selectedCaseId} | preenche e confirma ${scenario.proposalId}`, () => {
      cy.task<{ operation: string }>("readIntegrationSettings", null, {
        log: false,
      }).then((settings) => {
        const runtimeScenario = resolveIntegrationScenario(
          selectedCaseId,
          settings.operation,
        );
        prepareIntegrationProposal(runtimeScenario);
        confirmIntegrationProposal();
        cy.task(
          "writeIntegrationRunContext",
          {
            ...runtimeScenario,
            environment: portalEnvironment,
            preparedAt: new Date().toISOString(),
          } satisfies IntegrationRunContext,
          { log: false },
        );
      });
    });
  }
});
