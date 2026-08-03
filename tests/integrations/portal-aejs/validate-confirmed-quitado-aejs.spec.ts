import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import {
  attachFunctionalEvidence,
  checkedEvidenceField,
  inputEvidenceField,
} from "../../fixtures/evidence";
import { getIntegrationPreparationScenario } from "../../test-data/integration-data";

test(
  "Portal → AEJS | valida titular sem composição de renda",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }, testInfo) => {
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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 1,
        slug: "quitado-operacao-aberta",
        title: "Operação quitada aberta no SCCI",
        scenario: "INT-CONFIRM-QUITADO",
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

      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 2,
        slug: "quitado-flags-titular",
        title: "Titular — flags históricas do cenário quitado",
        scenario: "INT-CONFIRM-QUITADO",
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          checkedEvidenceField(
            "Pretendente principal",
            operationsPage.getVisibleInput("PESSOA$IN_E_PRINCIPAL"),
            true,
          ),
          checkedEvidenceField(
            "Composição de renda no SCCI",
            operationsPage.getVisibleInput("PESSOA$IN_EADQUIRENTE"),
            true,
          ),
        ]),
      });

      await operationsPage.closeCurrentWindow();
    });
  },
);
