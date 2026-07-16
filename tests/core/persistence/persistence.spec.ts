import type { Locator, Page, Response } from "@playwright/test";
import { expect, test } from "../../fixtures/test";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import type { ProposalPage } from "../../pages/portal/proposal.page";
import type { ProposalsPage } from "../../pages/portal/proposals.page";
import type { ProposalTabName } from "../../components/portal/proposal-tabs.component";

const coreMutation = { tag: ["@core", "@mutation"] };
const incomeFieldName = "PESSOA.VA_RENDA_BRUTA";

function getCoreOperation(portalConfig: PortalRuntimeConfig): string {
  const operation = portalConfig.testData.corePersistenceOperation.trim();
  if (!operation) {
    throw new Error(
      "Configure PORTAL_CORE_PERSISTENCE_OPERATION com uma proposta mutavel, dedicada e restauravel.",
    );
  }
  return operation;
}

function isDraftSaveResponse(response: Response, operation: string): boolean {
  const url = new URL(response.url());
  return (
    response.request().method() === "PUT" &&
    url.pathname === `/api/portal/propostas/${operation}/cadastro`
  );
}

async function expectSuccessfulDraftSave(response: Response): Promise<void> {
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    success?: unknown;
    sucesso?: unknown;
  };
  if (Object.hasOwn(body, "success")) {
    expect(body.success).toBe(true);
  }
  if (Object.hasOwn(body, "sucesso")) {
    expect(body.sucesso).toBe(true);
  }
}

