import type { Locator, Page, Request, Response, Route } from "@playwright/test";
import { expect, test } from "../../fixtures/test";
import type { ProposalPage } from "../../pages/portal/proposal.page";
import type { ProposalsPage } from "../../pages/portal/proposals.page";
import type { PortalRuntimeConfig } from "../../config/runtime-config";

const coreMutation = { tag: ["@core", "@mutation"] };
const cepPath = "/api/portal/cep";
const addressFields = {
  cep: "PESSOA.NU_CEP",
  street: "PESSOA.NO_ENDERECO",
  number: "PESSOA.NU_APTO",
  complement: "PESSOA.NO_COMPLEMENTO",
  district: "PESSOA.NO_BAIRRO",
  state: "PESSOA.CO_UF",
  city: "PESSOA.CO_MUNICIPIO",
} as const;

function draftPath(operation: string): string {
  return `/api/portal/propostas/${operation}/cadastro`;
}

function isCepRequest(request: Request, cep?: string): boolean {
  const url = new URL(request.url());
  return (
    request.method() === "GET" &&
    url.pathname === cepPath &&
    (cep === undefined || url.searchParams.get("cep") === cep)
  );
}

async function openDefaultProposal(
  portalConfig: PortalRuntimeConfig,
  proposalsPage: ProposalsPage,
  proposalPage: ProposalPage,
): Promise<string> {
  const operation = portalConfig.testData.expectedProposal.visibleNumber;
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
  payloadPredicate?: (postData: string) => boolean,
): Promise<Response> {
  if (payloadPredicate) {
    const requestPromise = page.waitForRequest(
      (request) => {
        if (
          request.method() !== "PUT" ||
          new URL(request.url()).pathname !== draftPath(operation)
        ) {
          return false;
        }
        const postData = request.postData();
        if (!postData) return false;
        return payloadPredicate(postData);
      },
      { timeout: 30_000 },
    );
    await proposalPage.tabs.select(tabName);
    const request = await requestPromise;
    const response = await request.response();
    expect(response, "O PUT de cadastro deve produzir resposta.").not.toBeNull();
    expect(response?.ok()).toBe(true);
    return response as Response;
  }

  const responsePromise = page.waitForResponse(
    (response) => {
      if (
        response.request().method() !== "PUT" ||
        new URL(response.url()).pathname !== draftPath(operation)
      ) {
        return false;
      }
      return true;
    },
  );
  await proposalPage.tabs.select(tabName);
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  return response;
}

function serializedField(name: string, value: string): string {
  return `${JSON.stringify(name)}:${JSON.stringify(value)}`;
}

async function openGuarantorPf(
  page: Page,
  proposalPage: ProposalPage,
  operation: string,
): Promise<string> {
  await proposalPage.tabs.select("Imóvel");
  const condition = proposalPage.getFieldByName(
    "IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL",
  );
  const originalCondition = await condition.inputValue();
  if (!["3", "4"].includes(originalCondition)) {
    await condition.selectOption("3");
    await saveBySelectingTab(page, proposalPage, operation, "Sobre Você");
  }
  await proposalPage.tabs.select("Garantidor");
  await expect(proposalPage.getFieldByName(addressFields.cep)).toBeVisible();
  return originalCondition;
}

async function clearGuarantorAddress(proposalPage: ProposalPage): Promise<void> {
  for (const fieldName of [
    addressFields.cep,
    addressFields.street,
    addressFields.number,
    addressFields.complement,
    addressFields.district,
  ]) {
    const field = proposalPage.getFieldByName(fieldName);
    if (await field.isVisible()) await field.clear();
  }
  await proposalPage.getSearchableCombobox(addressFields.state).input.clear();
}

async function restoreGuarantor(
  page: Page,
  proposalPage: ProposalPage,
  operation: string,
  originalCondition: string,
): Promise<void> {
  await proposalPage.tabs.select("Garantidor");
  await clearGuarantorAddress(proposalPage);
  await saveBySelectingTab(page, proposalPage, operation, "Imóvel");
  const condition = proposalPage.getFieldByName(
    "IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL",
  );
  if ((await condition.inputValue()) !== originalCondition) {
    await condition.selectOption(originalCondition);
    await saveBySelectingTab(page, proposalPage, operation, "Sobre Você");
  }
}

async function queryCep(
  page: Page,
  cepField: Locator,
  cep: string,
): Promise<Response> {
  const responsePromise = page.waitForResponse((response) =>
    isCepRequest(response.request(), cep),
  );
  await cepField.clear();
  await cepField.fill(cep);
  await cepField.blur();
  return responsePromise;
}

