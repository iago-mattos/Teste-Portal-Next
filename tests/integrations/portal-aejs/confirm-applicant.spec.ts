import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { getIntegrationScenario } from "../../test-data/integration-data";

test(
  "Portal → AEJS | abre a ficha do pretendente da operação",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage, proposalsPage, portalSession }) => {
    const scenario = getIntegrationScenario("INT-CONFIRM-PJ");

    await portalSession.useOperation(scenario.operationNumber);

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

    const applicantName = await aejsOperationsPage.getOperationApplicantName();
    const expectedApplicantName =
      scenario.provisionedMass?.applicant.name.toLocaleUpperCase("pt-BR");
    if (scenario.provisionedMass) {
      expect(applicantName).toBe(expectedApplicantName);
    }
    await aejsOperationsPage.openApplicant(applicantName);
    await expect(aejsOperationsPage.openedApplicantName).toHaveValue(
      expectedApplicantName ?? applicantName,
    );
  },
);
