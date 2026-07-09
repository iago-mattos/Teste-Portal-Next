import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { getIntegrationScenario } from "../../test-data/integration-data";

test(
  "Portal → AEJS | abre no AEJS a operação existente no Portal",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsConfig, aejsPage, proposalsPage }) => {
    const scenario = getIntegrationScenario("INT-CONFIRM-PJ");

    await proposalsPage.open();
    await proposalsPage.loadAll();
    await expect(
      proposalsPage.getProposalCard(scenario.operationNumber),
    ).toBeVisible();

    await aejsPage.goto(aejsConfig.baseUrl, { waitUntil: "domcontentloaded" });

    const aejsOperationsPage = new AejsOperationsPage(aejsPage);
    await aejsOperationsPage.navigateToOperations();
    await aejsOperationsPage.openOperation(scenario.operationNumber);

    await expect(aejsOperationsPage.openedOperationNumber).toHaveValue(
      scenario.operationNumber,
    );
  },
);
