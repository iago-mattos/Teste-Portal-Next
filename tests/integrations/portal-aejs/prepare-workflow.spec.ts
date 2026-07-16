import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/test";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import { ProposalRegistrationPage } from "../../pages/portal/proposal-registration.page";
import {
  getIntegrationDocumentScenario,
  getIntegrationPreparationScenario,
} from "../../test-data/integration-data";

const integrationMutation = { tag: ["@integration", "@mutation"] };
test.use({ skipPortalSessionBootstrap: true });

interface DocumentSubmissionResult {
  readonly sucesso?: boolean;
  readonly mensagem?: string;
}

test.describe.configure({ mode: "serial" });

test(
  "Portal → AEJS | prepara e confirma a operação de workflow",
  integrationMutation,
  async ({ page, proposalPage, portalSession }) => {
    const scenario = getIntegrationPreparationScenario(
      "INT-CONFIRM-WORKFLOW",
    );
    await portalSession.useOperation(scenario.operationNumber);
    const registrationPage = new ProposalRegistrationPage(page, proposalPage);

    await test.step("abre a proposta descartável de workflow", async () => {
      await proposalPage.open(scenario.operationNumber);
    });

    await test.step("preenche titular sem cônjuge", async () => {
      const response = await registrationPage.fillApplicantAndAdvance(
        scenario.operationNumber,
        scenario.preparation,
      );
      expect(response.status()).toBe(200);
    });

    await test.step("define composição de renda como Não", async () => {
      const response = await registrationPage.setNoIncomeCompositionAndAdvance(
        scenario.operationNumber,
      );
      expect(response.status()).toBe(200);
    });

    await test.step("preenche o motivo próprio do workflow", async () => {
      const response = await registrationPage.fillCreditPurposeAndAdvance(
        scenario.operationNumber,
        scenario.preparation,
      );
      expect(response.status()).toBe(200);
    });

    await test.step("preenche o imóvel sem garantidor ou interveniente", async () => {
      await registrationPage.fillProperty(
        scenario.operationNumber,
        scenario.preparation,
      );
      await expect(
        proposalPage.getVisibleFieldByName("IMOVEL_OPERACAO.NO_ENDERECO"),
      ).toHaveValue(/\d+/);
      await expect(proposalPage.tabs.getTabButton("Imóvel")).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    await test.step("confirma o workflow na aba Imóvel", async () => {
      const { saveResponse, finalizeResponse } = await registrationPage.finalize(
        scenario.operationNumber,
      );
      expect(saveResponse.status()).toBe(200);
      expect(finalizeResponse.status()).toBe(200);
      await expect(finalizeResponse.json()).resolves.toMatchObject({
        sucesso: true,
      });
      await expect(
        page.getByText(/Etapa concluída|Cadastro concluído|sucesso/i),
      ).toBeVisible({ timeout: 60_000 });
    });
  },
);

test(
  "Portal | envia documentos e avança o workflow para validação cadastral",
  integrationMutation,
  async ({ proposalsPage, authenticatedPage, portalSession }) => {
    const scenario = getIntegrationDocumentScenario("INT-CONFIRM-WORKFLOW");
    await portalSession.useOperation(scenario.operationNumber);
    const documentsPage = new ProposalDocumentsPage(authenticatedPage);
    let documentCount = 0;

    await test.step("abre a etapa documental da proposta de workflow", async () => {
      await proposalsPage.open();
      await proposalsPage.loadAll();
      await proposalsPage.openProposal(scenario.operationNumber);
      await documentsPage.waitUntilReady();
      documentCount = await documentsPage.getDocumentCount();
      expect(documentCount).toBeGreaterThan(0);
    });

    await test.step("envia e abre todos os documentos solicitados", async () => {
      for (let index = 0; index < documentCount; index += 1) {
        await test.step(`documento ${index + 1} de ${documentCount}`, async () => {
          await documentsPage.chooseFileAt(
            index,
            resolve(scenario.documents.validFile.path),
          );
          await documentsPage.expectUploadedDocumentAt(
            index,
            scenario.documents.validFile.fileName,
          );

          const openedDocument = await documentsPage.openUploadedDocumentAt(index);
          expect(openedDocument.response.status()).toBe(200);
          expect(openedDocument.response.headers()["content-type"]).toContain(
            "application/pdf",
          );
          expect((await openedDocument.response.body()).byteLength).toBeGreaterThan(0);
          await openedDocument.popup.close();
        });
      }

      await expect(documentsPage.pendingDocuments).toContainText("0");
      await expect(documentsPage.completedDocuments).toContainText(
        String(documentCount),
      );
    });

    await test.step("finaliza a tarefa documental configurada", async () => {
      const submissionResponse = await documentsPage.sendForAnalysis(
        scenario.operationNumber,
      );
      expect(submissionResponse.status()).toBe(200);
      const submissionResult =
        (await submissionResponse.json()) as DocumentSubmissionResult;
      if (submissionResult.sucesso !== true) {
        throw new Error(
          `O Portal recusou o avanço documental da operacao ${scenario.operationNumber}: ${submissionResult.mensagem ?? "resposta sem mensagem"}`,
        );
      }
      await expect(
        authenticatedPage.getByText(/documentos.*enviados|etapa.*concluída|sucesso/i),
      ).toBeVisible({ timeout: 60_000 });
    });
  },
);
