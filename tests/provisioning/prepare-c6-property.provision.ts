import type { TestInfo } from "@playwright/test";
import { test, expect } from "../fixtures/test";
import {
  renewPortalSession,
  restorePortalOperationSession,
} from "../fixtures/auth.fixture";
import {
  getGeneratedSimulationForSlot,
  markGeneratedSimulationReady,
  markGeneratedSimulationRejected,
  type GeneratedSimulationEntry,
} from "../services/generated-simulation-registry";
import { getC6ProvisioningScenario } from "../test-data/c6-provisioning-data";
import { getProvisioningSlot } from "../test-data/provisioning-data";
import {
  PROVISIONING_SLOT_IDS,
  type ProvisioningSlotId,
} from "../types/provisioning";

test.use({ skipPortalSessionBootstrap: true });

function resolveSlot(): ProvisioningSlotId {
  const value = process.env.PORTAL_PROVISION_SLOT?.trim().toUpperCase();
  if (!value || !PROVISIONING_SLOT_IDS.includes(value as ProvisioningSlotId)) {
    throw new Error("Defina PORTAL_PROVISION_SLOT com um slot válido.");
  }
  return value as ProvisioningSlotId;
}

function assertC6HtTarget(): void {
  const profile = process.env.PW_PROFILE?.trim().toLowerCase();
  const portalHost = new URL(process.env.PORTAL_URL ?? "").host;
  if (
    profile !== "ht" ||
    portalHost !== "minhaproposta-dev.prognum.com.br" ||
    process.env.PORTAL_PROVISION_PROVIDER !== "c6"
  ) {
    throw new Error(
      "Preparação do imóvel bloqueada: use exclusivamente o Portal C6 HT.",
    );
  }
}

async function attachEntry(
  testInfo: TestInfo,
  entry: GeneratedSimulationEntry,
): Promise<void> {
  await testInfo.attach("c6-property-preparation", {
    body: Buffer.from(JSON.stringify(entry, null, 2)),
    contentType: "application/json",
  });
}

test(
  "C6 HT | comprova no Portal o endereço do imóvel preparado no SCCI",
  { tag: ["@provisioning", "@readonly"] },
  async ({ page, portalConfig, proposalPage }, testInfo) => {
    assertC6HtTarget();
    const slotId = resolveSlot();
    const slot = getProvisioningSlot(slotId);
    let entry = await getGeneratedSimulationForSlot(slotId);
    if (!entry?.protocol) {
      throw new Error(`${slot.id} ainda não possui operação provisionada.`);
    }

    try {
      const operationNumber = entry.protocol;
      const propertyAddress = getC6ProvisioningScenario().propertyAddress;
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
      await page.goto(
        new URL(`/propostas/${operationNumber}`, portalConfig.portalUrl).toString(),
      );
      await proposalPage.waitUntilReady();

      await proposalPage.tabs.select("Imóvel");
      expect(
        (
          await proposalPage
            .getVisibleFieldByName("IMOVEL_OPERACAO.NU_CEP")
            .inputValue()
        ).replace(/\D/g, ""),
      ).toBe(propertyAddress.postalCode);
      await expect(
        proposalPage.getVisibleFieldByName("IMOVEL_OPERACAO.NO_ENDERECO"),
      ).toHaveValue(propertyAddress.addressLine);
      await expect(
        proposalPage.getVisibleFieldByName("IMOVEL_OPERACAO.NO_COMPLEMENTO"),
      ).toHaveValue(propertyAddress.complement);

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
