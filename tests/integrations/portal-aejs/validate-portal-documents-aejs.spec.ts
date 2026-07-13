import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { getIntegrationDocumentScenario } from "../../test-data/integration-data";

const documentScenarios = [
  "INT-DOCUMENT-PERSISTENCE",
  "INT-CONFIRM-WORKFLOW",
] as const;

for (const caseId of documentScenarios) {
  test(
    `Portal → AEJS | ${caseId} valida todos os documentos de renda enviados`,
    { tag: ["@integration", "@readonly"] },
    async ({ aejsPage }) => {
      const scenario = getIntegrationDocumentScenario(caseId);
      const operationsPage = new AejsOperationsPage(aejsPage);

      await test.step("abre a operação finalizada e a aba Renda PF", async () => {
        await operationsPage.navigateToOperations();
        await operationsPage.openOperation(scenario.operationNumber);
        await expect(operationsPage.openedOperationNumber).toHaveValue(
          scenario.operationNumber,
        );
        await operationsPage.openIncomeDocuments();
      });

      for (const documentName of scenario.documents.documentNames) {
        await test.step(`${documentName}: abre o PDF refletido`, async () => {
          await operationsPage.openIncomeDocument(documentName);
          await expect(operationsPage.openedDocumentFrame).toHaveAttribute(
            "src",
            /^blob:/,
          );
          await expect(operationsPage.openedDocumentUploadedAt).toHaveValue(
            /\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}/,
          );
          await operationsPage.closeOpenedDocument();
        });
      }
    },
  );
}