function cepError(page: Page): Locator {
  return page.getByText(
    /CEP (?:não encontrado|inválido)|Não foi possível (?:consultar|buscar).*CEP|Falha.*CEP/i,
  );
}

async function fulfillCep(
  route: Route,
  body: Readonly<Record<string, string>>,
): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.describe("Portal Core: CEP e contrato frontend → API", () => {
  test.beforeEach(() => {
    test.skip(
      process.env.PW_PROFILE !== "esteira-ht",
      "CORE-5 usa a massa reutilizável da EsteiraHT.",
    );
  });

  test(
    "CORE-5 | valida CEP inválido, indisponibilidade e resposta incompleta",
    coreMutation,
    async ({ page, portalConfig, proposalPage, proposalsPage }) => {
      const operation = await openDefaultProposal(
        portalConfig,
        proposalsPage,
        proposalPage,
      );
      const originalCondition = await openGuarantorPf(
        page,
        proposalPage,
        operation,
      );
      const cep = proposalPage.getFieldByName(addressFields.cep);
      const street = proposalPage.getFieldByName(addressFields.street);
      const district = proposalPage.getFieldByName(addressFields.district);
      let cepRequests = 0;
      const countCep = (request: Request) => {
        if (isCepRequest(request)) cepRequests += 1;
      };
      page.on("request", countCep);

      try {
        await cep.fill("abc");
        await cep.blur();
        await expect(cep).toHaveValue("");
        expect(cepRequests).toBe(0);

        await cep.fill("01001");
        await cep.blur();
        await expect(cep).toHaveValue("01001");
        expect(cepRequests).toBe(0);

        const nonexistent = await queryCep(page, cep, "00000000");
        expect(nonexistent.status()).toBe(200);
        await expect(street).toHaveValue("");
        await expect(district).toHaveValue("");
        await expect.soft(
          cepError(page),
          "CEP inexistente deve produzir feedback explícito ao usuário.",
        ).toBeVisible({ timeout: 2_000 });

        await page.route("**/api/portal/cep?**", async (route) => {
          const url = new URL(route.request().url());
          if (url.searchParams.get("cep") === "99999999") {
            await route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({ message: "Falha controlada na consulta" }),
            });
            return;
          }
          if (url.searchParams.get("cep") === "88888888") {
            await fulfillCep(route, {
              "PESSOA.NO_ENDERECO": "Rua Parcial Core",
            });
            return;
          }
          await route.fallback();
        });

        const failed = await queryCep(page, cep, "99999999");
        expect(failed.status()).toBe(500);
        await expect(street).toHaveValue("");
        await expect.soft(
          cepError(page),
          "Falha do serviço de CEP deve produzir feedback explícito ao usuário.",
        ).toBeVisible({ timeout: 2_000 });

        const partial = await queryCep(page, cep, "88888888");
        expect(partial.status()).toBe(200);
        await expect(street).toHaveValue("Rua Parcial Core");
        await expect(district).toHaveValue("");
        await expect(
          proposalPage.getSearchableCombobox(addressFields.state).input,
        ).toHaveValue("");
      } finally {
        page.off("request", countCep);
        await page.unroute("**/api/portal/cep?**");
        await restoreGuarantor(
          page,
          proposalPage,
          operation,
          originalCondition,
        );
      }
    },
  );

  test(
    "CORE-5 | troca CEP durante consulta lenta sem aplicar resposta antiga",
    coreMutation,
    async ({ page, portalConfig, proposalPage, proposalsPage }) => {
      const operation = await openDefaultProposal(
        portalConfig,
        proposalsPage,
        proposalPage,
      );
      const originalCondition = await openGuarantorPf(
        page,
        proposalPage,
        operation,
      );
      const cep = proposalPage.getFieldByName(addressFields.cep);
      const street = proposalPage.getFieldByName(addressFields.street);
      const district = proposalPage.getFieldByName(addressFields.district);
      const number = proposalPage.getFieldByName(addressFields.number);
      let releaseFirst: (() => void) | undefined;
      let markFirstSeen: (() => void) | undefined;
      const firstSeen = new Promise<void>((resolve) => {
        markFirstSeen = resolve;
      });
      const releaseFirstResponse = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      const cepA = "11111111";
      const cepB = "22222222";
      const responseA = {
        "PESSOA.NO_ENDERECO": "Rua Antiga Core",
        "PESSOA.CO_MUNICIPIO": "2840",
        "PESSOA.NU_MUNICIPIO": "2840",
        "PESSOA.NO_BAIRRO": "Bairro Antigo",
        "PESSOA.CO_UF": "SP",
      };
      const responseB = {
        "PESSOA.NO_ENDERECO": "Rua Atual Core",
        "PESSOA.CO_MUNICIPIO": "2840",
        "PESSOA.NU_MUNICIPIO": "2840",
        "PESSOA.NO_BAIRRO": "Bairro Atual",
        "PESSOA.CO_UF": "SP",
      };

      try {
        await page.route("**/api/portal/cep?**", async (route) => {
          const requestedCep = new URL(route.request().url()).searchParams.get(
            "cep",
          );
          if (requestedCep === cepA) {
            markFirstSeen?.();
            await releaseFirstResponse;
            await fulfillCep(route, responseA);
            return;
          }
          if (requestedCep === cepB) {
            await fulfillCep(route, responseB);
            return;
          }
          await route.fallback();
        });

        const firstResponsePromise = page.waitForResponse((response) =>
          isCepRequest(response.request(), cepA),
          { timeout: 30_000 },
        );
        await cep.clear();
        await cep.fill(cepA);
        await cep.blur();
        await firstSeen;
        await expect(street).toHaveValue("");
        await expect(cep).toBeEnabled();
        await number.fill("101");

        await cep.clear();
        await cep.fill(cepB);
        await cep.blur();
        const secondResponsePromise = page.waitForResponse(
          (response) => isCepRequest(response.request(), cepB),
          { timeout: 30_000 },
        );
        releaseFirst?.();
        await firstResponsePromise;
        await expect.soft(
          street,
          "Resposta atrasada do CEP anterior não pode sobrescrever o CEP atual.",
        ).not.toHaveValue(responseA["PESSOA.NO_ENDERECO"]);

        await cep.focus();
        await cep.blur();
        const secondResponse = await secondResponsePromise;
        expect(secondResponse.status()).toBe(200);
        await expect.soft
          .poll(
            () => street.inputValue(),
            "O endereço deve refletir o último CEP informado.",
          )
          .toBe(responseB["PESSOA.NO_ENDERECO"]);
        await expect.soft(district).toHaveValue(
          responseB["PESSOA.NO_BAIRRO"],
        );
        await expect(number).toHaveValue("101");
      } finally {
        releaseFirst?.();
        await page.unroute("**/api/portal/cep?**");
        await restoreGuarantor(
          page,
          proposalPage,
          operation,
          originalCondition,
        );
      }
    },
  );

  test(
    "CORE-5 | envia false e não reutiliza valor removido no payload real",
    coreMutation,
    async ({ page, portalConfig, proposalPage, proposalsPage }) => {
      const operation = await openDefaultProposal(
        portalConfig,
        proposalsPage,
        proposalPage,
      );
      const descriptionField =
        "OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO";
      const marker =
        "Marcador Core temporário confirma remoção sem reutilizar conteúdo anterior no payload";
      let originalDescription = "";
      let descriptionCaptured = false;
      let originalComposesIncome = false;

      try {
        await proposalPage.tabs.select("Composição de Renda");
        const panel = page.getByRole("tabpanel", {
          name: "Composição de Renda",
        });
        const yes = panel.getByRole("radio", { name: "Sim", exact: true });
        const no = panel.getByRole("radio", { name: "Não", exact: true });
        originalComposesIncome = await yes.isChecked();

        await yes.check();
        await expect(yes).toBeChecked();
        await no.check();
        await expect(no).toBeChecked();
        const falseResponse = await saveBySelectingTab(
          page,
          proposalPage,
          operation,
          "Motivo da Contratação",
          (postData) =>
            postData.includes(
              serializedField("PESSOA.IN_COMPOE_RENDA", "F"),
            ),
        );
        expect(falseResponse.request().postData()).toContain(
          serializedField("PESSOA.IN_COMPOE_RENDA", "F"),
        );

        await page.reload({ waitUntil: "domcontentloaded" });
        await proposalPage.waitUntilReady();
        await proposalPage.tabs.select("Composição de Renda");
        await expect(
          page
            .getByRole("tabpanel", { name: "Composição de Renda" })
            .getByRole("radio", { name: "Não", exact: true }),
        ).toBeChecked();
        await proposalPage.tabs.select("Motivo da Contratação");

        const description = proposalPage.getFieldByName(descriptionField);
        originalDescription = await description.inputValue();
        descriptionCaptured = true;
        await description.fill(marker);
        const filledResponse = await saveBySelectingTab(
          page,
          proposalPage,
          operation,
          "Imóvel",
          (postData) =>
            postData.includes(serializedField(descriptionField, marker)),
        );
        expect(filledResponse.request().postData()).toContain(
          serializedField(descriptionField, marker),
        );

        await proposalPage.tabs.select("Motivo da Contratação");
        await proposalPage.getFieldByName(descriptionField).clear();
        const clearedResponse = await saveBySelectingTab(
          page,
          proposalPage,
          operation,
          "Imóvel",
          (postData) =>
            postData.includes(serializedField(descriptionField, "")),
        );
        const clearedPayload = clearedResponse.request().postData() ?? "";
        expect(clearedPayload).toContain(serializedField(descriptionField, ""));
        expect(clearedPayload).not.toContain(marker);

        await page.reload({ waitUntil: "domcontentloaded" });
        await proposalPage.waitUntilReady();
        await proposalPage.tabs.select("Motivo da Contratação");
        await expect(proposalPage.getFieldByName(descriptionField)).toHaveValue(
          "",
        );
      } finally {
        if (descriptionCaptured) {
          await proposalPage.tabs.select("Motivo da Contratação");
          await proposalPage
            .getFieldByName(descriptionField)
            .fill(originalDescription);
          await saveBySelectingTab(
            page,
            proposalPage,
            operation,
            "Imóvel",
          );
        }

        await proposalPage.tabs.select("Composição de Renda");
        const restorePanel = page.getByRole("tabpanel", {
          name: "Composição de Renda",
        });
        await restorePanel
          .getByRole("radio", {
            name: originalComposesIncome ? "Sim" : "Não",
            exact: true,
          })
          .check();
        await saveBySelectingTab(
          page,
          proposalPage,
          operation,
          "Motivo da Contratação",
        );
      }
    },
  );

  test(
    "CORE imediato | persiste endereço válido com complemento opcional vazio",
    coreMutation,
    async ({ page, portalConfig, proposalPage, proposalsPage }) => {
      const operation = await openDefaultProposal(
        portalConfig,
        proposalsPage,
        proposalPage,
      );
      const originalCondition = await openGuarantorPf(
        page,
        proposalPage,
        operation,
      );
      const cep = proposalPage.getFieldByName(addressFields.cep);
      const street = proposalPage.getFieldByName(addressFields.street);
      const number = proposalPage.getFieldByName(addressFields.number);
      const complement = proposalPage.getFieldByName(addressFields.complement);
      const district = proposalPage.getFieldByName(addressFields.district);
      const state = proposalPage.getSearchableCombobox(addressFields.state).input;
      const city = proposalPage.getSearchableCombobox(addressFields.city).input;
      const validCep = "01001000";

      try {
        await clearGuarantorAddress(proposalPage);
        const cepResponse = await queryCep(page, cep, validCep);
        expect(cepResponse.ok()).toBe(true);
        await expect.poll(() => street.inputValue()).not.toBe("");
        await expect.poll(() => district.inputValue()).not.toBe("");
        await expect.poll(() => state.inputValue()).not.toBe("");
        await expect.poll(() => city.inputValue()).not.toBe("");

        await number.fill("100");
        await complement.clear();
        const expected = {
          cep: await cep.inputValue(),
          street: await street.inputValue(),
          number: await number.inputValue(),
          district: await district.inputValue(),
          state: await state.inputValue(),
          city: await city.inputValue(),
        };

        const response = await saveBySelectingTab(
          page,
          proposalPage,
          operation,
          "Imóvel",
          (postData) =>
            postData.includes(
              serializedField(addressFields.complement, ""),
            ) &&
            postData.includes(expected.street),
        );
        expect(response.ok()).toBe(true);

        await page.reload({ waitUntil: "domcontentloaded" });
        await proposalPage.waitUntilReady();
        await proposalPage.tabs.select("Garantidor");
        await expect(proposalPage.getFieldByName(addressFields.cep)).toHaveValue(
          expected.cep,
        );
        await expect(
          proposalPage.getFieldByName(addressFields.street),
        ).toHaveValue(expected.street);
        await expect(
          proposalPage.getFieldByName(addressFields.number),
        ).toHaveValue(expected.number);
        await expect(
          proposalPage.getFieldByName(addressFields.complement),
        ).toHaveValue("");
        await expect(
          proposalPage.getFieldByName(addressFields.district),
        ).toHaveValue(expected.district);
        await expect(
          proposalPage.getSearchableCombobox(addressFields.state).input,
        ).toHaveValue(expected.state);
        await expect(
          proposalPage.getSearchableCombobox(addressFields.city).input,
        ).toHaveValue(expected.city);
      } finally {
        await restoreGuarantor(
          page,
          proposalPage,
          operation,
          originalCondition,
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await proposalPage.waitUntilReady();
        await proposalPage.tabs.select("Imóvel");
        await expect(
          proposalPage.getFieldByName(
            "IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL",
          ),
        ).toHaveValue(originalCondition);
      }
    },
  );
});
