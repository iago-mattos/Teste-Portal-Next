import { resolve } from "node:path";
import { expect, test } from "../../fixtures/test";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import { getIntegrationDocumentScenario } from "../../test-data/integration-data";

const integrationMutation = {
  tag: ["@integration", "@mutation"],
};

interface DocumentSubmissionResult {
  readonly sucesso?: boolean;
  readonly mensagem?: string;
}

test(
  "Portal | envia e visualiza todos os documentos da operação dedicada",
  integrationMutation,
  async ({ proposalsPage, authenticatedPage }) => {
    const scenario = getIntegrationDocumentScenario("INT-DOCUMENT-PERSISTENCE");
    const documentsPage = new ProposalDocumentsPage(authenticatedPage);
    let documentCount = 0;

    await test.step("abre a etapa documental da proposta", async () => {
      await proposalsPage.open();
      await proposalsPage.loadAll();
      await proposalsPage.openProposal(scenario.operationNumber);
      await documentsPage.waitUntilReady();
      documentCount = await documentsPage.getDocumentCount();
      expect(documentCount).toBeGreaterThan(0);
    });

    await test.step("envia e abre cada documento solicitado", async () => {
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

    await test.step("envia o conjunto completo para análise", async () => {
      await expect(documentsPage.sendForAnalysisButton).toBeEnabled();

      const submissionResponse = await documentsPage.sendForAnalysis(
        scenario.operationNumber,
      );
      expect(submissionResponse.status()).toBe(200);
      const submissionResult =
        (await submissionResponse.json()) as DocumentSubmissionResult;
      if (submissionResult.sucesso !== true) {
        throw new Error(
          `O Portal recusou o envio documental da operacao ${scenario.operationNumber}: ${submissionResult.mensagem ?? "resposta sem mensagem"}`,
        );
      }
      await expect(
        authenticatedPage.getByText(/documentos.*enviados|etapa.*concluída|sucesso/i),
      ).toBeVisible({ timeout: 60_000 });
    });
  },
);
