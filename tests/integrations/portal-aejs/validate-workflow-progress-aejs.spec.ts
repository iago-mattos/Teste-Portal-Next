import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import {
  getIntegrationScenario,
  getWorkflowProgressExpectation,
} from "../../test-data/integration-data";

async function expectProcessTask(
  operationsPage: AejsOperationsPage,
  taskCode: string,
  title: string,
  status: string,
): Promise<void> {
  const row = operationsPage.getProcessTaskRow(taskCode);
  await expect(row).toHaveCount(1);
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("gridcell", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    row.getByRole("gridcell", { name: status, exact: true }),
  ).toBeVisible();
}

test(
  "Portal → AEJS | valida a transição do workflow após os documentos",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }) => {
    const scenario = getIntegrationScenario("INT-CONFIRM-WORKFLOW");
    const workflow = getWorkflowProgressExpectation();
    const operationsPage = new AejsOperationsPage(aejsPage);

    await test.step("abre a operação confirmada", async () => {
      await operationsPage.navigateToOperations();
      await operationsPage.openOperation(scenario.operationNumber);
      await expect(operationsPage.openedOperationNumber).toHaveValue(
        scenario.operationNumber,
      );
    });

    await test.step("abre o andamento do processo", async () => {
      await operationsPage.openProcessProgress();
    });

    await test.step("valida cadastro e documentos finalizados", async () => {
      await expectProcessTask(
        operationsPage,
        workflow.registration.code,
        workflow.registration.title,
        workflow.registration.status,
      );
      await expectProcessTask(
        operationsPage,
        workflow.documents.code,
        workflow.documents.title,
        workflow.documents.status,
      );
    });

    await test.step("valida a liberação da validação cadastral", async () => {
      await expectProcessTask(
        operationsPage,
        workflow.validation.code,
        workflow.validation.title,
        workflow.validation.status,
      );
    });
  },
);
