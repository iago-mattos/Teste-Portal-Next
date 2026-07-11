import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { getIntegrationScenario } from "../../test-data/integration-data";

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
  "Portal → AEJS | valida a transição do workflow após o cadastro",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }) => {
    const scenario = getIntegrationScenario("INT-CONFIRM-WORKFLOW");
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

    await test.step("valida cadastro finalizado e documentos disponíveis", async () => {
      await expectProcessTask(
        operationsPage,
        "997",
        "Preencher dados cadastrais (Portal)",
        "Finalizada",
      );
      await expectProcessTask(
        operationsPage,
        "998",
        "Anexar documentação (Portal)",
        "Disponível",
      );
    });

    await test.step("confirma que a fase posterior ainda não foi criada", async () => {
      await expect(operationsPage.getProcessTaskRow("996")).toHaveCount(0);
    });
  },
);
