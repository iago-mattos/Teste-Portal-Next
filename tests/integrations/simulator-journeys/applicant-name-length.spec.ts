import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { assertEsteiraHtProvisioningTarget } from "../../config/esteira-ht-provisioning-target";
import { assertMutationOptIn } from "../../helpers/mutation-gate";
import { PortalSimulatorPage } from "../../pages/portal/portal-simulator.page";
import {
  markQaRunAttempt,
  markQaRunRejected,
  markQaRunSubmitted,
  reserveQaRun,
} from "../../services/simulator-qa-runs";
import { getDigitalMortgageSimulation } from "../../test-data/simulator-data";
import { OBSERVED_SIMULATOR_JOURNEYS } from "../../test-data/simulator-journeys";

/**
 * Nome da empresa acima de 40 caracteres.
 *
 * Fato observado (09/11/2026): o backend devolveu ORA-12899 (coluna
 * CAIXA2.PESSOA_PRETENDENTE.NO_PESSOA, máximo 40) e a tela exibiu a mensagem
 * crua do banco. O contrato exato (maxlength 40 ou mensagem de bloqueio) AINDA
 * NÃO foi definido por Produto; por isso o teste é @pendente-produto e fica
 * fora do conjunto que vale como validador. Ele aceita as duas soluções
 * corretas e só reprova resultados objetivamente errados:
 *   1. o campo limita a 40: nada é enviado e o valor final é o prefixo de 40;
 *   2. a tela bloqueia o envio com mensagem amigável (nenhum POST);
 *   3. o envio chega ao backend e é recusado com mensagem amigável.
 * Reprova: proposta criada com nome > 40, erro cru do banco na tela, envio sem
 * resultado algum, ou campo que não recebeu o texto digitado.
 *
 * Mutável e idempotente: o envio passa por `reserveQaRun`/`markQaRunAttempt`.
 * Uma tentativa sem protocolo bloqueia novas execuções até alguém conferir o
 * SCCI e limpar a entrada do registro (.playwright/simulator-qa-runs). Isso vale
 * também quando o envio é recusado com mensagem amigável (desfecho 3): o teste
 * fica de execução única por entrada, de propósito (nunca repetir um envio que
 * possa ter criado proposta); para repetir após Produto corrigir, confira o SCCI
 * pelo CNPJ da entrada e remova a entrada do registro.
 */
const SCENARIO_ID = "PJ-NOME-62-CARACTERES";
const MAX_NAME_LENGTH = 40;
const LONG_NAME = "Empresa de Teste de Tamanho Maximo de Nome XXXXXXXXXXXXXXXXXXXX"; // 62 caracteres
const RAW_DATABASE_ERROR =
  /ORA-\d+|TOracleConnection|CAIXA2|PESSOA_PRETENDENTE|NO_PESSOA/;

const journey = OBSERVED_SIMULATOR_JOURNEYS.find(
  (item) =>
    item.id ===
    "Financiamento Imobiliário > Pessoa Jurídica > Imóvel Comercial > Imóvel Particular",
);
if (!journey) throw new Error("Jornada de referência inexistente.");

