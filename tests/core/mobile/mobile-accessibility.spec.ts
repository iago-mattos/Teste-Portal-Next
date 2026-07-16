import { expect, test } from "../../fixtures/test";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import type { PortalSession } from "../../fixtures/portal.fixture";
import type { ProposalPage } from "../../pages/portal/proposal.page";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import type { ProposalsPage } from "../../pages/portal/proposals.page";
import type { Locator, Page } from "@playwright/test";
import { evaluateCoreCapabilities } from "../../config/core-capabilities";

const mobileCoreReadonly = { tag: ["@core", "@mobile", "@readonly"] };
const expectedViewport = { width: 412, height: 839 } as const;

function normalizeOperation(value: string): string {
  return value.replace(/\D/g, "").padStart(9, "0");
}

async function openOperation(
  operation: string,
  portalSession: PortalSession,
  proposalsPage: ProposalsPage,
  proposalPage?: ProposalPage,
): Promise<void> {
  await portalSession.useOperation(operation);
  await proposalsPage.open();
  await proposalsPage.loadAll();
  await proposalsPage.openProposal(operation);
  if (proposalPage) await proposalPage.waitUntilReady();
}

async function openDefaultProposal(
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  proposalsPage: ProposalsPage,
  proposalPage: ProposalPage,
): Promise<string> {
  const operation = normalizeOperation(
    portalConfig.testData.coreMasses.registration.operation,
  );
  await openOperation(operation, portalSession, proposalsPage, proposalPage);
  return operation;
}

async function expectNoGlobalHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(
    dimensions.documentClientWidth,
  );
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(
    dimensions.bodyClientWidth,
  );
}

async function expectInsideViewport(
  page: Page,
  locator: Locator,
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeInViewport();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).toEqual(expectedViewport);
  if (!box || !viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectActionNotCovered(locator: Locator): Promise<void> {
  const receivesPointerAtCenter = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const target = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    return Boolean(
      target &&
        (target === element || element.contains(target) || target.contains(element)),
    );
  });
  expect(receivesPointerAtCenter).toBe(true);
}

async function activeElementDescriptor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return "none";
    return [
      element.tagName,
      element.getAttribute("role") ?? "",
      element.getAttribute("name") ?? "",
      element.id,
      element.textContent?.trim().slice(0, 30) ?? "",
    ].join("|");
  });
}

async function focusByTab(
  page: Page,
  target: Locator,
  maximumTabs = 40,
): Promise<void> {
  await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    active?.blur();
  });
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error(`Controle não alcançado após ${maximumTabs} pressionamentos de Tab.`);
}

