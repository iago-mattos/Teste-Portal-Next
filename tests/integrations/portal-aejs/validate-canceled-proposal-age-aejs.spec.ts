import type { Page } from "@playwright/test";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";

const monthByAbbreviation: Readonly<Record<string, number>> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseAejsCalendarDate(value: string): Date {
  const match = /^(\d{2})\/([A-Z][a-z]{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Data SCCI inválida: ${value}`);

  const [, dayText, monthText, yearText] = match;
  const month = monthByAbbreviation[monthText!];
  if (month === undefined) throw new Error(`Mês SCCI inválido: ${monthText}`);

  return new Date(Number(yearText), month, Number(dayText));
}

function ageInCalendarDays(value: Date, reference = new Date()): number {
  const valueUtc = Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const referenceUtc = Date.UTC(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  return Math.floor((referenceUtc - valueUtc) / 86_400_000);
}

async function openCancellationSummary(
  aejsPage: Page,
  operation: string,
): Promise<AejsOperationsPage> {
  const operationsPage = new AejsOperationsPage(aejsPage);
  await operationsPage.navigateToOperations();
  await operationsPage.openOperationEventually(operation);
  await expect(operationsPage.openedOperationNumber).toHaveValue(operation);
  await expect(operationsPage.openedCurrentPhase).toHaveValue(
    "Proposta Cancelada",
  );
  await operationsPage.openFullOperationSummary();
  return operationsPage;
}

test.describe("Portal → SCCI | idade das propostas canceladas", () => {
  test(
    "cancelada há até 30 dias permanece visível e possui data coerente no SCCI",
    { tag: ["@integration", "@readonly"] },
    async ({ aejsPage, portalConfig, portalSession, proposalsPage }) => {
      const operation = portalConfig.testData.propostaCanceladaAte30DiasId;
      if (!operation) {
        throw new Error(
          "PORTAL_PROPOSAL_CANCELED_WITHIN_30_DAYS deve estar configurada.",
        );
      }

      await portalSession.useOperation(operation);
      await proposalsPage.open();
      await proposalsPage.loadAll();
      const card = proposalsPage.getProposalCard(operation);
      await expect(card).toBeVisible();
      await expect(card).toContainText(/Proposta Cancelada|Cancelad[ao]/i);

      const operationsPage = await openCancellationSummary(aejsPage, operation);
      const age = ageInCalendarDays(
        parseAejsCalendarDate(await operationsPage.cancellationDate.inputValue()),
      );
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThanOrEqual(30);
    },
  );

  test(
    "cancelada há mais de 30 dias não aparece, mas sua existência e data são comprovadas no SCCI",
    { tag: ["@integration", "@readonly"] },
    async ({ aejsPage, portalConfig, portalSession, proposalsPage }) => {
      const operation = portalConfig.testData.propostaCanceladaMais30DiasId;
      if (!operation) {
        throw new Error(
          "PORTAL_PROPOSAL_CANCELED_OVER_30_DAYS deve estar configurada.",
        );
      }

      await portalSession.useOperation(operation);
      await proposalsPage.open();
      await proposalsPage.loadAll();
      await expect(proposalsPage.getProposalCard(operation)).toHaveCount(0);

      const operationsPage = await openCancellationSummary(aejsPage, operation);
      const age = ageInCalendarDays(
        parseAejsCalendarDate(await operationsPage.cancellationDate.inputValue()),
      );
      expect(age).toBeGreaterThan(30);
    },
  );
});
