import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import {
  attachFunctionalEvidence,
  checkedEvidenceField,
  inputEvidenceField,
} from "../../fixtures/evidence";
import { getIntegrationPreparationScenario } from "../../test-data/integration-data";

function formatCurrency(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) / 100);
}

test(
  "Portal → AEJS | valida o interveniente quitante sem persistir alterações",
  { tag: ["@integration", "@transient"] },
  async ({ aejsPage }, testInfo) => {
    const scenario = getIntegrationPreparationScenario("INT-CONFIRM-PJ");
    const { property, aejsReflection } = scenario.preparation;
    const operationsPage = new AejsOperationsPage(aejsPage);

    await test.step("abre a operação confirmada", async () => {
      await operationsPage.navigateToOperations();
      await operationsPage.openOperation(scenario.operationNumber);
      await expect(operationsPage.openedOperationNumber).toHaveValue(
        scenario.operationNumber,
      );
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 1,
        slug: "interveniente-operacao-aberta",
        title: "Operação PJ aberta no SCCI",
        scenario: "INT-CONFIRM-PJ-INTERVENIENTE",
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

    await test.step("valida a identificação do interveniente", async () => {
      await operationsPage.selectVisibleTab("Interveniente quitante");
      await expect(
        operationsPage.getVisibleField("INTERVENIENTE$NU_CPFCNPJ"),
      ).toHaveValue(aejsReflection.settlementIntervenor.identifier);
      await expect(
        operationsPage.getVisibleField("INTERVENIENTE$NO_PESSOA"),
      ).toHaveValue(property.settlementIntervenor);
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 2,
        slug: "interveniente-identificacao",
        title: "Interveniente quitante — identificação",
        scenario: "INT-CONFIRM-PJ-INTERVENIENTE",
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          inputEvidenceField(
            "Identificador",
            operationsPage.getVisibleField("INTERVENIENTE$NU_CPFCNPJ"),
            aejsReflection.settlementIntervenor.identifier,
            "tax-id",
          ),
          inputEvidenceField(
            "Instituição",
            operationsPage.getVisibleField("INTERVENIENTE$NO_PESSOA"),
            property.settlementIntervenor,
            "name",
          ),
        ]),
      });
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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 3,
        slug: "interveniente-saldo-devedor",
        title: "Interveniente quitante — saldo devedor",
        scenario: "INT-CONFIRM-PJ-INTERVENIENTE",
        operationNumber: scenario.operationNumber,
        fields: [
          await inputEvidenceField(
            "Saldo devedor",
            operationsPage.getVisibleField(
              "OPERACAO_CREDITO$VA_INTERVENIENTE",
            ),
            formatCurrency(property.outstandingBalance),
          ),
        ],
      });
    });

    await test.step("descarta a alteração temporária", async () => {
      await operationsPage.cancelEditing();
    });

    await test.step("comprova que nenhuma alteração foi persistida", async () => {
      await operationsPage.startEditing();
      await expect(
        operationsPage.getVisibleInput(
          "IMOVEL_OPERACAO$IN_ALIENADO_PROPRIO",
        ),
      ).toBeChecked();
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 4,
        slug: "interveniente-descarte-comprovado",
        title: "Interveniente quitante — alteração temporária descartada",
        scenario: "INT-CONFIRM-PJ-INTERVENIENTE",
        operationNumber: scenario.operationNumber,
        fields: [
          await checkedEvidenceField(
            "Imóvel alienado próprio restaurado",
            operationsPage.getVisibleInput(
              "IMOVEL_OPERACAO$IN_ALIENADO_PROPRIO",
            ),
            true,
          ),
        ],
      });
      await operationsPage.cancelEditing();
    });
  },
);
