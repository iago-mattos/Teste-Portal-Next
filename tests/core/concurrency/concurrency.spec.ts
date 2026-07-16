import type { Locator, Page, Request, Route } from "@playwright/test";
import { expect, test } from "../../fixtures/test";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import { ProposalPage } from "../../pages/portal/proposal.page";
import type { ProposalsPage } from "../../pages/portal/proposals.page";

const coreMutation = { tag: ["@core", "@mutation"] };
const incomeFieldName = "PESSOA.VA_RENDA_BRUTA";

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function getCoreOperation(portalConfig: PortalRuntimeConfig): string {
  const operation = portalConfig.testData.corePersistenceOperation.trim();
  if (!operation) {
    throw new Error(
      "Configure PORTAL_CORE_PERSISTENCE_OPERATION com uma proposta mutavel, dedicada e restauravel.",
    );
  }
  return operation;
}

function isDraftSaveRequest(request: Request, operation: string): boolean {
  const url = new URL(request.url());
  return (
    request.method() === "PUT" &&
    url.pathname === `/api/portal/propostas/${operation}/cadastro`
  );
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
  await field.pressSequentially(value.replace(/\D/g, ""));
  return field.inputValue();
}

async function fulfillDraftSuccess(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, rascunho: true }),
  });
}

function draftStatus(page: Page, text: string | RegExp): Locator {
  const heading = page.getByRole("heading", {
    name: "Cadastro da Proposta",
    level: 2,
  });
  return heading.locator("..").getByText(text);
}

async function expectOnlyOneLogicalRequest(
  page: Page,
  operation: string,
  action: () => Promise<void>,
): Promise<void> {
  const release = deferred();
  const requestStarted = deferred();
  let requestCount = 0;

  await page.route("**/api/portal/propostas/*/cadastro", async (route) => {
    if (!isDraftSaveRequest(route.request(), operation)) {
      await route.fallback();
      return;
    }

    requestCount += 1;
    requestStarted.resolve();
    await release.promise;
    await fulfillDraftSuccess(route);
  });

  try {
    const responsePromise = page.waitForResponse((response) =>
      isDraftSaveRequest(response.request(), operation),
    );
    const actionPromise = action();
    await requestStarted.promise;

    await expect.soft(draftStatus(page, /Salvando/i)).toBeVisible();
    await expect.soft(
      draftStatus(page, "Rascunho salvo"),
      "não deve anunciar sucesso enquanto a request está pendente",
    ).toBeHidden();

    release.resolve();
    await actionPromise;
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(requestCount).toBe(1);
    await expect(draftStatus(page, /Salvando/i)).toBeHidden();
    await expect(draftStatus(page, "Rascunho salvo")).toBeVisible();
  } finally {
    release.resolve();
    await page.unroute("**/api/portal/propostas/*/cadastro");
  }
}

