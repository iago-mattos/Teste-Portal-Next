import type { Locator, Page, Response } from "@playwright/test";
import { expect, test } from "../../fixtures/test";
import type { ProposalPage } from "../../pages/portal/proposal.page";
import type { ProposalsPage } from "../../pages/portal/proposals.page";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import { generateValidCpfDigits } from "../../helpers/cpf";
import { evaluateCoreCapabilities } from "../../config/core-capabilities";
import type { PortalSession } from "../../fixtures/portal.fixture";

const coreMutation = { tag: ["@core", "@mutation"] };
const spouseNameField = "CONJUGE.NO_PESSOA";
const spouseBirthField = "CONJUGE.DT_NASCIMENTO";

function draftPath(operation: string): string {
  return `/api/portal/propostas/${operation}/cadastro`;
}

async function openDefaultProposal(
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  proposalsPage: ProposalsPage,
  proposalPage: ProposalPage,
): Promise<string> {
  const operation = portalConfig.testData.coreMasses.registration.operation;
  await portalSession.useOperation(operation);
  await proposalsPage.open();
  await proposalsPage.loadAll();
  await proposalsPage.openProposal(operation);
  await proposalPage.waitUntilReady();
  return operation;
}

async function saveBySelectingTab(
  page: Page,
  proposalPage: ProposalPage,
  operation: string,
  tabName: "Sobre Você" | "Composição de Renda" | "Motivo da Contratação" | "Imóvel",
): Promise<Response> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === draftPath(operation),
  );
  await proposalPage.tabs.select(tabName);
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  return response;
}

async function pasteValue(
  page: Page,
  field: Locator,
  value: string,
): Promise<void> {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(async (text) => navigator.clipboard.writeText(text), value);
  await field.clear();
  await field.focus();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+V" : "Control+V",
  );
}

async function selectSpouseTab(proposalPage: ProposalPage): Promise<void> {
  await proposalPage.tabs.select("Cônjuge");
  await expect(proposalPage.getFieldByName(spouseNameField)).toBeEnabled();
}

function deterministicCpf(): string {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let index = 0;
  return generateValidCpfDigits(() => digits[index++ % digits.length]);
}

async function expectInvalidSpouseDate(
  page: Page,
  proposalPage: ProposalPage,
  dateDigits: string,
): Promise<void> {
  await selectSpouseTab(proposalPage);
  const birthDate = proposalPage.getFieldByName(spouseBirthField);
  await birthDate.fill(dateDigits);
  await page
    .getByRole("button", { name: "Confirmar e avançar cadastro" })
    .click();
  await expect.soft(
    page
      .getByRole("alert")
      .filter({ hasText: /Cônjuge:.*Data de Nascimento/i }),
    `A data ${dateDigits} deve ser rejeitada como nascimento inválido.`,
  ).toBeVisible({ timeout: 2_000 });
}

async function restoreSpouse(
  page: Page,
  proposalPage: ProposalPage,
  operation: string,
): Promise<void> {
  await proposalPage.tabs.select("Sobre Você");
  await proposalPage.getFieldByName("PESSOA.CO_ESTCIV").selectOption("");
  await saveBySelectingTab(
    page,
    proposalPage,
    operation,
    "Composição de Renda",
  );
}

