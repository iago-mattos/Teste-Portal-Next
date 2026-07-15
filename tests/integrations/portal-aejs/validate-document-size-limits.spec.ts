import { resolve } from "node:path";
import { expect, test } from "../../fixtures/test";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import { getIntegrationDocumentScenario } from "../../test-data/integration-data";

test.use({ skipPortalSessionBootstrap: true });

test(
  "Portal | bloqueia arquivos maiores que 10 MB em todos os documentos",
  { tag: ["@integration", "@readonly"] },
  async ({ proposalsPage, authenticatedPage, portalSession }) => {
    const scenario = getIntegrationDocumentScenario("INT-DOCUMENT-SIZE");
    await portalSession.useOperation(scenario.operationNumber);
    const documentsPage = new ProposalDocumentsPage(authenticatedPage);

    await proposalsPage.open();
    await proposalsPage.loadAll();
    await proposalsPage.openProposal(scenario.operationNumber);
    await documentsPage.waitUntilReady();
    const documentCount = await documentsPage.getDocumentCount();
    expect(documentCount).toBeGreaterThan(0);

    for (let index = 0; index < documentCount; index += 1) {
      await test.step(`documento ${index + 1}: rejeita todos os arquivos acima do limite`, async () => {
        for (const file of scenario.documents.oversizedFiles) {
          await documentsPage.chooseFileAt(index, resolve(file.path));

          await expect(documentsPage.maximumSizeError).toBeVisible();
          const row = documentsPage.getDocumentRowAt(index);
          await expect(row.getByText("Aguardando envio", { exact: true })).toBeVisible();
          await expect(
            row.getByRole("link", { name: "Ver arquivo", exact: true }),
          ).toHaveCount(0);

          await expect(documentsPage.maximumSizeError).toBeHidden({ timeout: 15_000 });
        }
      });
    }

    await expect(documentsPage.pendingDocuments).toContainText(
      String(documentCount),
    );
    await expect(documentsPage.completedDocuments).toContainText("0");
  },
);
