import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import {
  AejsPropertyPreparationPage,
  type AejsPropertyAddressChange,
} from "../../pages/aejs/aejs-property-preparation.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { getIntegrationScenario } from "../../test-data/integration-data";

const reflectedAddress: AejsPropertyAddressChange = Object.freeze({
  postalCode: "24120216",
  street: "Rua Rodrigo Pereira",
  streetNumber: "80",
});

test(
  "PROP-03 | As informações Endereço do imóvel, Valor do imóvel, Valor do empréstimo, prazo solicitado quando alteradas em outras fases na plataforma prognum, refletirão no portal",
  { tag: ["@functional", "@mutation"] },
  async ({
    aejsPage,
    portalSession,
    proposalsPage,
    proposalPage,
  }) => {
    test.setTimeout(5 * 60_000);
    const scenario = getIntegrationScenario("INT-CONFIRM-WORKFLOW");

    await test.step("alterar e comprovar o endereço na operação do workflow no SCCI", async () => {
      const operations = new AejsOperationsPage(aejsPage);
      const property = new AejsPropertyPreparationPage(aejsPage);

      await operations.navigateToOperations();
      await operations.openOperation(scenario.operationNumber);
      await expect(operations.openedOperationNumber).toHaveValue(
        scenario.operationNumber,
      );
      await property.changeAndPersistAddress(reflectedAddress);
      await property.expectChangedAddress(reflectedAddress);
    });

    await test.step("comprovar o endereço refletido na aba Imóvel do Portal", async () => {
      await portalSession.useOperation(scenario.operationNumber, { fresh: true });
      await proposalsPage.open();
      await proposalsPage.loadAll();
      await proposalsPage.openProposal(scenario.operationNumber);
      await proposalPage.waitUntilReady();
      await proposalPage.tabs.select("Imóvel");

      expect(
        (
          await proposalPage
            .getVisibleFieldByName("IMOVEL_OPERACAO.NU_CEP")
            .inputValue()
        ).replace(/\D/g, ""),
      ).toBe(reflectedAddress.postalCode);
      await expect(
        proposalPage.getVisibleFieldByName("IMOVEL_OPERACAO.NO_ENDERECO"),
      ).toHaveValue(
        `${reflectedAddress.street}, ${reflectedAddress.streetNumber}`,
      );
    });
  },
);
