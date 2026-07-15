import { expect, test } from "../../fixtures/test";
import {
  addCalendarDays,
  formatBrazilianDate,
  parseBrazilianDate,
} from "../../helpers/dates";

const functionalReadonly = { tag: ["@functional", "@readonly"] };

function formatBrazilianDateWithShortMonth(value: string): string {
  const [day, month, year] = value.split("/");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${day}/${months[Number(month) - 1]}/${year}`;
}

test.describe("Portal Cadastro: Linha do Tempo e Alertas", () => {
  test.beforeEach(async ({ proposalsPage, proposalPage, portalConfig, portalSession, page }, testInfo) => {
    const caseId = testInfo.title.match(/^TIMELINE-\d+/)?.[0];
    if (caseId === "TIMELINE-05") {
      await portalSession.useOperation(
        portalConfig.testData.propostaCreditoAprovadoId,
      );
    } else if (caseId === "TIMELINE-06") {
      await portalSession.useOperation(portalConfig.testData.propostaExpiradaId);
    }

    if (caseId === "TIMELINE-04" || caseId === "TIMELINE-10") {
      await proposalsPage.open();
      await proposalsPage.loadAll();
    } else if (caseId === "TIMELINE-05") {
      await proposalsPage.open();
      await proposalsPage.loadAll();

      const card = proposalsPage.proposalCards.filter({ hasText: /Fase Atual\s*Cr[eé]dito/i }).first();
      await expect(card).toBeVisible();

      const button = card.getByRole("button", { name: /Acompanhar proposta|Completar cadastro/i });
      await expect(button).toBeVisible();

      await Promise.all([
        page.waitForURL((url) => /^\/propostas\/[^/]+$/.test(url.pathname)),
        button.click(),
      ]);
    } else if (caseId === "TIMELINE-06") {
      await proposalsPage.open();
      await proposalsPage.loadAll();
    } else {
      const defaultProposalId = portalConfig.testData.expectedProposal.visibleNumber;
      await proposalsPage.open();
      await proposalsPage.loadAll();
      await proposalsPage.openProposal(defaultProposalId);
      await proposalPage.waitUntilReady();
    }
  });

  test(
    "TIMELINE-01 | Deverá conter cabeçalho com nome do proponente e CPF do proponente",
    functionalReadonly,
    async ({ proposalPage, portalConfig }) => {
      const expected = portalConfig.testData.expectedProposal;
      await expect(proposalPage.proponentInfo).toContainText(expected.proponentName);
      await expect(proposalPage.proponentInfo).toContainText(`***.***.***-${expected.cpfEnding}`);
    },
  );

  test(
    "TIMELINE-02 | Retirar a indicação de CNPJ, mantendo apenas CPF",
    functionalReadonly,
    async ({ proposalPage }) => {
      await expect(proposalPage.proponentInfo).toContainText("CPF:");
      await expect(proposalPage.proponentInfo).not.toContainText("CNPJ:");
    },
  );

  test(
    "TIMELINE-03 | Linha do tempo deverá ser composta por: Simulação, Cadastro, Crédito, Negociação, Análise de Documentos, Análise Técnica, Formalização e Liberação.",
    functionalReadonly,
    async ({ proposalPage }) => {
      const expectedPhases = [
        "Simulação",
        "Cadastro",
        "Crédito",
        "Negociação",
        "Análise de Documentos",
        "Análise Técnica",
        "Formalização",
        "Liberação",
      ];
      for (const phase of expectedPhases) {
        await expect(proposalPage.phasesNav).toContainText(phase);
      }
    },
  );

  test(
    "TIMELINE-04 | O cliente poderá chegar nessa tela através de todas as jornadas na tela anterior",
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
    "TIMELINE-05 | A linha do tempo do portal se comunicará com a linha do tempo existente na prognum",
    functionalReadonly,
    async ({ proposalPage }) => {
      const currentStep = proposalPage.phasesNav.locator('li[aria-current="step"]');
      await expect(currentStep).toBeVisible();
      await expect(currentStep).toContainText("Crédito");
    },
  );

  test(
    "TIMELINE-06 | Se proposta expirada tela disponível para visualização, mas edição inabilitada",
    functionalReadonly,
    async ({ proposalsPage, portalConfig, authenticatedPage }) => {
      const propostaExpiradaId = portalConfig.testData.propostaExpiradaId;
      if (!propostaExpiradaId) {
        throw new Error("propostaExpiradaId deve estar configurada.");
      }

      const visibleNumber = propostaExpiradaId.replace(/^0+/, "");
      const card = proposalsPage.getProposalCard(visibleNumber);
      await expect(card).toBeVisible();

      const openButton = card.getByRole("button", {
        name: /Completar cadastro|Acompanhar proposta/i,
      });
      await expect(openButton).toBeVisible();

      await Promise.all([
        authenticatedPage.waitForURL((url) => /^\/propostas\/[^/]+$/.test(url.pathname)),
        openButton.click(),
      ]);

      const dialog = authenticatedPage.getByRole("dialog");
      await expect(dialog).toHaveCount(0);

      // Aguarda o desaparecimento dos skeletons de carregamento
      await expect(authenticatedPage.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 30000 });

      // Aguarda pelo menos um input ficar visível para garantir carregamento do form
      const firstInput = authenticatedPage.locator("input:visible").first();
      await expect(firstInput).toBeVisible({ timeout: 30000 });

      const fields = authenticatedPage.locator("input:visible, select:visible, textarea:visible");
      const count = await fields.count();
      expect(count).toBeGreaterThanOrEqual(1);

      for (let i = 0; i < count; i++) {
        const field = fields.nth(i);
        const name = (await field.getAttribute("name")) || (await field.getAttribute("id")) || `field-${i}`;
        const isDisabled = await field.isDisabled();
        const isReadonly = await field.getAttribute("readonly") !== null;
        expect(
          isDisabled || isReadonly,
          `Campo ${name} deve estar inabilitado ou somente leitura`
        ).toBe(true);
      }

      const confirmButton = authenticatedPage.getByRole("button", {
        name: /Confirmar e avançar cadastro/i,
      });
      if (await confirmButton.count() > 0) {
        await expect(confirmButton).toBeDisabled();
      }
    },
  );

  test(
    "TIMELINE-07 | Trazer mensagem informativa da data fim para preenchimento do cadastro",
    functionalReadonly,
    async ({ authenticatedPage, portalConfig }) => {
      const registrationDate = parseBrazilianDate(
        portalConfig.testData.expectedProposal.registrationDate,
      );
      const deadline = formatBrazilianDateWithShortMonth(
        formatBrazilianDate(addCalendarDays(registrationDate, 30)),
      );
      const regex = new RegExp(`Você tem até o dia\\s*${deadline.replace(/\//g, "\\/")}\\s*para finalizar o cadastro`, "i");
      await expect(authenticatedPage.getByText(regex)).toBeVisible();
    },
  );

  test(
    "TIMELINE-08 | Exibir mensagem indicando obrigatoriedade de preenchimento",
    functionalReadonly,
    async ({ proposalPage }) => {
      test.setTimeout(60_000);
      const message = "As informações deste Cadastro são obrigatórias para dar continuidade ao processo.";
      await expect(proposalPage.getAlert(message)).toBeVisible();
    },
  );

  test(
    "TIMELINE-09 | Caso o cliente feche a mensagem de cadastro obrigatório não precisa apresentar novamente.",
    functionalReadonly,
    async ({ proposalPage, authenticatedPage }) => {
      test.setTimeout(60_000);
      const message = "As informações deste Cadastro são obrigatórias para dar continuidade ao processo.";
      const alert = proposalPage.getAlert(message);
      await expect(alert).toBeVisible();

      const closeButton = alert.getByRole("button", { name: "Fechar aviso" });
      await expect(closeButton).toBeVisible();
      await closeButton.click();

      const dontShowButton = authenticatedPage.getByRole("button", { name: /^Não mostrar novamente$/i });
      await expect(dontShowButton).toBeVisible();
      await dontShowButton.click();

      await expect(alert).toBeHidden();

      await authenticatedPage.reload();
      await expect(alert).toBeHidden();
    },
  );

  test(
    "TIMELINE-10 | Quando mais de uma proposta em andamento, a data limite de cada proposta deverá ser mostrada ao cliente",
    functionalReadonly,
    async ({ proposalsPage }) => {
      const cardsWithDeadline = proposalsPage.proposalCards.filter({
        hasText:
          /Data limite para preenchimento do cadastro:\s*\d{2}\/\d{2}\/\d{4}/i,
      });
      const count = await cardsWithDeadline.count();
      expect(count).toBeGreaterThanOrEqual(2);

      for (let index = 0; index < count; index++) {
        await expect(cardsWithDeadline.nth(index)).toContainText(
          /Data limite para preenchimento do cadastro:\s*\d{2}\/\d{2}\/\d{4}/i,
        );
      }
    },
  );

  test(
    "TIMELINE-11 | Manter habilitado botão “Ver detalhes da operação” e mostrar evolução do preenchimento",
    functionalReadonly,
    async ({ authenticatedPage }) => {
      const button = authenticatedPage.getByRole("button", { name: /Ver Detalhes da Operação/i });
      await expect(button).toHaveCount(0);
    },
  );

  test(
    "TIMELINE-12 | Retirar botão “Ver documentos”, pois só teremos no final após liberação cadastral.",
    functionalReadonly,
    async ({ authenticatedPage }) => {
      const button = authenticatedPage.getByRole("button", { name: /Ver documentos/i });
      await expect(button).toHaveCount(0);
    },
  );
});