test.describe("Portal Core: mobile e acessibilidade", () => {
  test.beforeEach(async ({ page }) => {
    const capability = evaluateCoreCapabilities([
      "same-owner-registration-documents",
    ]);
    test.skip(!capability.enabled, capability.reason);
    expect(page.viewportSize()).toEqual(expectedViewport);
  });

  test(
    "CORE-6 | navega, usa formulário e combobox por toque e teclado no mobile",
    mobileCoreReadonly,
    async ({ page, portalConfig, portalSession, proposalPage, proposalsPage }) => {
      await openDefaultProposal(
        portalConfig,
        portalSession,
        proposalsPage,
        proposalPage,
      );

      await expectNoGlobalHorizontalOverflow(page);
      await expectInsideViewport(page, proposalPage.heading);
      for (const sectionName of [
        "Sobre Você",
        "Composição de Renda",
        "Motivo da Contratação",
        "Imóvel",
      ]) {
        await expect(
          page.getByRole("button", {
            name: new RegExp(`^${sectionName}(?:\\s|$)`),
          }),
        ).toBeVisible();
      }
      const personalDataSection = page.getByRole("button", {
        name: /^Sobre Você(?:\s|$)/,
      });
      await personalDataSection.click();

      const income = proposalPage.getFieldByName("PESSOA.VA_RENDA_BRUTA");
      await expectInsideViewport(page, income);
      await expect(income).toHaveAttribute("inputmode", "numeric");
      const incomeId = await income.getAttribute("id");
      expect(incomeId).toBeTruthy();
      const incomeLabel = page.locator(
        `label[for=${JSON.stringify(incomeId ?? "")}]`,
      );
      await expect(incomeLabel).toBeVisible();
      const exposesRequiredSemantics =
        (await income.getAttribute("required")) !== null ||
        (await income.getAttribute("aria-required")) === "true";
      expect.soft(
        exposesRequiredSemantics,
        "Campo obrigatório deve expor required ou aria-required além do asterisco visual.",
      ).toBe(true);

      const profession = proposalPage.getSearchableCombobox(
        "PESSOA.CO_PROFISSAO",
      );
      await profession.open();
      await expectInsideViewport(page, profession.listbox);
      await expect(profession.options.first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(profession.listbox).toBeHidden();

      const focusSequence: string[] = [];
      for (let index = 0; index < 4; index += 1) {
        await page.keyboard.press("Tab");
        const focused = page.locator(":focus");
        await expect(focused).toBeVisible();
        focusSequence.push(await activeElementDescriptor(page));
        if (index === 0) {
          expect(await focused.evaluate((element) => element.matches(":focus-visible"))).toBe(
            true,
          );
          const hasVisibleIndicator = await focused.evaluate((element) => {
            const style = getComputedStyle(element);
            return (
              (style.outlineStyle !== "none" &&
                Number.parseFloat(style.outlineWidth) > 0) ||
              style.boxShadow !== "none"
            );
          });
          expect.soft(
            hasVisibleIndicator,
            "Controle alcançado por Tab deve possuir indicador visual de foco.",
          ).toBe(true);
        }
      }
      expect(new Set(focusSequence).size).toBeGreaterThan(1);
      expect(focusSequence.every((descriptor) => !descriptor.startsWith("BODY|"))).toBe(
        true,
      );
    },
  );

  test(
    "CORE-6 | mantém ação, erro e modal utilizáveis dentro da viewport",
    mobileCoreReadonly,
    async ({ page, portalConfig, portalSession, proposalPage, proposalsPage }) => {
      await openDefaultProposal(
        portalConfig,
        portalSession,
        proposalsPage,
        proposalPage,
      );

      const confirmButton = page.getByRole("button", {
        name: "Confirmar",
        exact: true,
      });
      await expectInsideViewport(page, confirmButton);
      await expectActionNotCovered(confirmButton);
      await confirmButton.focus();
      await confirmButton.click();

      const dialog = proposalPage.getDialog("Revise o cadastro antes de concluir");
      await dialog.waitUntilVisible();
      await expectInsideViewport(page, dialog.root);
      await expect(
        dialog.root.getByText(/Faltam campos obrigatórios/i),
      ).toBeVisible();
      expect(
        await dialog.root.evaluate((root) => root.contains(document.activeElement)),
      ).toBe(true);

      await dialog.root.getByRole("button", { name: "Sobre Você" }).click();
      await expect(dialog.root).toBeHidden();
      const firstMissingFieldLabel = page.getByText(/^Estado Civil\s*\*$/).first();
      const firstErrorWasRevealed = await firstMissingFieldLabel.isVisible();
      expect.soft(
        firstErrorWasRevealed,
        "A ação da etapa no resumo deve revelar o primeiro campo obrigatório ausente.",
      ).toBe(true);
      if (firstErrorWasRevealed) {
        await expectInsideViewport(page, firstMissingFieldLabel);
      }

      await expectInsideViewport(page, confirmButton);
      await confirmButton.focus();
      await confirmButton.click();
      await dialog.waitUntilVisible();

      await page.keyboard.press("Escape");
      const closedWithEscape = await dialog.root
        .waitFor({ state: "hidden", timeout: 2_000 })
        .then(() => true)
        .catch(() => false);
      expect.soft(
        closedWithEscape,
        "O diálogo de validação deve aceitar Escape como interação modal padrão.",
      ).toBe(true);
      if (!closedWithEscape) await dialog.clickButton("Entendi");

      await expect(confirmButton).toBeFocused();
      await expectNoGlobalHorizontalOverflow(page);
    },
  );

  test(
    "CORE-6 | mantém lista e controle documental acessíveis no mobile",
    mobileCoreReadonly,
    async ({ page, portalConfig, portalSession, proposalsPage }) => {
      const operation = normalizeOperation(
        portalConfig.testData.coreMasses.documents.operation,
      );
      if (!operation.replace(/0/g, "")) {
        throw new Error(
          "Configure PORTAL_CORE_DOCUMENTS_OPERATION para o CORE-6.",
        );
      }

      await openOperation(operation, portalSession, proposalsPage);
      const documentsPage = new ProposalDocumentsPage(page);
      await documentsPage.waitUntilReady();
      await expectNoGlobalHorizontalOverflow(page);
      await expectInsideViewport(page, documentsPage.heading);

      const documentCount = await documentsPage.getDocumentCount();
      expect(documentCount).toBeGreaterThan(0);
      const firstUploadButton = documentsPage.getUploadButtonAt(0);
      await expect(firstUploadButton).toHaveAccessibleName(
        /Escolher arquivo|Enviar novamente/i,
      );
      await expectInsideViewport(page, firstUploadButton);
      await expectActionNotCovered(firstUploadButton);
      await focusByTab(page, firstUploadButton);
      await expect(firstUploadButton).toBeFocused();
      expect(
        await firstUploadButton.evaluate((element) =>
          element.matches(":focus-visible"),
        ),
      ).toBe(true);
    },
  );
});