test(
  "nome da empresa acima de 40 caracteres é limitado ou recusado sem expor erro do banco",
  { tag: ["@integration", "@mutation", "@pendente-produto"] },
  async ({ page }) => {
    test.setTimeout(5 * 60_000);
    test.skip(
      process.env.PW_PROFILE !== "esteira-ht",
      "Envio de proposta exclusivo do perfil esteira-ht.",
    );
    assertMutationOptIn();
    assertEsteiraHtProvisioningTarget();
    expect(LONG_NAME.length, "O nome de teste precisa passar do limite.").toBeGreaterThan(
      MAX_NAME_LENGTH,
    );

    const seed = getDigitalMortgageSimulation().applicantSeed;
    const run = await reserveQaRun(SCENARIO_ID, seed, "CNPJ");
    if (run.protocol) {
      throw new Error(
        `A execução anterior criou a proposta ${run.protocol} com nome acima do limite; remova-a e limpe a entrada ${run.id} do registro antes de repetir.`,
      );
    }

    const posts: string[] = [];
    const responseBodies: string[] = [];
    const pendingBodies: Promise<void>[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/proposta"
      ) {
        posts.push(request.url());
      }
    });
    page.on("response", (response) => {
      if (
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/proposta"
      ) {
        pendingBodies.push(
          response.text().then(
            (body) => void responseBodies.push(body),
            () => void responseBodies.push("[corpo ilegível]"),
          ),
        );
      }
    });

    const simulator = new PortalSimulatorPage(page);
    await simulator.open();
    await simulator.startNewSimulation();
    await simulator.chooseJourney(journey.selection);
    await simulator.fillSimulationData(
      {
        propertyValueCents: "150000000",
        financingValueCents: "50000000",
        termMonths: 120,
        amortizationSystem: "SAC - Sistema de amortizacao constante",
        gracePeriodDays: 0,
        birthDateDigits: "01012001",
        netIncomeCents: "50000000",
        composeIncome: false,
      },
      journey.dataScreen,
    );
    await simulator.continueToInsurers();
    await simulator.selectInsurer("MAPFRE");
    await simulator.continueToResult();
    await simulator.continueToApplicantData();
    await simulator.fillCorporateApplicantData(
      {
        // O CNPJ enviado é o do registro: numa tentativa incerta, é ele que
        // identifica a proposta a conferir no SCCI (o nome longo não cabe no registro).
        cnpjDigits: run.applicant.cpfDigits,
        companyName: LONG_NAME,
        email: seed.email,
        phoneDigits: seed.mobileDigits,
      },
      { expectExactCompanyName: false },
    );

    const nameInput = page.getByRole("textbox", {
      name: "Nome da empresa",
      exact: true,
    });
    const typedName = await nameInput.inputValue();
    expect(
      typedName.length,
      "O campo precisa ter recebido o nome digitado (a verificação de limite não pode passar com o campo vazio).",
    ).toBeGreaterThan(0);

    // Solução 1: o campo limita o tamanho. Nada é enviado.
    if (typedName.length <= MAX_NAME_LENGTH) {
      expect(
        typedName,
        "Quando o campo limita o tamanho, o valor deve ser o prefixo do nome digitado.",
      ).toBe(LONG_NAME.slice(0, MAX_NAME_LENGTH));
      expect(posts, "Nada deve ser enviado ao backend.").toHaveLength(0);
      await markQaRunRejected(run.id, "campo limitou o nome a 40 caracteres; sem envio");
      return;
    }

    // O campo aceitou o nome inteiro: a tela precisa bloquear o envio ou o
    // backend precisa recusar de forma amigável.
    const dialog = page.getByRole("alertdialog", {
      name: "Confirmar envio",
      exact: true,
    });
    const alerts = page.getByRole("alert").filter({ hasText: /\S/ });
    const protocol = page.getByText(/^Protocolo:\s*\d+$/);
    // Alertas já presentes antes do clique não contam como bloqueio.
    const alertsBefore = await alerts.count();
    await page.getByRole("button", { name: "Enviar Proposta", exact: true }).click();

    await expect
      .poll(
        async () =>
          (await dialog.isVisible()) ||
          (await alerts.count()) > alertsBefore ||
          (await protocol.isVisible()),
        {
          message:
            "Após Enviar Proposta, a tela deve abrir a confirmação ou exibir uma NOVA mensagem de validação.",
          timeout: 30_000,
        },
      )
      .toBe(true);

    if (await dialog.isVisible()) {
      // Solução 3: a tela deixou enviar. A tentativa é registrada ANTES do envio.
      await markQaRunAttempt(run.id);
      const alertsBeforeSubmit = await alerts.count();
      await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
      await expect
        .poll(
          async () =>
            (await protocol.isVisible()) ||
            (await alerts.count()) > alertsBeforeSubmit ||
            posts.length > 0,
          {
            message: "O envio precisa terminar em protocolo ou em mensagem na tela.",
            timeout: 60_000,
          },
        )
        .toBe(true);
      await expect
        .poll(() => responseBodies.length, {
          message: "O backend deveria ter respondido ao envio.",
          timeout: 60_000,
        })
        .toBeGreaterThan(0);
      // Depois da resposta, espera o resultado aparecer na tela (protocolo OU
      // mensagem nova) ANTES de decidir: um protocolo que renderiza um instante
      // depois não pode ser classificado como recusa e sumir do registro.
      await expect(
        protocol.or(alerts.nth(alertsBeforeSubmit)),
        "Depois da resposta do envio, a tela deve mostrar o protocolo ou uma mensagem; sem isso o desfecho é incerto (a tentativa fica registrada, confira o SCCI pelo CNPJ).",
      ).toBeVisible({ timeout: 30_000 });
    }
    await Promise.all(pendingBodies);

    if (await protocol.isVisible()) {
      const created = (await protocol.innerText()).trim();
      const number = /(\d+)/.exec(created)?.[1] ?? created;
      await markQaRunSubmitted(run.id, number);
      throw new Error(
        `O Portal criou a proposta ${number} com um nome de ${typedName.length} caracteres (limite ${MAX_NAME_LENGTH}); remova-a manualmente.`,
      );
    }

    const alertTexts = (await alerts.allInnerTexts()).join(" | ");
    await markQaRunRejected(run.id, `nome longo recusado: ${alertTexts || "sem mensagem"}`);

    expect(
      alertTexts.trim().length,
      "A recusa precisa ser explicada ao usuário por uma mensagem na tela.",
    ).toBeGreaterThan(0);
    expect(
      alertTexts,
      "A TELA não pode expor o erro cru do banco (ORA-xxxxx, esquema, tabela, coluna).",
    ).not.toMatch(RAW_DATABASE_ERROR);
    expect
      .soft(
        responseBodies.join(" "),
        "A RESPOSTA DA API não deveria carregar o erro cru do banco (ORA-xxxxx, esquema, tabela, coluna).",
      )
      .not.toMatch(RAW_DATABASE_ERROR);
    expect
      .soft(
        posts.length,
        "Hipótese de Produto: o Simulador deveria validar o tamanho antes de enviar ao backend.",
      )
      .toBe(0);
  },
);
