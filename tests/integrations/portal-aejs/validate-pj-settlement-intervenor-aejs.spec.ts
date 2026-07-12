import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { getIntegrationPreparationScenario } from "../../test-data/integration-data";

function formatCurrency(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) / 100);
}

test(
  "Portal → AEJS | valida o interveniente quitante sem persistir alterações",
  { tag: ["@integration"] },
  async ({ aejsPage }) => {
    const scenario = getIntegrationPreparationScenario("INT-CONFIRM-PJ");
    const { property, aejsReflection } = scenario.preparation;
    const operationsPage = new AejsOperationsPage(aejsPage);

    await test.step("abre a operação confirmada", async () => {
      await operationsPage.navigateToOperations();
      await operationsPage.openOperation(scenario.operationNumber);
      await expect(operationsPage.openedOperationNumber).toHaveValue(
        scenario.operationNumber,
      );
    });

    await test.step("valida a identificação do interveniente", async () => {
      await operationsPage.selectVisibleTab("Interveniente quitante");
      await expect(
        operationsPage.getVisibleField("INTERVENIENTE$NU_CPFCNPJ"),
      ).toHaveValue(aejsReflection.settlementIntervenor.identifier);
      await expect(
        operationsPage.getVisibleField("INTERVENIENTE$NO_PESSOA"),
      ).toHaveValue(property.settlementIntervenor);
    });

    await test.step("expõe e valida o saldo devedor", async () => {
      await operationsPage.startEditing();
      const alienatedOwnProperty = operationsPage.getVisibleInput(
        "IMOVEL_OPERACAO$IN_ALIENADO_PROPRIO",
      );
      await expect(alienatedOwnProperty).toBeChecked();
      await alienatedOwnProperty.uncheck();
      await expect(alienatedOwnProperty).not.toBeChecked();

      await operationsPage.selectVisibleTab(
        "Dados do contrato com o Interveniente Quitante",
      );
      await expect(
        operationsPage.getVisibleField("OPERACAO_CREDITO$VA_INTERVENIENTE"),
      ).toHaveValue(formatCurrency(property.outstandingBalance));
    });

    await test.step("descarta a alteração temporária", async () => {
      await operationsPage.cancelEditing();
    });

    await test.step("comprova que o valor original não foi persistido", async () => {
      await operationsPage.startEditing();
      await expect(
        operationsPage.getVisibleInput(
          "IMOVEL_OPERACAO$IN_ALIENADO_PROPRIO",
        ),
      ).toBeChecked();
      await operationsPage.cancelEditing();
    });
  },
);
