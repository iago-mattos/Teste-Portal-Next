import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { getIntegrationPreparationScenario } from "../../test-data/integration-data";

test(
  "Portal → AEJS | valida titular sem composição de renda",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }) => {
    const scenario = getIntegrationPreparationScenario(
      "INT-CONFIRM-QUITADO",
    );
    const operationsPage = new AejsOperationsPage(aejsPage);

    await test.step("abre a operação confirmada", async () => {
      await operationsPage.navigateToOperations();
      await operationsPage.openOperation(scenario.operationNumber);
      await expect(operationsPage.openedOperationNumber).toHaveValue(
        scenario.operationNumber,
      );
    });

    await test.step("valida as flags históricas do titular", async () => {
      await operationsPage.selectVisibleTab("Pretendente");
      await operationsPage.openUniqueVisibleGridRow();

      await expect(
        operationsPage.getVisibleInput("PESSOA$IN_E_PRINCIPAL"),
      ).toBeChecked();
      // Contrato confirmado: esta flag permanece marcada mesmo com composição "Não" no Portal.
      await expect(
        operationsPage.getVisibleInput("PESSOA$IN_EADQUIRENTE"),
      ).toBeChecked();

      await operationsPage.closeCurrentWindow();
    });
  },
);
