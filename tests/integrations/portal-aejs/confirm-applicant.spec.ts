import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { getIntegrationPreparationScenario } from "../../test-data/integration-data";

test(
  "Portal → AEJS | abre a ficha do pretendente da operação",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage, proposalsPage }) => {
    const scenario = getIntegrationPreparationScenario("INT-CONFIRM-PJ");
    const applicantName = scenario.preparation.aejsReflection.applicant.name;

    await proposalsPage.open();
    await proposalsPage.loadAll();
    await expect(
      proposalsPage.getProposalCard(scenario.operationNumber),
    ).toBeVisible();

    const aejsOperationsPage = new AejsOperationsPage(aejsPage);
    await aejsOperationsPage.navigateToOperations();
    await aejsOperationsPage.openOperation(scenario.operationNumber);
    await expect(aejsOperationsPage.openedOperationNumber).toHaveValue(
      scenario.operationNumber,
    );

    await aejsOperationsPage.openApplicant(applicantName);
    await expect(aejsOperationsPage.openedApplicantName).toHaveValue(
      applicantName,
    );
  },
);
