import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import {
  attachFunctionalEvidence,
  inputEvidenceField,
} from "../../fixtures/evidence";
import { getIntegrationDocumentScenario } from "../../test-data/integration-data";

const documentScenarios = [
  "INT-DOCUMENT-PERSISTENCE",
  "INT-CONFIRM-WORKFLOW",
] as const;

for (const caseId of documentScenarios) {
  test(
    `Portal → AEJS | ${caseId} valida todos os documentos de renda enviados`,
    { tag: ["@integration", "@readonly"] },
    async ({ aejsPage }, testInfo) => {
      const scenario = getIntegrationDocumentScenario(caseId);
      const operationsPage = new AejsOperationsPage(aejsPage);

      await test.step("abre a operação finalizada e a aba Renda PF", async () => {
        await operationsPage.navigateToOperations();
        await operationsPage.openOperation(scenario.operationNumber);
        await expect(operationsPage.openedOperationNumber).toHaveValue(
          scenario.operationNumber,
        );
        await operationsPage.openIncomeDocuments();
        await attachFunctionalEvidence(aejsPage, testInfo, {
          order: 1,
          slug: `${caseId}-documentos-renda-pf`,
          title: "Operação aberta na área Documentos — Renda PF",
          scenario: caseId,
          operationNumber: scenario.operationNumber,
          fields: [
            await inputEvidenceField(
              "Operação",
              operationsPage.openedOperationNumber,
              scenario.operationNumber,
              "operation",
            ),
          ],
        });
      });

      for (const [index, documentName] of scenario.documents.documentNames.entries()) {
        await test.step(`${documentName}: abre o PDF refletido`, async () => {
          await operationsPage.openIncomeDocument(documentName);
          await expect(operationsPage.openedDocumentFrame).toHaveAttribute(
            "src",
            /^blob:/,
          );
          await expect(operationsPage.openedDocumentUploadedAt).toHaveValue(
            /\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}/,
          );
          const uploadedAt =
            await operationsPage.openedDocumentUploadedAt.inputValue();
          await attachFunctionalEvidence(aejsPage, testInfo, {
            order: index + 2,
            slug: `${caseId}-${documentName}`,
            title: `Documento refletido — ${documentName}`,
            scenario: caseId,
            operationNumber: scenario.operationNumber,
            fields: [
              {
                label: "Documento",
                expected: documentName,
                actual: documentName,
              },
              {
                label: "Conteúdo PDF",
                expected: "PDF carregado no visualizador",
                actual: "PDF carregado no visualizador",
              },
              {
                label: "Data/hora do upload",
                expected: "DD-MM-AAAA HH:mm",
                actual: uploadedAt,
                mask: "date",
              },
            ],
          });
          await operationsPage.closeOpenedDocument();
        });
      }
    },
  );
}
