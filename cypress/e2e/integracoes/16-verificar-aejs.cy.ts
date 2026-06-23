import { aejsConnect } from "../../config/aejs";

const operations = {
  pj: "000436021",
  pf: "000436020",
} as const;

const rowSelector =
  ".x-grid-cell-inner:visible, [role='gridcell']:visible, td:visible, .x-grid-item:visible, .x-grid-row:visible, [role='rowgroup']:visible, tr:visible";
const buttonSelector =
  'a:visible, button:visible, .x-btn:visible, .x-btn-inner:visible';
const menuItemSelector =
  'a[role="menuitem"]:visible, .x-menu-item:visible, .x-menu-item-text:visible, a:visible, span:visible';

function waitExtJs(timeout = 1_000): void {
  cy.wait(timeout);
}

function mark(message: string): void {
  cy.task("aejsLog", message, { log: false });
}

function clickVisibleButton(label: string | RegExp): void {
  cy.get(buttonSelector, { timeout: 20_000 })
    .filter((_, element) => {
      const text = (element.textContent ?? "").trim();
      return typeof label === "string" ? text === label : label.test(text);
    })
    .last()
    .click({ force: true });
}

function clickVisibleMenuItem(label: string): void {
  cy.get(menuItemSelector, { timeout: 20_000 })
    .filter((_, element) => (element.textContent ?? "").trim() === label)
    .last()
    .click({ force: true });
}

function clickVisibleTab(label: string): void {
  cy.get('.x-tab:visible, a[role="tab"]:visible', { timeout: 20_000 })
    .filter((_, element) => (element.textContent ?? "").includes(label))
    .last()
    .click({ force: true });
  waitExtJs(1_500);
}

function visibleField(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy
    .get(`input[name="${name}"], textarea[name="${name}"]`, { timeout: 20_000 })
    .filter(":visible")
    .last();
}

function expectFieldValue(name: string, value: string): void {
  visibleField(name).should("have.value", value);
}

function expectFieldContains(name: string, value: string): void {
  visibleField(name).invoke("val").should("contain", value);
}

function expectFieldChecked(name: string): void {
  cy.get(`input[name="${name}"]`, { timeout: 20_000 }).then(($inputs) => {
    const hasCheckedInput = $inputs
      .toArray()
      .some((input) => (input as HTMLInputElement).checked);

    expect(hasCheckedInput, `${name} marcado no AEJS`).to.eq(true);
  });
}

function uncheckField(name: string): void {
  cy.get(`input[name="${name}"]`, { timeout: 20_000 }).then(($inputs) => {
    const input =
      $inputs.toArray().find((element) => (element as HTMLInputElement).checked) ??
      $inputs.toArray().at(-1);

    expect(input, `${name} encontrado no AEJS`).to.exist;
    cy.wrap(input).uncheck({ force: true });
  });
}

function clickGridRow(text: string): void {
  cy.contains(rowSelector, text, { timeout: 30_000 })
    .scrollIntoView()
    .click({ force: true });
  waitExtJs(500);
}

function openGridRow(text: string, timeout = 8_000): void {
  cy.contains(rowSelector, text, { timeout: 30_000 })
    .scrollIntoView()
    .dblclick({ force: true });
  waitExtJs(timeout);
}

function openSelectedGridRow(text: string, timeout = 8_000): void {
  clickGridRow(text);
  clickVisibleButton("Abrir");
  waitExtJs(timeout);
}

function closeCurrentWindow(): void {
  clickVisibleButton("Fechar tela");
  waitExtJs(1_500);
}

function loginAejs(): void {
  mark("login: acessando AEJS HT");
  cy.visit(aejsConnect.baseUrl);
  cy.contains("Acesso via Plataforma", { timeout: 30_000 }).click({
    force: true,
  });
  mark("login: acesso via plataforma selecionado");

  cy.get("input:visible", { timeout: 30_000 }).should("have.length.at.least", 2);
  cy.get('input[name="name"]:visible, input:visible')
    .first()
    .clear({ force: true })
    .type(aejsConnect.username, { force: true });
  cy.get('input[type="password"]:visible')
    .clear({ force: true })
    .type(aejsConnect.password, { force: true, log: false });

  cy.get("input:visible").then(($inputs) => {
    if ($inputs.length >= 3 && aejsConnect.path) {
      cy.wrap($inputs.eq(2)).clear({ force: true }).type(aejsConnect.path, {
        force: true,
        log: false,
      });
    }
  });

  clickVisibleButton("Login");
  cy.get(buttonSelector, { timeout: 40_000 }).should("exist");
  mark("login: concluido");
  waitExtJs(2_000);
}

