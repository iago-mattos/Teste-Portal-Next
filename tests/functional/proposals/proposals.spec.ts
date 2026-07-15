import { expect, test } from "../../fixtures/test";
import {
  addCalendarDays,
  countBusinessDays,
  formatBrazilianDate,
  parseBrazilianDate,
} from "../../helpers/dates";
import { normalizeWhitespace } from "../../helpers/strings";

const functionalReadonly = { tag: ["@functional", "@readonly"] };

test.describe("Minhas Propostas", () => {
  test.beforeEach(async ({ proposalsPage, portalConfig, portalSession }, testInfo) => {
    const caseId = testInfo.title.match(/^PROP-\d+/)?.[0];
    const operationByCase: Readonly<Record<string, string>> = {
      "PROP-07": portalConfig.testData.propostaExpiradaId,
      "PROP-08": portalConfig.testData.propostaCreditoReprovadoId,
      "PROP-09": portalConfig.testData.propostaCreditoAprovadoId,
      "PROP-10": portalConfig.testData.propostaExpiradaMais30DiasId,
      "PROP-11": portalConfig.testData.propostaExpiradaId,
      "PROP-12": portalConfig.testData.propostaCanceladaId,
      "PROP-17": portalConfig.testData.propostaCreditoAprovadoId,
    };
    const operationNumber = caseId ? operationByCase[caseId] : undefined;
    if (operationNumber) await portalSession.useOperation(operationNumber);

    await proposalsPage.open();
    await proposalsPage.loadAll();
  });

  test(
    "PROP-01 | Deverá vir do lead as informações: Nº da proposta, Data de cadastro, Endereço do imóvel, Valor do imóvel, Valor do empréstimo, prazo solicitado",
    functionalReadonly,
    async ({ proposalsPage, portalConfig, proposalPage }) => {
      const expected = portalConfig.testData.expectedProposal;
      const card = proposalsPage.getProposalCard(expected.visibleNumber);
      await expect(card).toBeVisible();

      const textContent = await card.textContent();
      const normalized = normalizeWhitespace(textContent || "");

      const displayedNumber = expected.visibleNumber.replace(/^0+(?=\d)/, "");
      expect(normalized).toContain(`Proposta #${displayedNumber}`);
      expect(normalized).toContain(`Data de cadastro: ${expected.registrationDate}`);
      expect(normalized).toContain(expected.propertyValue);
      expect(normalized).toContain(expected.financedValue);
      expect(normalized).toContain(expected.term);

      await proposalsPage.openProposal(expected.visibleNumber);
      await proposalPage.waitUntilReady();
      await proposalPage.tabs.select("Imóvel");

      const addressField = proposalPage.getFieldByName("IMOVEL_OPERACAO.NO_ENDERECO");
      await expect(addressField).toBeVisible();
      await expect(addressField).not.toHaveValue("");
    },
  );

  test(
    "PROP-02 | As informações Endereço do imóvel, Valor do imóvel, Valor do empréstimo, prazo solicitado não sofrem alteração em fase de perfilamento pelo cliente por isso ficam sempre iguais. Caso haja alteração na plataforma da prognum nesse momento aí sim reflete no portal.",
    functionalReadonly,
    async ({ proposalsPage, portalConfig, proposalPage, authenticatedPage }) => {
      const expected = portalConfig.testData.expectedProposal;
      await proposalsPage.openProposal(expected.visibleNumber);
      await proposalPage.waitUntilReady();

      await proposalPage.tabs.select("Motivo da Contratação");
      const requestedCredit = authenticatedPage.getByRole("textbox", {
        name: "Valor solicitado do Crédito",
        exact: true,
      });
      const estimatedTerm = authenticatedPage.getByRole("textbox", {
        name: "Prazo estimado",
        exact: true,
      });
      const interestType = authenticatedPage.getByRole("textbox", {
        name: "Tipo de Juros",
        exact: true,
      });

      await expect(requestedCredit).toBeVisible();
      await expect(requestedCredit).toBeDisabled();
      await expect(requestedCredit).toHaveValue(expected.financedValue);
      await expect(estimatedTerm).toBeVisible();
      await expect(estimatedTerm).toBeDisabled();
      await expect(estimatedTerm).toHaveValue(expected.term.replace(/\s*meses$/i, ""));
      await expect(interestType).toBeVisible();
      await expect(interestType).toBeDisabled();
      await expect(interestType).toHaveValue(expected.interestType);

      await proposalPage.tabs.select("Imóvel");
      await expect(proposalPage.getFieldByName("OPERACAO_CREDITO.VA_PRECO_IMOVEL")).toBeDisabled();
      await expect(proposalPage.getFieldByName("IMOVEL_OPERACAO.NO_ENDERECO")).toBeDisabled();
    },
  );

  test.fixme(
    "PROP-03 | As informações Endereço do imóvel, Valor do imóvel, Valor do empréstimo, prazo solicitado quando alteradas em outras fases na plataforma prognum, refletirão no portal",
    functionalReadonly,
    async () => {
      // Pendente de implementação conforme conhecidos-pendentes (known-pending.json)
    },
  );

  test(
    "PROP-04 | Deverá aparecer em “Etapa” o De/Para do status da fase parametrizado pelo C6 na “Nome da fase na WEB” na tabela de fases de operação",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const expected = portalConfig.testData.expectedProposal;
      const card = proposalsPage.getProposalCard(expected.visibleNumber);
      await expect(card).toBeVisible();
      await expect(card).toContainText("Fase Atual");
      await expect(card).toContainText(expected.currentPhase);
    },
  );

  test(
    "PROP-05 | O preenchimento será dividido em duas tarefas “Preenchimento Cadastral” e “Preenchimento de Documentos”, onde a fase de preenchimento de documentos depende do término de preenchimento de cadastro",
    functionalReadonly,
    async ({ proposalsPage, portalConfig, portalSession, authenticatedPage }) => {
      test.setTimeout(60000);
      const ids = portalConfig.caseProposalIds;
      if (!ids.TIMELINE_04_CADASTRO || !ids.TIMELINE_04_DOCUMENTOS) {
        throw new Error("caseProposalIds para a jornada de timeline04 devem estar configurados.");
      }

      const openJourney = async (proposalNumber: string, heading: string) => {
        await portalSession.useOperation(proposalNumber);
        await proposalsPage.open();
        await proposalsPage.loadAll();
        const card = proposalsPage.getProposalCard(proposalNumber);
        await expect(card).toBeVisible();

        const openButton = card.getByRole("button", {
          name: /Completar cadastro|Acompanhar proposta|Enviar documentos/i,
        });
        await expect(openButton).toBeVisible();

        await Promise.all([
          authenticatedPage.waitForURL((url) => /^\/propostas\/[^/]+$/.test(url.pathname)),
          openButton.click(),
        ]);

        await expect(
          authenticatedPage.getByRole("heading", { name: heading, level: 2 }),
        ).toBeVisible({ timeout: 30000 });
      };

      await openJourney(ids.TIMELINE_04_CADASTRO, "Cadastro da Proposta");
      await openJourney(ids.TIMELINE_04_DOCUMENTOS, "Documentos da proposta");
    },
  );

  test(
    "PROP-06 | Tanto a tarefa de Preenchimento cadastral quando a de preenchimento terão prazos parametrizáveis pelo C6",
    functionalReadonly,
    async ({ proposalsPage }) => {
      const cards = proposalsPage.proposalCards;
      await expect(cards.first()).toBeVisible();

      const count = await cards.count();
      const deadlines: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await cards.nth(i).textContent();
        const match = text?.match(
          /Data limite para preenchimento do cadastro:\s*(\d{2}\/\d{2}\/\d{4})/i,
        );
        if (match?.[1]) {
          deadlines.push(match[1]);
        }
      }

      expect(deadlines.length).toBeGreaterThanOrEqual(2);
      expect(new Set(deadlines).size).toBeGreaterThan(1);
    },
  );

  test(
    "PROP-07 | Deverá aparecer em “Etapa” “proposta expirada” de forma automática quando atingir parametrizado em uma das tarefas sem atuação do cliente.",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const proposalId = portalConfig.testData.propostaExpiradaId;
      if (!proposalId) {
        throw new Error("PORTAL_PROPOSAL_EXPIRED deve estar configurada.");
      }
      const card = proposalsPage.getProposalCard(proposalId);
      await expect(card).toBeVisible();
      await expect(card).toContainText(/Expirad/);
    },
  );

  test(
    "PROP-08 | Deverá ser informado para o cliente a mensagem “Verifique seu e-mail ou entre em contato com o consultor”, propostas negadas pela mesa de crédito",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const proposalId = portalConfig.testData.propostaCreditoReprovadoId;
      if (!proposalId) {
        throw new Error("PORTAL_PROPOSAL_CREDIT_REJECTED deve estar configurada.");
      }
      const card = proposalsPage.getProposalCard(proposalId);
      await expect(card).toBeVisible();
      await expect(card).toContainText(/Cr[eé]dito Reprovado/i);
      await expect(
        card.getByText(/Verifique seu e-mail ou entre em contato com o consultor/i),
      ).toBeVisible();
      await expect(
        card.getByRole("button", { name: /Completar cadastro/i }),
      ).toHaveCount(0);
    },
  );

  test(
    "PROP-09 | Deverá ser informado para o cliente a mensagem “Verifique seu e-mail ou entre em contato com o consultor”, propostas com status a partir da Análise de Crédito.",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const proposalId = portalConfig.testData.propostaCreditoAprovadoId;
      if (!proposalId) {
        throw new Error("PORTAL_PROPOSAL_CREDIT_APPROVED deve estar configurada.");
      }
      const card = proposalsPage.getProposalCard(proposalId);
      await expect(card).toBeVisible();
      await expect(card).toContainText(
        /Fase Atual\s*(Cr[eé]dito|Negocia[cç][aã]o|An[aá]lise)/i,
      );
      await expect(
        card.getByText(/Verifique seu e-mail ou entre em contato com o consultor/i),
      ).toBeVisible();
    },
  );

  test(
    "PROP-10 | Simulações canceladas acimas de 30 dias não veremos no resumo",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const proposalId = portalConfig.testData.propostaExpiradaMais30DiasId;
      if (!proposalId) {
        throw new Error("propostaExpiradaMais30DiasId deve estar configurada.");
      }

      await expect(proposalsPage.getProposalCard(proposalId)).toHaveCount(0);
    },
  );

  test(
    "PROP-11 | Simulações canceladas até e igual 30 dias deverão constar em tela",
    functionalReadonly,
    async ({ proposalsPage, authenticatedPage, portalConfig }) => {
      const proposalId = portalConfig.testData.propostaExpiradaId;
      if (!proposalId) {
        throw new Error("PORTAL_PROPOSAL_EXPIRED deve estar configurada.");
      }
      const card = proposalsPage.getProposalCard(proposalId);
      await expect(card).toBeVisible();

      const firstCardButton = card.getByRole("button", {
        name: /Acompanhar proposta|Completar cadastro/i,
      });

      await Promise.all([
        authenticatedPage.waitForURL((url) => /^\/propostas\/[^/]+$/.test(url.pathname)),
        firstCardButton.click(),
      ]);

      await expect(authenticatedPage.locator("body")).toBeVisible();
    },
  );

  test(
    "PROP-12 | Simulações canceladas na Prognum, também precisam estar canceladas no portal, tem que refletir exatamente o que está na Prognum em relação a proposta",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const proposalId = portalConfig.testData.propostaCanceladaId;
      if (!proposalId) {
        throw new Error("PORTAL_PROPOSAL_CANCELED deve estar configurada.");
      }
      const card = proposalsPage.getProposalCard(proposalId);
      await expect(card).toBeVisible();
      await expect(card).toContainText(/Cancelad[ao]/i);
      await expect(
        card.getByRole("button", { name: /Completar cadastro/i }),
      ).toHaveCount(0);
    },
  );

  test(
    "PROP-13 | Prazo remanescente deverá ser atualizado conforme os dias passarem até restar 0 dias",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const expected = portalConfig.testData.expectedProposal;
      const card = proposalsPage.getProposalCard(expected.visibleNumber);
      await expect(card).toBeVisible();

      const deadline = addCalendarDays(
        parseBrazilianDate(expected.registrationDate),
        30,
      );
      const formattedDeadline = formatBrazilianDate(deadline);

      await expect(card).toContainText(
        `Data limite para preenchimento do cadastro: ${formattedDeadline}`,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const remaining = Math.max(0, Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000));

      const label =
        remaining === 0
          ? /Vence hoje|0 dias? restantes/i
          : new RegExp(`${remaining} dias? restantes`, "i");

      await expect(card.getByText(label)).toBeVisible();
    },
  );

  test(
    "PROP-14 | Prazo deverá correr contabilizando dias úteis.",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const expected = portalConfig.testData.expectedProposal;
      const card = proposalsPage.getProposalCard(expected.visibleNumber);
      await expect(card).toBeVisible();

      const deadline = addCalendarDays(
        parseBrazilianDate(expected.registrationDate),
        30,
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const calendarDays = Math.max(0, Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000));
      const businessDays = countBusinessDays(new Date(), deadline);

      if (businessDays !== calendarDays) {
        test.fail(
          true,
          `PROP-14 falha porque o produto exibe dias corridos (${calendarDays}) em vez de dias úteis (${businessDays})`,
        );
      }

      const label = new RegExp(`${businessDays} dias? restantes`, "i");
      await expect(card.getByText(label)).toBeVisible();
    },
  );

  test(
    "PROP-15 | Data fim de preenchimento deverá se mater a mesma desde o início",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const expected = portalConfig.testData.expectedProposal;
      const card = proposalsPage.getProposalCard(expected.visibleNumber);
      await expect(card).toBeVisible();
      const deadline = formatBrazilianDate(
        addCalendarDays(parseBrazilianDate(expected.registrationDate), 30),
      );
      await expect(card).toContainText(
        `Data limite para preenchimento do cadastro: ${deadline}`,
      );
    },
  );

  test(
    "PROP-16 | O botão refazer simulação deverá ser chamado “Fazer simulação com outro imóvel” e direcionar para página https://c6imobiliario.com.br",
    functionalReadonly,
    async ({ proposalsPage, portalConfig, authenticatedPage }) => {
      const button = authenticatedPage.getByRole("button", {
        name: "Fazer simulacao com outro imovel",
      });
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();

      console.log("Button HTML:", await button.evaluate(el => el.outerHTML));

      await Promise.all([
        authenticatedPage.waitForURL((url) => {
          console.log("Navigated to URL:", url.href);
          return url.origin === portalConfig.externalSimulationUrl || url.pathname === "/menu-simulacao";
        }),
        button.click(),
      ]);

      await proposalsPage.open();
    },
  );

  test(
    "PROP-17 | Propostas que tiveram o cadastro finalizado irão para crédito e exibir um modal que ele concluiu a etapa e irá aguardar contato por e-mail ou whatsapp.",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const proposalId = portalConfig.testData.propostaCreditoAprovadoId;
      if (!proposalId) {
        throw new Error("PORTAL_PROPOSAL_CREDIT_APPROVED deve estar configurada.");
      }
      const card = proposalsPage.getProposalCard(proposalId);
      await expect(card).toBeVisible();
      await expect(card).toContainText(/Fase Atual\s*Cr[eé]dito/i);
      await expect(
        card.getByRole("button", { name: /Completar cadastro/i }),
      ).toHaveCount(0);
    },
  );

  test(
    "PROP-18 | Na proposta em tela, quando o cliente tiver mais eu duas propostas ao passar o mouse o cliente será direcionado para jornada solicitada no momento (ex: completar dados cadatrais, anexar documentos, pendencias...) para proposta desejada",
    functionalReadonly,
    async ({ proposalsPage, authenticatedPage }) => {
      const cards = proposalsPage.proposalCards;
      const count = await cards.count();

      const proposalNumbers: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await cards.nth(i).textContent();
        if (
          text &&
          /Completar cadastro|Acompanhar proposta|Enviar documentos|Ver pend[eê]ncias/i.test(text)
        ) {
          const match = text.match(/Proposta\s*#(\d+)/i);
          if (match?.[1]) {
            proposalNumbers.push(match[1]);
          }
        }
      }

      expect(new Set(proposalNumbers).size).toBeGreaterThan(1);

      const proposalsToValidate = proposalNumbers.slice(0, 2);
      const openedJourneys: string[] = [];

      for (const [index, proposalNumber] of proposalsToValidate.entries()) {
        if (index > 0) {
          await proposalsPage.open();
        }

        const card = proposalsPage.getProposalCard(proposalNumber);
        const actionButton = card.getByRole("button", {
          name: /Completar cadastro|Acompanhar proposta|Enviar documentos|Ver pend[eê]ncias/i,
        });
        await expect(actionButton).toBeVisible();

        await actionButton.click();

        const dialog = proposalsPage.getDialog();

        await expect(async () => {
          const pathname = new URL(authenticatedPage.url()).pathname;
          const openedProposal = /^\/propostas\/[^/]+$/.test(pathname);
          const openedDialog = await dialog.root.isVisible();
          expect(openedProposal || openedDialog).toBe(true);
        }).toPass({ timeout: 5000 });

        const pathname = new URL(authenticatedPage.url()).pathname;
        const openedProposal = /^\/propostas\/[^/]+$/.test(pathname);

        if (openedProposal) {
          expect(pathname).toContain(proposalNumber);
          openedJourneys.push(pathname);
        } else {
          const dialogText = await dialog.root.textContent();
          expect(dialogText).toContain("Proposta");
          openedJourneys.push(`dialog:${proposalNumber}:${dialogText?.trim()}`);

          await dialog.clickButton(/Entendido|Fechar/i);
        }
      }

      expect(openedJourneys.length).toBeGreaterThanOrEqual(2);
    },
  );

  test(
    "PROP-19 | Data de vencimento, fica na proposta, sem necessidade de mensagem informativa em tela nesse momento, para não distrair o cliente.",
    functionalReadonly,
    async ({ proposalsPage, portalConfig }) => {
      const expected = portalConfig.testData.expectedProposal;
      const card = proposalsPage.getProposalCard(expected.visibleNumber);
      await expect(card).toBeVisible();
      const deadline = formatBrazilianDate(
        addCalendarDays(parseBrazilianDate(expected.registrationDate), 30),
      );
      await expect(card).toContainText(
        `Data limite para preenchimento do cadastro: ${deadline}`,
      );

      const dialog = proposalsPage.getDialog();
      await expect(dialog.root).toBeHidden();
    },
  );
});
