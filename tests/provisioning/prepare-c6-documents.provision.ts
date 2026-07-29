import type { TestInfo } from "@playwright/test";
import { test, expect } from "../fixtures/test";
import { renewPortalSession } from "../fixtures/auth.fixture";
import { ProposalDocumentsPage } from "../pages/portal/proposal-documents.page";
import { ProposalRegistrationPage } from "../pages/portal/proposal-registration.page";
import {
  getGeneratedSimulationForSlot,
  markGeneratedSimulationReady,
  markGeneratedSimulationRejected,
  type GeneratedSimulationEntry,
} from "../services/generated-simulation-registry";
import { getProvisioningSlot } from "../test-data/provisioning-data";
import { getWorkflowPreparationTemplate } from "../test-data/integration-data";
import {
  PROVISIONING_SLOT_IDS,
  type ProvisioningSlotId,
} from "../types/provisioning";

test.use({ skipPortalSessionBootstrap: true });

function resolveDocumentSlot(): ProvisioningSlotId {
  const value = process.env.PORTAL_PROVISION_SLOT?.trim().toUpperCase();
  if (!value || !PROVISIONING_SLOT_IDS.includes(value as ProvisioningSlotId)) {
    throw new Error("Defina PORTAL_PROVISION_SLOT com um slot válido.");
  }

  const slotId = value as ProvisioningSlotId;
  const slot = getProvisioningSlot(slotId);
  if (slot.stateOwner !== "c6-document-preparation") {
    throw new Error(`${slotId} não possui preparação documental C6 configurada.`);
  }
  return slotId;
}

function assertC6HtTarget(): void {
  const profile = process.env.PW_PROFILE?.trim().toLowerCase();
  const portalHost = new URL(process.env.PORTAL_URL ?? "").host;

  if (
    profile !== "ht" ||
    portalHost !== "minhaproposta-dev.prognum.com.br" ||
    process.env.PORTAL_PROVISION_PROVIDER !== "c6"
  ) {
    throw new Error(
      "Preparação documental bloqueada: use exclusivamente o Portal C6 HT.",
    );
  }
}

async function attachEntry(
  testInfo: TestInfo,
  entry: GeneratedSimulationEntry,
): Promise<void> {
  await testInfo.attach("c6-document-preparation", {
    body: Buffer.from(JSON.stringify(entry, null, 2)),
    contentType: "application/json",
  });
}

test(
  "C6 HT | confirma a proposta e comprova a etapa Documentos",
  { tag: ["@provisioning", "@mutation"] },
  async ({ page, portalConfig, proposalPage }, testInfo) => {
    assertC6HtTarget();
    const slotId = resolveDocumentSlot();
    let entry = await getGeneratedSimulationForSlot(slotId);
    if (!entry?.protocol) {
      throw new Error(
        `${slotId} precisa ser criado pelo provisionador-base antes da preparação documental.`,
      );
    }

    try {
      const operationNumber = entry.protocol;
      const proposalUrl = new URL(
        `/propostas/${operationNumber}`,
        portalConfig.portalUrl,
      ).toString();
      const documentsPage = new ProposalDocumentsPage(page);
      const registrationPage = new ProposalRegistrationPage(
        page,
        proposalPage,
      );

      await renewPortalSession(page.context(), portalConfig, {
        cpf: entry.applicant.cpfDigits,
        persist: false,
      });
      await page.goto(proposalUrl);
      const alreadyInDocuments = await Promise.race([
        documentsPage.heading
          .waitFor({ state: "visible", timeout: 30_000 })
          .then(() => true),
        proposalPage.tabs.root
          .waitFor({ state: "visible", timeout: 30_000 })
          .then(() => false),
      ]);

      if (!alreadyInDocuments) {
        const preparation = getWorkflowPreparationTemplate();
        await proposalPage.waitUntilReady();

        await test.step("preenche o cadastro sem composição ou garantidor", async () => {
          expect(
            (
              await registrationPage.fillApplicantAndAdvance(
                operationNumber,
                preparation,
              )
            ).status(),
          ).toBe(200);
          expect(
            (
              await registrationPage.setNoIncomeCompositionAndAdvance(
                operationNumber,
              )
            ).status(),
          ).toBe(200);
          expect(
            (
              await registrationPage.fillCreditPurposeAndAdvance(
                operationNumber,
                preparation,
              )
            ).status(),
          ).toBe(200);
          await registrationPage.fillProperty(operationNumber, preparation);
        });

        await test.step("confirma na aba Imóvel e avança para Documentos", async () => {
          const { saveResponse, finalizeResponse } =
            await registrationPage.finalize(operationNumber);
          expect(saveResponse.status()).toBe(200);
          expect(finalizeResponse.status()).toBe(200);
          await expect(finalizeResponse.json()).resolves.toMatchObject({
            sucesso: true,
          });
        });
      }

      await test.step("reabre e comprova todos os slots documentais vazios", async () => {
        await page.goto(proposalUrl);
        await documentsPage.waitUntilReady();
        const displayedOperation = operationNumber.replace(/^0+(?=\d)/, "");
        await expect(page).toHaveURL((url) =>
          [
            `/propostas/${operationNumber}`,
            `/propostas/${displayedOperation}`,
          ].includes(url.pathname),
        );

        const documentCount = await documentsPage.getDocumentCount();
        expect(documentCount).toBeGreaterThan(0);
        for (let index = 0; index < documentCount; index += 1) {
          const row = documentsPage.getDocumentRowAt(index);
          await expect(
            row.getByText("Documento enviado", { exact: true }),
          ).toHaveCount(0);
          await expect(
            row.getByRole("link", { name: "Ver arquivo", exact: true }),
          ).toHaveCount(0);
          await expect(documentsPage.getUploadButtonAt(index)).toBeVisible();
        }
      });

      entry = await markGeneratedSimulationReady(entry.id);
      await attachEntry(testInfo, entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      entry = await markGeneratedSimulationRejected(entry.id, message);
      await attachEntry(testInfo, entry);
      throw error;
    }
  },
);