function openOperation(operation: string): void {
  mark(`operacao ${operation}: abrindo menu de cadastro`);
  cy.get(".x-toolbar .x-btn:visible, a:visible", { timeout: 20_000 })
    .filter((_, element) => !(element.textContent ?? "").trim())
    .last()
    .click({ force: true });
  clickVisibleMenuItem("Originação");
  clickVisibleMenuItem("Cadastro de operações");
  waitExtJs(2_500);

  cy.get('input[name="operacao"]:visible', { timeout: 20_000 })
    .clear({ force: true })
    .type(operation.replace(/^0+/, ""), { force: true });
  clickVisibleButton("Pesquisar");
  cy.contains(rowSelector, operation, { timeout: 30_000 }).should("be.visible");
  mark(`operacao ${operation}: resultado localizado`);
  openGridRow(operation, 25_000);
  cy.get('input[name="PRETENDENTE$NU_PRETENDENTE"]:visible', {
    timeout: 60_000,
  }).should("have.value", operation);
  mark(`operacao ${operation}: tela aberta`);
}

function validateTitularAndConjuge(): void {
  mark("PJ: validando titular e conjuge");
  clickVisibleTab("Pretendente");
  openSelectedGridRow("PROPOSTA 10 -- MASSA", 8_000);

  expectFieldValue("PESSOA$NU_CPFCNPJ", "566.634.115-43");
  expectFieldValue("PESSOA$NO_PESSOA", "PROPOSTA 10 -- MASSA");
  expectFieldValue("PESSOA$DT_NASCIMENTO", "01/Jan/2001");
  expectFieldValue("PESSOA$CO_NACIONALIDADE", "Brasileira");
  expectFieldValue("PESSOA$CO_UFIDENTIDADE", "RJ");
  expectFieldValue("PESSOA$CO_ESTCIV", "Casado");
  expectFieldValue("PESSOA$CO_REGIME_CASAMENTO", "Comunhão Universal de Bens");
  expectFieldValue("PESSOA$DT_CASAMENTO", "01/Jan/2025");
  expectFieldValue("PESSOA$CO_UFNASC", "RJ");
  expectFieldChecked("PESSOA$IN_AUTORZC");
  expectFieldValue("PESSOA$DT_AUTORZC", "22/Jun/2026");

  clickVisibleTab("Dados de Contato");
  expectFieldValue("PESSOA$NU_CEP", "24120440");
  expectFieldContains("PESSOA$NO_ENDERECO", "Rua Doutor Carlos Imbassahy");
  expectFieldContains("PESSOA$NO_ENDERECO", "99");
  expectFieldValue("PESSOA$NO_COMPLEMENTO", "casa 3");
  expectFieldValue("PESSOA$NO_BAIRRO", "Fonseca");
  expectFieldValue("PESSOA$CO_MUNICIPIO", "NITERÓI");
  expectFieldValue("PESSOA$CO_UF", "RJ");

  clickVisibleTab("Ocupação");
  expectFieldValue("PESSOA$CO_ATIVIDADE_PROFISSIONAL", "ASSALARIADO");
  expectFieldValue("PESSOA$CO_PROFISSAO", "ADMINISTRADOR");
  expectFieldValue("PESSOA$VA_RENDA_BRUTA", "12.345,67");

  clickVisibleTab("Cônjuge");
  expectFieldValue("CONJUGE$NU_CPFCNPJ", "639.766.660-33");
  expectFieldValue("CONJUGE$NO_PESSOA", "CONJUGE CYPRESS INTEGRACAO");
  expectFieldValue("CONJUGE$DT_NASCIMENTO", "01/Jan/2001");
  expectFieldValue("CONJUGE$CO_NACIONALIDADE", "Brasileira");
  expectFieldValue("CONJUGE$CO_UFIDENTIDADE", "RJ");
  expectFieldValue("CONJUGE$CO_ESTCIV", "Casado");
  expectFieldValue("CONJUGE$CO_REGIME_CASAMENTO", "Comunhão Universal de Bens");
  expectFieldValue("CONJUGE$DT_CASAMENTO", "01/Jan/2025");
  expectFieldValue("CONJUGE$CO_UFNASC", "RJ");
  expectFieldChecked("CONJUGE$IN_AUTORZC");
  expectFieldValue("CONJUGE$DT_AUTORZC", "22/Jun/2026");

  clickVisibleTab("Dados de Contato");
  expectFieldValue("CONJUGE$NU_DDD_CEL", "21");
  expectFieldValue("CONJUGE$NU_CELULAR", "99807-1033");
  expectFieldValue("CONJUGE$NO_EMAIL", "conjuge.integracao@teste.com");

  clickVisibleTab("Ocupação");
  expectFieldValue("CONJUGE$CO_ATIVIDADE_PROFISSIONAL", "ASSALARIADO");
  expectFieldValue("CONJUGE$CO_PROFISSAO", "ADMINISTRADOR");
  expectFieldValue("CONJUGE$VA_RENDA_BRUTA", "14.000,00");

  closeCurrentWindow();
}