async function ensureTabSelected(
  proposalPage: ProposalPage,
  tabName: ProposalTabName,
): Promise<void> {
  const tab = proposalPage.tabs.getTabButton(tabName);
  if ((await tab.getAttribute("aria-selected")) !== "true") {
    await proposalPage.tabs.select(tabName);
  }
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

async function openCoreProposal(
  proposalsPage: ProposalsPage,
  proposalPage: ProposalPage,
  operation: string,
): Promise<void> {
  await proposalsPage.open();
  await proposalsPage.loadAll();
  await proposalsPage.openProposal(operation);
  await proposalPage.waitUntilReady();
  const headingOperation = (await proposalPage.heading.textContent())?.replace(
    /\D/g,
    "",
  );
  expect(Number(headingOperation)).toBe(Number(operation));
}

async function replaceValue(field: Locator, value: string): Promise<string> {
  await field.clear();
  const digits = value.replace(/\D/g, "");
  if (digits) await field.pressSequentially(digits);
  return field.inputValue();
}

async function saveBySelectingTab(
  page: Page,
  proposalPage: ProposalPage,
  operation: string,
  tabName: ProposalTabName,
): Promise<Response> {
  const responsePromise = page.waitForResponse(
    (response) => isDraftSaveResponse(response, operation),
    { timeout: 30_000 },
  );
  await proposalPage.tabs.select(tabName);
  return responsePromise;
}

async function saveIncomeAndReturn(
  page: Page,
  proposalPage: ProposalPage,
  operation: string,
): Promise<void> {
  const saveResponse = await saveBySelectingTab(
    page,
    proposalPage,
    operation,
    "Composição de Renda",
  );
  await expectSuccessfulDraftSave(saveResponse);

  const returnResponse = await saveBySelectingTab(
    page,
    proposalPage,
    operation,
    "Sobre Você",
  );
  await expectSuccessfulDraftSave(returnResponse);
}

async function restoreIncome(
  page: Page,
  proposalsPage: ProposalsPage,
  proposalPage: ProposalPage,
  operation: string,
  originalValue: string,
): Promise<void> {
  await page.unroute("**/api/portal/propostas/*/cadastro");
  await openCoreProposal(proposalsPage, proposalPage, operation);
  await ensureTabSelected(proposalPage, "Sobre Você");

  const field = proposalPage.getFieldByName(incomeFieldName);
  await replaceValue(field, originalValue);
  await saveIncomeAndReturn(page, proposalPage, operation);
  await expect(field).toHaveValue(originalValue);

  await page.reload({ waitUntil: "domcontentloaded" });
  await proposalPage.waitUntilReady();
  await ensureTabSelected(proposalPage, "Sobre Você");
  await expect(proposalPage.getFieldByName(incomeFieldName)).toHaveValue(
    originalValue,
  );
}

test.describe("Portal Core: persistência e falsa confirmação", () => {
  test(
    "CORE-1 | salva rascunho parcial, recarrega, reabre, remove e restaura o valor",
    coreMutation,
    async ({ page, portalConfig, proposalPage, proposalsPage }) => {
      const operation = getCoreOperation(portalConfig);

      await openCoreProposal(proposalsPage, proposalPage, operation);
      await ensureTabSelected(proposalPage, "Sobre Você");
      const income = proposalPage.getFieldByName(incomeFieldName);
      const originalValue = await income.inputValue();

      try {
        const persistedValue = await replaceValue(income, "731245");
        await saveIncomeAndReturn(page, proposalPage, operation);
        await proposalPage.expectDraftSaved();
        await expect(income).toHaveValue(persistedValue);

        await page.reload({ waitUntil: "domcontentloaded" });
        await proposalPage.waitUntilReady();
        await ensureTabSelected(proposalPage, "Sobre Você");
        await expect(proposalPage.getFieldByName(incomeFieldName)).toHaveValue(
          persistedValue,
        );

        await openCoreProposal(proposalsPage, proposalPage, operation);
        await ensureTabSelected(proposalPage, "Sobre Você");
        const reopenedIncome = proposalPage.getFieldByName(incomeFieldName);
        await expect(reopenedIncome).toHaveValue(persistedValue);

        const clearedValue = await replaceValue(reopenedIncome, "");
        await saveIncomeAndReturn(page, proposalPage, operation);
        await expect(reopenedIncome).toHaveValue(clearedValue);

        await page.reload({ waitUntil: "domcontentloaded" });
        await proposalPage.waitUntilReady();
        await ensureTabSelected(proposalPage, "Sobre Você");
        await expect(proposalPage.getFieldByName(incomeFieldName)).toHaveValue(
          clearedValue,
        );
      } finally {
        await restoreIncome(
          page,
          proposalsPage,
          proposalPage,
          operation,
          originalValue,
        );
      }
    },
  );

  test(
    "CORE-1 | rejeita HTTP 500 sem sucesso falso, preserva o dado e persiste no retry real",
    coreMutation,
    async ({ page, portalConfig, proposalPage, proposalsPage }) => {
      const operation = getCoreOperation(portalConfig);

      await openCoreProposal(proposalsPage, proposalPage, operation);
      await ensureTabSelected(proposalPage, "Sobre Você");
      const income = proposalPage.getFieldByName(incomeFieldName);
      const originalValue = await income.inputValue();

      try {
        const retryValue = await replaceValue(income, "842356");
        let injectedFailures = 0;

        await page.route("**/api/portal/propostas/*/cadastro", async (route) => {
          const request = route.request();
          const pathname = new URL(request.url()).pathname;
          if (
            request.method() === "PUT" &&
            pathname === `/api/portal/propostas/${operation}/cadastro`
          ) {
            injectedFailures += 1;
            await route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({
                success: false,
                rascunho: false,
                message: "Não foi possível salvar o rascunho. Tente novamente.",
              }),
            });
            return;
          }
          await route.fallback();
        });

        const failedResponse = await saveBySelectingTab(
          page,
          proposalPage,
          operation,
          "Composição de Renda",
        );
        expect(injectedFailures).toBe(1);
        expect(failedResponse.status()).toBe(500);

        await expect.soft(
          page.getByText(/Não foi possível salvar o rascunho/i),
        ).toBeVisible();
        await expect.soft(
          page.getByText("Rascunho salvo", { exact: true }),
        ).toBeHidden();

        const returnResponse = await saveBySelectingTab(
          page,
          proposalPage,
          operation,
          "Sobre Você",
        );
        expect(returnResponse.status()).toBe(500);
        expect(injectedFailures).toBe(2);
        await expect.soft(income).toHaveValue(retryValue);

        await page.unroute("**/api/portal/propostas/*/cadastro");
        const retryResponse = await saveBySelectingTab(
          page,
          proposalPage,
          operation,
          "Composição de Renda",
        );
        await expectSuccessfulDraftSave(retryResponse);
        const retryReturnResponse = await saveBySelectingTab(
          page,
          proposalPage,
          operation,
          "Sobre Você",
        );
        await expectSuccessfulDraftSave(retryReturnResponse);
        await proposalPage.expectDraftSaved();
        await expect(income).toHaveValue(retryValue);

        await page.reload({ waitUntil: "domcontentloaded" });
        await proposalPage.waitUntilReady();
        await ensureTabSelected(proposalPage, "Sobre Você");
        await expect(proposalPage.getFieldByName(incomeFieldName)).toHaveValue(
          retryValue,
        );
      } finally {
        await restoreIncome(
          page,
          proposalsPage,
          proposalPage,
          operation,
          originalValue,
        );
      }
    },
  );
});
