import type { TestInfo } from "@playwright/test";
import {
  aejsTest as test,
  authenticateAejsPage,
  expect,
} from "../fixtures/aejs/aejs.fixture";
import { AejsApplicantPreparationPage } from "../pages/aejs/aejs-applicant-preparation.page";
import { AejsC6SimulationPage } from "../pages/aejs/aejs-c6-simulation.page";
import { AejsOperationsPage } from "../pages/aejs/aejs-operations.page";
import { AejsPropertyPreparationPage } from "../pages/aejs/aejs-property-preparation.page";
import {
  markGeneratedSimulationPropertyPrepared,
  markGeneratedSimulationReady,
  markGeneratedSimulationRejected,
  markGeneratedSimulationStatePrepared,
  markGeneratedSimulationSubmitted,
  getExpectedNextOperationForActiveRun,
  reserveProvisioningSlot,
  refreshGeneratedSimulationScenario,
  type GeneratedSimulationEntry,
} from "../services/generated-simulation-registry";
import { getC6ProvisioningScenario } from "../test-data/c6-provisioning-data";
import { getProvisioningSlot } from "../test-data/provisioning-data";
import {
  PROVISIONING_SLOT_IDS,
  type ProvisioningSlotId,
} from "../types/provisioning";
import { assertC6ProvisioningTarget } from "../config/c6-provisioning-target";

function resolveProvisioningSlot(): ProvisioningSlotId {
  const value = process.env.PORTAL_PROVISION_SLOT?.trim().toUpperCase();
  if (!value || !PROVISIONING_SLOT_IDS.includes(value as ProvisioningSlotId)) {
    throw new Error(
      "Defina PORTAL_PROVISION_SLOT com um slot válido antes de criar a proposta C6.",
    );
  }
  return value as ProvisioningSlotId;
}

async function attachEntry(
  testInfo: TestInfo,
  entry: GeneratedSimulationEntry,
): Promise<void> {
  await testInfo.attach("c6-generated-mass", {
    body: Buffer.from(JSON.stringify(entry, null, 2)),
    contentType: "application/json",
  });
}

test(
  "C6 | cria a proposta e prepara endereços no SCCI",
  { tag: ["@provisioning", "@mutation"] },
  async ({ aejsPage, aejsConfig }, testInfo) => {
    assertC6ProvisioningTarget();

    const slotId = resolveProvisioningSlot();
    const slot = getProvisioningSlot(slotId);
    test.skip(
      slot.creationMode === "manual-shared",
      `${slot.id} precisa compartilhar o CPF de ${slot.sharedCpfWith}.`,
    );

    const scenario = getC6ProvisioningScenario();
    let entry = await reserveProvisioningSlot(slotId, scenario);
    entry = await refreshGeneratedSimulationScenario(entry.id, scenario);

    try {
      if (!entry.protocol) {
        await test.step("simula e grava a proposta no C6", async () => {
          const simulation = new AejsC6SimulationPage(aejsPage);
          await simulation.open();
          const usesSharedCpf = slot.creationMode === "scci-shared";
          const expectedCreatedOperation = usesSharedCpf
            ? await getExpectedNextOperationForActiveRun()
            : undefined;
          const operation = await simulation.createProposal(
            scenario,
            entry.applicant,
            {
              confirmExistingCpfProposal: usesSharedCpf,
              expectedCreatedOperation,
            },
          );

          if (usesSharedCpf) {
            await authenticateAejsPage(aejsPage, aejsConfig);
            const operations = new AejsOperationsPage(aejsPage);
            await operations.navigateToOperations();
            await operations.openOperationEventually(operation);
            await expect(operations.openedOperationNumber).toHaveValue(operation);
            expect(await operations.getOperationApplicantName()).toMatch(
              new RegExp(
                `^${entry.applicant.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
                "i",
              ),
            );
            expect(
              (
                await operations
                  .getVisibleControlByLabel("CPF/CNPJ do cliente:")
                  .inputValue()
              ).replace(/\D/g, ""),
            ).toBe(entry.applicant.cpfDigits);
          }

          entry = await markGeneratedSimulationSubmitted(entry.id, operation);
          await attachEntry(testInfo, entry);
        });
      } else {
        await test.step("retoma a operação já registrada", async () => {
          const operations = new AejsOperationsPage(aejsPage);
          await operations.navigateToOperations();
          await operations.openOperationEventually(entry.protocol!);
          await expect(operations.openedOperationNumber).toHaveValue(
            entry.protocol!,
          );
        });
      }

      await test.step("preenche e comprova o endereço do imóvel", async () => {
        const operations = new AejsOperationsPage(aejsPage);
        const property = new AejsPropertyPreparationPage(aejsPage);
        await operations.navigateToOperations();
        await operations.openOperationEventually(entry.protocol!);
        if (
          !entry.propertyPreparedAt &&
          !(await property.hasPersistedAddress(scenario.propertyAddress))
        ) {
          await property.fillAndPersistAddress(scenario.propertyAddress);

          await operations.navigateToOperations();
          await operations.openOperationEventually(entry.protocol!);
        }
        await property.expectAddress(scenario.propertyAddress);
        entry = await markGeneratedSimulationPropertyPrepared(entry.id);
      });

      await test.step("preenche e comprova o CEP do pretendente", async () => {
        if (!entry.statePreparedAt) {
          const applicant = new AejsApplicantPreparationPage(aejsPage);
          await applicant.fillAndPersistPostalCode(
            entry.applicant.name,
            scenario.applicantPostalCode,
          );
          entry = await markGeneratedSimulationStatePrepared(entry.id);
        }
      });

      if (
        slot.stateOwner === "provisioner" ||
        slot.stateOwner === "existing-integration-test"
      ) {
        entry = await markGeneratedSimulationReady(entry.id);
      }
      await attachEntry(testInfo, entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      entry = await markGeneratedSimulationRejected(entry.id, message);
      await attachEntry(testInfo, entry);
      throw error;
    }
  },
);