test.describe("Portal Core: concorrência e estados intermediários", () => {
  test(
    "CORE-2 | duplo clique durante save lento produz uma única ação lógica",
    coreMutation,
    async ({ page, portalConfig, proposalPage, proposalsPage }) => {
      const operation = getCoreOperation(portalConfig);
      await openCoreProposal(proposalsPage, proposalPage, operation);
      const income = proposalPage.getFieldByName(incomeFieldName);
      await replaceValue(income, "611122");

      const destination = proposalPage.tabs.getTabButton(
        "Composição de Renda",
      );
      await expectOnlyOneLogicalRequest(page, operation, async () => {
        await destination.dblclick();
      });

      await expect(destination).toHaveAttribute("aria-selected", "true");
    },
  );

  test(
    "CORE-2 | timeout libera a interface e uma nova tentativa gera nova request",
    coreMutation,
    async ({ page, portalConfig, proposalPage, proposalsPage }) => {
      const operation = getCoreOperation(portalConfig);
      await openCoreProposal(proposalsPage, proposalPage, operation);
      const income = proposalPage.getFieldByName(incomeFieldName);
      const typedValue = await replaceValue(income, "622233");
      const releaseFailure = deferred();
      const firstRequestStarted = deferred();
      let requestCount = 0;

      await page.route("**/api/portal/propostas/*/cadastro", async (route) => {
        if (!isDraftSaveRequest(route.request(), operation)) {
          await route.fallback();
          return;
        }

        requestCount += 1;
        if (requestCount === 1) {
          firstRequestStarted.resolve();
          await releaseFailure.promise;
          await route.abort("timedout");
          return;
        }
        await fulfillDraftSuccess(route);
      });

      try {
        const firstAction = proposalPage.tabs
          .getTabButton("Composição de Renda")
          .click();
        await firstRequestStarted.promise;

        await expect.soft(draftStatus(page, /Salvando/i)).toBeVisible();
        releaseFailure.resolve();
        await firstAction;

        await expect.soft(draftStatus(page, /Salvando/i)).toBeHidden();
        await expect.soft(
          page.getByText(/não foi possível salvar|falha ao salvar|tente novamente/i),
        ).toBeVisible();

        const composition = proposalPage.tabs.getTabButton(
          "Composição de Renda",
        );
        const retryDestination =
          (await composition.getAttribute("aria-selected")) === "true"
            ? proposalPage.tabs.getTabButton("Sobre Você")
            : composition;
        const retryResponsePromise = page.waitForResponse((response) =>
          isDraftSaveRequest(response.request(), operation),
        );
        await retryDestination.click();
        const retryResponse = await retryResponsePromise;

        expect(retryResponse.status()).toBe(200);
        expect(requestCount).toBe(2);
        await expect(draftStatus(page, "Rascunho salvo")).toBeVisible();

        const aboutYou = proposalPage.tabs.getTabButton("Sobre Você");
        if ((await aboutYou.getAttribute("aria-selected")) !== "true") {
          const returnResponsePromise = page.waitForResponse((response) =>
            isDraftSaveRequest(response.request(), operation),
          );
          await aboutYou.click();
          await returnResponsePromise;
        }
        await expect(proposalPage.getFieldByName(incomeFieldName)).toHaveValue(
          typedValue,
        );
      } finally {
        releaseFailure.resolve();
        await page.unroute("**/api/portal/propostas/*/cadastro");
      }
    },
  );

  test(
    "CORE-2 | refresh durante save pendente recupera a mesma proposta sem corrupção",
    coreMutation,
    async ({ page, portalConfig, proposalPage, proposalsPage }) => {
      const operation = getCoreOperation(portalConfig);
      await openCoreProposal(proposalsPage, proposalPage, operation);
      const originalValue = await proposalPage
        .getFieldByName(incomeFieldName)
        .inputValue();
      await replaceValue(
        proposalPage.getFieldByName(incomeFieldName),
        "633344",
      );

      const release = deferred();
      const saveStarted = deferred();
      const reloadStarted = deferred();
      let saveCount = 0;
      page.on("request", (request) => {
        if (
          request.isNavigationRequest() &&
          request.method() === "GET" &&
          new URL(request.url()).pathname === new URL(page.url()).pathname
        ) {
          reloadStarted.resolve();
        }
      });

      await page.route("**/api/portal/propostas/*/cadastro", async (route) => {
        if (!isDraftSaveRequest(route.request(), operation)) {
          await route.fallback();
          return;
        }
        saveCount += 1;
        saveStarted.resolve();
        await release.promise;
        try {
          await fulfillDraftSuccess(route);
        } catch {
          // O refresh pode cancelar a request no navegador antes do mock responder.
        }
      });

      try {
        const tabAction = proposalPage.tabs
          .getTabButton("Composição de Renda")
          .click()
          .catch(() => undefined);
        await saveStarted.promise;

        const reloadPromise = page.reload({ waitUntil: "domcontentloaded" });
        await reloadStarted.promise;
        release.resolve();
        await Promise.all([tabAction, reloadPromise]);

        await proposalPage.waitUntilReady();
        const headingOperation = (await proposalPage.heading.textContent())?.replace(
          /\D/g,
          "",
        );
        expect(Number(headingOperation)).toBe(Number(operation));
        expect(saveCount).toBe(1);
        await expect(proposalPage.tabs.root).toBeVisible();
        await expect(proposalPage.getFieldByName(incomeFieldName)).toHaveValue(
          originalValue,
        );
      } finally {
        release.resolve();
        await page.unroute("**/api/portal/propostas/*/cadastro");
      }
    },
  );

  test(
    "CORE-2 | duas páginas isolam edições e processam respostas fora de ordem",
    coreMutation,
    async ({ context, page, portalConfig, proposalPage, proposalsPage }) => {
      const operation = getCoreOperation(portalConfig);
      await openCoreProposal(proposalsPage, proposalPage, operation);

      const secondPage = await context.newPage();
      const secondProposalPage = new ProposalPage(secondPage);
      await secondPage.goto(page.url(), { waitUntil: "domcontentloaded" });
      await secondProposalPage.waitUntilReady();

      const firstRelease = deferred();
      const secondRelease = deferred();
      const firstStarted = deferred();
      const secondStarted = deferred();
      const completionOrder: string[] = [];
      let firstCount = 0;
      let secondCount = 0;

      const installControlledRoute = async (
        controlledPage: Page,
        label: "first" | "second",
        release: Deferred<void>,
        started: Deferred<void>,
      ): Promise<void> => {
        await controlledPage.route(
          "**/api/portal/propostas/*/cadastro",
          async (route) => {
            if (!isDraftSaveRequest(route.request(), operation)) {
              await route.fallback();
              return;
            }

            if (label === "first") firstCount += 1;
            else secondCount += 1;
            started.resolve();
            await release.promise;
            await fulfillDraftSuccess(route);
            completionOrder.push(label);
          },
        );
      };

      try {
        await installControlledRoute(
          page,
          "first",
          firstRelease,
          firstStarted,
        );
        await installControlledRoute(
          secondPage,
          "second",
          secondRelease,
          secondStarted,
        );

        const firstValue = await replaceValue(
          proposalPage.getFieldByName(incomeFieldName),
          "644455",
        );
        const secondValue = await replaceValue(
          secondProposalPage.getFieldByName(incomeFieldName),
          "655566",
        );

        const firstAction = proposalPage.tabs
          .getTabButton("Composição de Renda")
          .click();
        const secondAction = secondProposalPage.tabs
          .getTabButton("Composição de Renda")
          .click();
        await Promise.all([firstStarted.promise, secondStarted.promise]);

        secondRelease.resolve();
        await secondAction;
        firstRelease.resolve();
        await firstAction;

        await expect
          .poll(() => completionOrder.join(","))
          .toBe("second,first");
        expect(firstCount).toBe(1);
        expect(secondCount).toBe(1);

        await page.unroute("**/api/portal/propostas/*/cadastro");
        await secondPage.unroute("**/api/portal/propostas/*/cadastro");

        // A rede controlada prova isolamento de estado sem persistir os valores.
        await page.route("**/api/portal/propostas/*/cadastro", fulfillDraftSuccess);
        await secondPage.route(
          "**/api/portal/propostas/*/cadastro",
          fulfillDraftSuccess,
        );
        await Promise.all([
          proposalPage.tabs.getTabButton("Sobre Você").click(),
          secondProposalPage.tabs.getTabButton("Sobre Você").click(),
        ]);
        await expect(proposalPage.getFieldByName(incomeFieldName)).toHaveValue(
          firstValue,
        );
        await expect(
          secondProposalPage.getFieldByName(incomeFieldName),
        ).toHaveValue(secondValue);
      } finally {
        firstRelease.resolve();
        secondRelease.resolve();
        await page.unroute("**/api/portal/propostas/*/cadastro");
        await secondPage.unroute("**/api/portal/propostas/*/cadastro");
        await secondPage.close();
      }
    },
  );
});