function validateImovel(): void {
  mark("PJ: validando imovel");
  clickVisibleTab("Imóvel Operação");
  clickVisibleTab("Dados do imóvel");

  expectFieldValue("IMOVEL_OPERACAO$VA_AVALIACAO_PROVISORIA", "1.950.000,00");
  expectFieldValue("IMOVEL_OPERACAO$NU_CEP", "24120440");
  expectFieldContains("IMOVEL_OPERACAO$NO_ENDERECO", "Rua Doutor Carlos Imbassahy");
  expectFieldContains("IMOVEL_OPERACAO$NO_ENDERECO", "99");
  expectFieldValue("IMOVEL_OPERACAO$NO_COMPLEMENTO", "casa 3");
  expectFieldValue("IMOVEL_OPERACAO$NO_BAIRRO", "Fonseca");
  expectFieldValue("IMOVEL_OPERACAO$NU_MUNICIPIO", "NITERÓI");
  expectFieldValue("IMOVEL_OPERACAO$CO_UF", "RJ");
  expectFieldValue("IMOVEL_OPERACAO$IN_USO_DO_IMOVEL", "Casa");
  expectFieldValue("IMOVEL_OPERACAO$IN_TIPO_IMOVEL", "RESIDENCIAL");
  expectFieldValue(
    "IMOVEL_OPERACAO$CO_CONDICAO_IMOVEL",
    "Em nome de empresa (PJ) alienado/financiado",
  );
}

function validateGarantidorPj(): void {
  mark("PJ: validando garantidor PJ e socios");
  clickVisibleTab("Garantidor Pessoa Jurídica");
  openSelectedGridRow("EMPRESA CYPRESS INTEGRACAO LTDA", 7_000);

  expectFieldValue("PESSOA$NU_CPFCNPJ", "11.222.333/0001-81");
  expectFieldValue("PESSOA$NO_PESSOA", "EMPRESA CYPRESS INTEGRACAO LTDA");
  expectFieldValue("PESSOA$DT_NASCIMENTO", "01/Jan/2010");
  expectFieldValue("PESSOA$NU_CEP", "01001000");
  expectFieldContains("PESSOA$NO_ENDERECO", "Praça da Sé");
  expectFieldContains("PESSOA$NO_ENDERECO", "100");
  expectFieldValue("PESSOA$NO_COMPLEMENTO", "SALA 10");
  expectFieldValue("PESSOA$CO_UF", "SP");
  expectFieldValue("PESSOA$CO_MUNICIPIO", "SÃO PAULO");
  expectFieldValue("PESSOA$NO_BAIRRO", "Sé");
  expectFieldValue("PESSOA$NU_TELEFONE_COM", "98765-4321");

  clickVisibleTab("Sócios/Representantes");
  cy.contains(rowSelector, "SOCIO CYPRESS UM", { timeout: 20_000 }).should(
    "be.visible",
  );
  cy.contains(rowSelector, "SOCIO CYPRESS DOIS", { timeout: 20_000 }).should(
    "be.visible",
  );
  openSelectedGridRow("SOCIO CYPRESS UM", 6_000);
  expectFieldValue("NU_CPFCNPJ", "529.982.247-25");
  expectFieldValue("NO_PESSOA", "SOCIO CYPRESS UM");
  expectFieldValue("DT_NASCIMENTO", "01/Jan/1990");

  closeCurrentWindow();
  closeCurrentWindow();
}

