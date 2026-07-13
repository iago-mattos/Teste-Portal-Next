import { resolve } from "node:path";
import { expect, test } from "../../fixtures/test";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import { getIntegrationDocumentScenario } from "../../test-data/integration-data";

test(
  "Portal | bloqueia arquivos maiores que 10 MB em todos os documentos",
  { tag: ["@integration", "@readonly"] },
  async ({ proposalsPage, authenticatedPage }) => {
    const scenario = getIntegrationDocumentScenario("INT-DOCUMENT-SIZE");
    const documentsPage = new ProposalDocumentsPage(authenticatedPage);

    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(scenario.operationNumber);
    await documentsPage.waitUntilReady();
    await documentsPage.expectDocumentContract(scenario.documents.documentNames);

    for (const documentName of scenario.documents.documentNames) {
      await test.step(`${documentName}: rejeita todos os arquivos acima do limite`, async () => {
        for (const file of scenario.documents.oversizedFiles) {
          await documentsPage.chooseFile(documentName, resolve(file.path));

          await expect(documentsPage.maximumSizeError).toBeVisible();
          const row = documentsPage.getDocumentRow(documentName);
          await expect(row.getByText("Aguardando envio", { exact: true })).toBeVisible();
          await expect(
            row.getByRole("link", { name: "Ver arquivo", exact: true }),
          ).toHaveCount(0);

          await expect(documentsPage.maximumSizeError).toBeHidden({ timeout: 15_000 });
        }
      });
    }

    await expect(documentsPage.pendingDocuments).toContainText(
      String(scenario.documents.documentNames.length),
    );
    await expect(documentsPage.completedDocuments).toContainText("0");
  },
);
