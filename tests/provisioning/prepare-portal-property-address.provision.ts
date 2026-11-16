import type { TestInfo } from "@playwright/test";
import { test } from "../fixtures/test";
import {
  renewPortalSession,
  restorePortalOperationSession,
} from "../fixtures/auth.fixture";
import { ProposalRegistrationPage } from "../pages/portal/proposal-registration.page";
import {
  getGeneratedSimulationForSlot,
  markGeneratedSimulationReady,
  markGeneratedSimulationRejected,
  refreshGeneratedSimulationScenario,
  type GeneratedSimulationEntry,
} from "../services/generated-simulation-registry";
import { getPortalPropertyPostalCodeContract } from "../test-data/portal-property-address";
import { getProvisioningSlot } from "../test-data/provisioning-data";
import {
  PROVISIONING_SLOT_IDS,
  type ProvisioningSlotId,
} from "../types/provisioning";
import { assertEsteiraHtProvisioningTarget } from "../config/esteira-ht-provisioning-target";

test.use({ skipPortalSessionBootstrap: true });

const PREPARABLE_STATE_OWNERS = new Set(["provisioner", "existing-integration-test"]);

function resolveSlot(): ProvisioningSlotId {
  const value = process.env.PORTAL_PROVISION_SLOT?.trim().toUpperCase();
  if (!value || !PROVISIONING_SLOT_IDS.includes(value as ProvisioningSlotId)) {
    throw new Error("Defina PORTAL_PROVISION_SLOT com um slot válido.");
  }
  const slotId = value as ProvisioningSlotId;
  const slot = getProvisioningSlot(slotId);
  if (slot.lifecycle !== "fresh-per-run") {
    throw new Error(`${slotId} não é uma massa fresca por execução.`);
  }
  if (!PREPARABLE_STATE_OWNERS.has(slot.stateOwner)) {
    throw new Error(
      `${slotId} não precisa desta preparação; seu endereço é tratado por ${slot.stateOwner}.`,
    );
  }
  return slotId;
}

async function attachEntry(
  testInfo: TestInfo,
  entry: GeneratedSimulationEntry,
): Promise<void> {
  await testInfo.attach("portal-property-address", {
    body: Buffer.from(JSON.stringify(entry, null, 2)),
    contentType: "application/json",
  });
}

test(
  "EsteiraHT | preenche e persiste pelo Portal o CEP do imóvel",
  { tag: ["@provisioning", "@mutation"] },
  async ({ page, portalConfig, proposalPage }, testInfo) => {
    assertEsteiraHtProvisioningTarget();
    const slotId = resolveSlot();
    let entry = await getGeneratedSimulationForSlot(slotId);
    if (!entry?.protocol) {
      throw new Error(`${slotId} ainda não possui operação provisionada.`);
    }

    try {
      const operationNumber = entry.protocol;
      const contract = getPortalPropertyPostalCodeContract();
      const proposalUrl = new URL(
        `/propostas/${operationNumber}`,
        portalConfig.portalUrl,
      ).toString();
      const registrationPage = new ProposalRegistrationPage(page, proposalPage);

      const restored = await restorePortalOperationSession(
        page.context(),
        portalConfig,
        entry.applicant.cpfDigits,
      );
      if (!restored) {
        await renewPortalSession(page.context(), portalConfig, {
          cpf: entry.applicant.cpfDigits,
          persist: true,
        });
      }

      let filled: Awaited<ReturnType<typeof registrationPage.fillPropertyPostalCode>>;
      await test.step("preenche o CEP do imóvel e aguarda a consulta real", async () => {
        await page.goto(proposalUrl);
        await proposalPage.waitUntilReady();
        filled = await registrationPage.fillPropertyPostalCode(
          operationNumber,
          contract,
        );
      });

      await test.step("provoca o salvamento real trocando de aba", async () => {
        const saveResponse =
          await registrationPage.persistPropertyWithoutFinalizing(operationNumber);
        if (saveResponse.status() !== 200) {
          throw new Error(
            `O Portal recusou o salvamento do imóvel (HTTP ${saveResponse.status()}).`,
          );
        }

        const body = await saveResponse.json().catch(() => null);
        const succeeded =
          body !== null &&
          typeof body === "object" &&
          (body.success === true || body.sucesso === true);
        if (!succeeded) {
          throw new Error(
            `O Portal respondeu HTTP 200 ao salvar o imóvel, mas o corpo não confirmou sucesso real (success/sucesso: true): ${JSON.stringify(body)}.`,
          );
        }
      });

      let persistedPostalCode = "";
      let persistedAddressLine = "";
      await test.step("recarrega a proposta e comprova a persistência real", async () => {
        await page.goto(proposalUrl);
        await proposalPage.waitUntilReady();
        await registrationPage.expectPersistedPropertyPostalCode(
          operationNumber,
          contract,
          filled!.addressLine,
        );

        const addressField = proposalPage.getVisibleFieldByName(
          "IMOVEL_OPERACAO.NO_ENDERECO",
        );
        const postalCodeField = proposalPage.getVisibleFieldByName(
          "IMOVEL_OPERACAO.NU_CEP",
        );
        persistedAddressLine = (await addressField.inputValue()).trim();
        persistedPostalCode = (await postalCodeField.inputValue()).replace(
          /\D/g,
          "",
        );
        if (!persistedPostalCode || !persistedAddressLine) {
          throw new Error(
            "O Portal recarregou a proposta sem manter CEP ou endereço do imóvel preenchidos.",
          );
        }
      });

      entry = await refreshGeneratedSimulationScenario(entry.id, {
        ...entry.scenario,
        propertyAddress: {
          postalCode: persistedPostalCode,
          addressLine: persistedAddressLine,
          ...(filled!.state ? { state: filled!.state } : {}),
          ...(filled!.municipality ? { municipality: filled!.municipality } : {}),
        },
      });
      entry = await markGeneratedSimulationReady(entry.id);
      await attachEntry(testInfo, entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      entry = await markGeneratedSimulationRejected(entry.id, message);
      await attachEntry(testInfo, entry);
      throw error;
    }
  },
);
