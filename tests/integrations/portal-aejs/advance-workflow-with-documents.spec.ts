import { resolve } from "node:path";
import { expect, test } from "../../fixtures/test";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import { getIntegrationDocumentScenario } from "../../test-data/integration-data";

interface DocumentSubmissionResult {
  readonly sucesso?: boolean;
  readonly mensagem?: string;
}

test(
  "Portal | envia documentos e avança o workflow para validação cadastral",
  { tag: ["@integration", "@mutation"] },
  async ({ proposalsPage, authenticatedPage }) => {
    const scenario = getIntegrationDocumentScenario("INT-CONFIRM-WORKFLOW");
    const documentsPage = new ProposalDocumentsPage(authenticatedPage);

    await test.step("abre a etapa documental da proposta de workflow", async () => {
      await proposalsPage.open();
      await proposalsPage.loadAll();
      await proposalsPage.openProposal(scenario.operationNumber);
      await documentsPage.waitUntilReady();
      await documentsPage.expectDocumentContract(scenario.documents.documentNames);
    });

    await test.step("envia e abre todos os documentos obrigatórios", async () => {
      for (const documentName of scenario.documents.documentNames) {
        await test.step(documentName, async () => {
          await documentsPage.chooseFile(
            documentName,
            resolve(scenario.documents.validFile.path),
          );
          await documentsPage.expectUploadedDocument(
            documentName,
            scenario.documents.validFile.fileName,
          );

          const openedDocument = await documentsPage.openUploadedDocument(documentName);
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
        String(scenario.documents.documentNames.length),
      );
    });

    await test.step("finaliza a tarefa documental 998", async () => {
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