function validateInterveniente(): void {
  mark("PJ: validando interveniente quitante");
  clickVisibleTab("Interveniente quitante");
  expectFieldValue("INTERVENIENTE$NU_CPFCNPJ", "00000000000000");
  expectFieldValue("INTERVENIENTE$NO_PESSOA", "Banco C6 S.A.");

  clickVisibleButton("Alterar");
  waitExtJs(1_500);
  uncheckField("IMOVEL_OPERACAO$IN_ALIENADO_PROPRIO");
  waitExtJs(1_500);
  clickVisibleTab("Dados do contrato com o Interveniente Quitante");
  expectFieldValue("OPERACAO_CREDITO$VA_INTERVENIENTE", "250.000,00");
  clickVisibleButton("Cancelar");
  clickVisibleButton("Sim");
  waitExtJs(2_000);
}

function validateTerceiroComposicao(): void {
  mark("PF: validando terceiro/composicao de renda");
  openGridRow("TERCEIRO CYPRESS INTEGRACAO", 8_000);

  expectFieldValue("PESSOA$NU_CPFCNPJ", "390.533.447-05");
  expectFieldValue("PESSOA$NO_PESSOA", "TERCEIRO CYPRESS INTEGRACAO");
  expectFieldValue("PESSOA$DT_NASCIMENTO", "03/Mar/1993");
  expectFieldValue("PESSOA$CO_NACIONALIDADE", "Brasileira");
  expectFieldChecked("PESSOA$IN_AUTORZC");
  expectFieldValue("PESSOA$DT_AUTORZC", "22/Jun/2026");

  clickVisibleTab("Dados de Contato");
  expectFieldValue("PESSOA$NU_DDD_CEL", "31");
  expectFieldValue("PESSOA$NU_CELULAR", "99876-5432");
  expectFieldValue("PESSOA$NO_EMAIL", "terceiro.integracao@teste.com");

  clickVisibleTab("Ocupação");
  expectFieldValue("PESSOA$CO_ATIVIDADE_PROFISSIONAL", "ASSALARIADO");
  expectFieldValue("PESSOA$CO_PROFISSAO", "ADMINISTRADOR");
  expectFieldValue("PESSOA$VA_RENDA_BRUTA", "9.000,00");

  closeCurrentWindow();
}

function validateGarantidorPf(): void {
  mark("PF: validando garantidor PF");
  clickVisibleTab("Imóvel Operação");
  clickVisibleTab("Garantidor Pessoa Física");
  openSelectedGridRow("GARANTIDOR PF CYPRESS", 7_000);

  expectFieldValue("PESSOA$NU_CPFCNPJ", "935.411.347-80");
  expectFieldValue("PESSOA$NO_PESSOA", "GARANTIDOR PF CYPRESS");
  expectFieldValue("PESSOA$DT_NASCIMENTO", "04/Abr/1985");
  expectFieldValue("PESSOA$CO_ESTCIV", "Solteiro");

  clickVisibleTab("Dados de Contato");
  expectFieldValue("PESSOA$NU_CEP", "01001000");
  expectFieldContains("PESSOA$NO_ENDERECO", "Praca da Se");
  expectFieldContains("PESSOA$NO_ENDERECO", "200");
  expectFieldValue("PESSOA$NO_COMPLEMENTO", "CASA 2");
  expectFieldValue("PESSOA$CO_UF", "SP");
  expectFieldValue("PESSOA$CO_MUNICIPIO", "SÃO PAULO");
  expectFieldValue("PESSOA$NO_BAIRRO", "Se");
  expectFieldValue("PESSOA$NU_DDD_CEL", "11");
  expectFieldValue("PESSOA$NU_CELULAR", "98765-4321");
  expectFieldValue("PESSOA$NO_EMAIL", "garantidor.pf@teste.com");

  closeCurrentWindow();
}

describe("Integrações - verificação no SCCI/AEJS HT", () => {
  beforeEach(() => {
    loginAejs();
  });

  it("INT-AEJS-PJ | valida titular, conjuge, imovel, garantidor PJ, socios e interveniente", () => {
    openOperation(operations.pj);
    validateTitularAndConjuge();
    validateImovel();
    validateGarantidorPj();
    validateInterveniente();
  });

  it("INT-AEJS-PF | valida terceiro na renda e garantidor PF", () => {
    openOperation(operations.pf);
    validateTerceiroComposicao();
    validateGarantidorPf();
  });
});
