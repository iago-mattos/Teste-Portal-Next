import { expect, type Page, type Response } from "@playwright/test";
import { loadCoreMassProvisioningConfig } from "../config/core-mass-config";
import { test } from "../fixtures/test";
import { ProposalDocumentsPage } from "../pages/portal/proposal-documents.page";
import type { ProposalPage } from "../pages/portal/proposal.page";
import { ProposalRegistrationPage } from "../pages/portal/proposal-registration.page";
import type { PortalSession } from "../fixtures/test";
import { getWorkflowPreparationTemplate } from "../test-data/integration-data";

const provisioningMutation = { tag: ["@provisioning", "@mutation"] };
const purposeFieldName = "OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO";

test.use({ skipPortalSessionBootstrap: true });

async function expectSuccessfulSave(response: Response): Promise<void> {
  expect(response.status()).toBe(200);
}

async function prepareUntilFinalConfirmation(
  operationNumber: string,
  portalSession: PortalSession,
  proposalPage: ProposalPage,
  registrationPage: ProposalRegistrationPage,
): Promise<void> {
  const preparation = getWorkflowPreparationTemplate();
  await portalSession.useOperation(operationNumber);
  await proposalPage.open(operationNumber);

  await expectSuccessfulSave(
    await registrationPage.fillApplicantAndAdvance(
      operationNumber,
      preparation,
    ),
  );
  await expectSuccessfulSave(
    await registrationPage.setNoIncomeCompositionAndAdvance(operationNumber),
  );
  await expectSuccessfulSave(
    await registrationPage.fillCreditPurposeAndAdvance(
      operationNumber,
      preparation,
    ),
  );
  await registrationPage.fillProperty(operationNumber, preparation);
}

async function provePreFinalizationState(
  operationNumber: string,
  proposalPage: ProposalPage,
  registrationPage: ProposalRegistrationPage,
): Promise<void> {
  await expectSuccessfulSave(
    await registrationPage.persistPropertyWithoutFinalizing(operationNumber),
  );
  await proposalPage.open(operationNumber);
  await proposalPage.tabs.select("Imóvel");
  await registrationPage.expectReadyForFinalConfirmation();
}

async function expectEmptyDocumentSlots(
  page: Page,
  operationNumber: string,
): Promise<void> {
  const documentsPage = new ProposalDocumentsPage(page);
  await page.goto(`/propostas/${operationNumber}`);
  await documentsPage.waitUntilReady();
  expect(await documentsPage.getDocumentCount()).toBeGreaterThanOrEqual(2);

  for (const index of [0, 1]) {
    const row = documentsPage.getDocumentRowAt(index);
    await expect(row.getByText("Documento enviado", { exact: true })).toHaveCount(0);
    await expect(
      row.getByRole("link", { name: "Ver arquivo", exact: true }),
    ).toHaveCount(0);
    await expect(documentsPage.getUploadButtonAt(index)).toBeVisible();
  }
}

async function savePurposeDescription(
  page: Page,
  proposalPage: ProposalPage,
  operationNumber: string,
  value: string,
): Promise<Response> {
  await proposalPage.tabs.select("Motivo da Contratação");
  await page.waitForLoadState("networkidle");
  const field = proposalPage.getVisibleFieldByName(purposeFieldName);
  await expect(field).toBeVisible();
  await field.fill(value);
  await field.blur();
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    if (
      response.request().method() !== "PUT"
      || url.pathname !== `/api/portal/propostas/${operationNumber}/cadastro`
    ) {
      return false;
    }

    const payload = response.request().postDataJSON() as {
      campos?: Record<string, unknown>;
    } | null;
    return payload?.campos?.[purposeFieldName] === value;
  });
  await proposalPage.tabs.select("Imóvel");
  const response = await responsePromise;
  await page.waitForLoadState("networkidle");
  return response;
}

async function expectPersistedPurposeDescription(
  proposalPage: ProposalPage,
  operationNumber: string,
  expected: string,
): Promise<void> {
  await proposalPage.open(operationNumber);
  await proposalPage.tabs.select("Motivo da Contratação");
  await expect(proposalPage.getVisibleFieldByName(purposeFieldName)).toHaveValue(
    expected,
  );
}

async function qualifyRestorableCadastroMass(
  page: Page,
  proposalPage: ProposalPage,
  operationNumber: string,
  marker: string,
): Promise<void> {
  const original = getWorkflowPreparationTemplate().creditPurpose.description;

  try {
    await expectSuccessfulSave(
      await savePurposeDescription(
        page,
        proposalPage,
        operationNumber,
        marker,
      ),
    );
    await expectPersistedPurposeDescription(
      proposalPage,
      operationNumber,
      marker,
    );
  } finally {
    await expectSuccessfulSave(
      await savePurposeDescription(
        page,
        proposalPage,
        operationNumber,
        original,
      ),
    );
    await expectPersistedPurposeDescription(
      proposalPage,
      operationNumber,
      original,
    );
  }
}

for (const slot of ["documentA", "documentB"] as const) {
  test(
    `provisiona ${slot === "documentA" ? "DOC A" : "DOC B"} em Documentos com slots vazios`,
    provisioningMutation,
    async ({ page, portalConfig, portalSession, proposalPage }) => {
      const mass = loadCoreMassProvisioningConfig(portalConfig)[slot];
      const registrationPage = new ProposalRegistrationPage(page, proposalPage);

      await prepareUntilFinalConfirmation(
        mass.operationNumber,
        portalSession,
        proposalPage,
        registrationPage,
      );
      const { saveResponse, finalizeResponse } = await registrationPage.finalize(
        mass.operationNumber,
      );
      await expectSuccessfulSave(saveResponse);
      expect(finalizeResponse.status()).toBe(200);
      await expect(finalizeResponse.json()).resolves.toMatchObject({
        sucesso: true,
      });
      await expectEmptyDocumentSlots(page, mass.operationNumber);
    },
  );
}

test(
  "provisiona FINAL imediatamente antes da confirmação",
  provisioningMutation,
  async ({ page, portalConfig, portalSession, proposalPage }) => {
    const mass = loadCoreMassProvisioningConfig(portalConfig).finalization;
    const registrationPage = new ProposalRegistrationPage(page, proposalPage);

    await prepareUntilFinalConfirmation(
      mass.operationNumber,
      portalSession,
      proposalPage,
      registrationPage,
    );
    await provePreFinalizationState(
      mass.operationNumber,
      proposalPage,
      registrationPage,
    );
  },
);

for (const slot of ["cadastroA", "cadastroB"] as const) {
  test(
    `provisiona e qualifica ${slot === "cadastroA" ? "CAD A" : "CAD B"} como restaurável`,
    provisioningMutation,
    async ({ page, portalConfig, portalSession, proposalPage }) => {
      const mass = loadCoreMassProvisioningConfig(portalConfig)[slot];
      const registrationPage = new ProposalRegistrationPage(page, proposalPage);

      await prepareUntilFinalConfirmation(
        mass.operationNumber,
        portalSession,
        proposalPage,
        registrationPage,
      );
      await provePreFinalizationState(
        mass.operationNumber,
        proposalPage,
        registrationPage,
      );
      await qualifyRestorableCadastroMass(
        page,
        proposalPage,
        mass.operationNumber,
        slot === "cadastroA"
          ? "CORE RESTORE A - MARCADOR TEMPORARIO"
          : "CORE RESTORE B - MARCADOR TEMPORARIO",
      );
    },
  );
}