test.describe("Portal Core: campos essenciais", () => {
  test.beforeEach(() => {
    const capability = evaluateCoreCapabilities(["registration-form"]);
    test.skip(!capability.enabled, capability.reason);
  });

  test(
    "CORE-5 | valida texto obrigatório, limite real, Unicode, trim e calendário",
    coreMutation,
    async ({ page, portalConfig, portalSession, proposalPage, proposalsPage }) => {
      const operation = await openDefaultProposal(
        portalConfig,
        portalSession,
        proposalsPage,
        proposalPage,
      );
      await proposalPage.tabs.select("Sobre Você");
      await proposalPage.getFieldByName("PESSOA.CO_ESTCIV").selectOption("2");

      try {
        await selectSpouseTab(proposalPage);
        const name = proposalPage.getFieldByName(spouseNameField);
        const birthDate = proposalPage.getFieldByName(spouseBirthField);
        const cpf = proposalPage.getFieldByName("CONJUGE.NU_CPFCNPJ");

        await name.fill("   ");
        await name.blur();
        await expect(name).toHaveValue("");
        await birthDate.fill("29022000");
        await page
          .getByRole("button", { name: "Confirmar e avançar cadastro" })
          .click();
        await expect(
          page
            .getByRole("alert")
            .filter({ hasText: /Cônjuge:.*Nome do Cônjuge/i }),
        ).toBeVisible();

        await selectSpouseTab(proposalPage);
        await expect(name).toHaveAttribute("maxlength", "40");
        await name.fill("A".repeat(40));
        await expect(name).toHaveValue("A".repeat(40));
        await name.fill("B".repeat(41));
        await expect(name).toHaveValue("B".repeat(40));

        const expectedName = "Áurea D'Ávila #1";
        await pasteValue(page, name, `  ${expectedName}`);
        await cpf.fill(deterministicCpf());
        await proposalPage.selectVisibleOption(
          "PESSOA.CO_REGIME_CASAMENTO",
          "Comunhão Parcial de Bens",
        );
        await birthDate.fill("29022000");
        await saveBySelectingTab(
          page,
          proposalPage,
          operation,
          "Motivo da Contratação",
        );
        await selectSpouseTab(proposalPage);
        await expect.soft(
          name,
          "O Portal deve remover espaços iniciais antes de persistir o nome.",
        ).toHaveValue(expectedName);

        for (const invalidDate of [
          "29022001",
          "31042000",
          "01012027",
          "010120",
        ]) {
          await expectInvalidSpouseDate(
            page,
            proposalPage,
            invalidDate,
          );
        }

        await selectSpouseTab(proposalPage);
        await pasteValue(page, birthDate, "29022000");
        await expect(birthDate).toHaveValue("29/02/2000");
        await page
          .getByRole("button", { name: "Confirmar e avançar cadastro" })
          .click();
        const validationText = await page
          .getByRole("alert")
          .filter({ hasText: "Ainda faltam campos obrigatórios" })
          .textContent();
        expect(validationText ?? "").not.toMatch(
          /Cônjuge:.*Data de Nascimento/i,
        );
      } finally {
        await restoreSpouse(page, proposalPage, operation);
      }
    },
  );

  test(
    "CORE-5 | normaliza caracteres, sinal, zero, decimal e paste no campo monetário",
    coreMutation,
    async ({ page, portalConfig, portalSession, proposalPage, proposalsPage }) => {
      await openDefaultProposal(
        portalConfig,
        portalSession,
        proposalsPage,
        proposalPage,
      );
      await proposalPage.tabs.select("Sobre Você");
      const income = proposalPage.getFieldByName("PESSOA.VA_RENDA_BRUTA");
      const originalValue = await income.inputValue();

      try {
        await pasteValue(page, income, "-100");
        await expect(income).toHaveValue("R$ 1,00");

        await pasteValue(page, income, "0");
        await expect(income).toHaveValue("R$ 0,00");

        await pasteValue(page, income, "123,45");
        await expect(income).toHaveValue("R$ 123,45");

        await pasteValue(page, income, "0000012345");
        await expect(income).toHaveValue("R$ 123,45");

        await pasteValue(page, income, "R$ abc # 123");
        await expect(income).toHaveValue("R$ 1,23");
        await expect(income).not.toHaveValue(/abc|#|-/i);
        await expect(income).not.toHaveAttribute("max");
        await expect(income).not.toHaveAttribute("maxlength");
      } finally {
        await income.fill(originalValue);
      }
    },
  );
});
