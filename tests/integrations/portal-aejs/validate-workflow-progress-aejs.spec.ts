import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import {
  attachFunctionalEvidence,
  inputEvidenceField,
  textEvidenceField,
} from "../../fixtures/evidence";
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
  async ({ aejsPage }, testInfo) => {
    const scenario = getIntegrationScenario("INT-CONFIRM-WORKFLOW");
    const workflow = getWorkflowProgressExpectation();
    const operationsPage = new AejsOperationsPage(aejsPage);

    await test.step("abre a operação confirmada", async () => {
      await operationsPage.navigateToOperations();
      await operationsPage.openOperation(scenario.operationNumber);
      await expect(operationsPage.openedOperationNumber).toHaveValue(
        scenario.operationNumber,
      );
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 1,
        slug: "workflow-operacao-aberta",
        title: "Operação de workflow aberta no SCCI",
        scenario: "INT-CONFIRM-WORKFLOW",
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
      const registrationRow = operationsPage.getProcessTaskRow(
        workflow.registration.code,
      );
      const documentsRow = operationsPage.getProcessTaskRow(
        workflow.documents.code,
      );
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 2,
        slug: "workflow-cadastro-documentos",
        title: "Workflow — cadastro e documentos",
        scenario: "INT-CONFIRM-WORKFLOW",
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          textEvidenceField(
            `Fase ${workflow.registration.code}`,
            registrationRow.getByRole("gridcell", {
              name: workflow.registration.title,
              exact: true,
            }),
            workflow.registration.title,
          ),
          textEvidenceField(
            `Status ${workflow.registration.code}`,
            registrationRow.getByRole("gridcell", {
              name: workflow.registration.status,
              exact: true,
            }),
            workflow.registration.status,
          ),
          textEvidenceField(
            `Fase ${workflow.documents.code}`,
            documentsRow.getByRole("gridcell", {
              name: workflow.documents.title,
              exact: true,
            }),
            workflow.documents.title,
          ),
          textEvidenceField(
            `Status ${workflow.documents.code}`,
            documentsRow.getByRole("gridcell", {
              name: workflow.documents.status,
              exact: true,
            }),
            workflow.documents.status,
          ),
        ]),
      });
    });

    await test.step("valida a liberação da validação cadastral", async () => {
      await expectProcessTask(
        operationsPage,
        workflow.validation.code,
        workflow.validation.title,
        workflow.validation.status,
      );
      const validationRow = operationsPage.getProcessTaskRow(
        workflow.validation.code,
      );
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 3,
        slug: "workflow-validacao-cadastral",
        title: "Workflow — validação cadastral liberada",
        scenario: "INT-CONFIRM-WORKFLOW",
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          textEvidenceField(
            `Fase ${workflow.validation.code}`,
            validationRow.getByRole("gridcell", {
              name: workflow.validation.title,
              exact: true,
            }),
            workflow.validation.title,
          ),
          textEvidenceField(
            `Status ${workflow.validation.code}`,
            validationRow.getByRole("gridcell", {
              name: workflow.validation.status,
              exact: true,
            }),
            workflow.validation.status,
          ),
        ]),
      });
    });
  },
);
