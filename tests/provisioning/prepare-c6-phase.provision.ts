import type { Browser, TestInfo } from "@playwright/test";
import { loadPortalRuntimeConfig } from "../config/runtime-config";
import { aejsTest as test, expect } from "../fixtures/aejs/aejs.fixture";
import { renewPortalSession } from "../fixtures/auth.fixture";
import { AejsOperationConditionsPage } from "../pages/aejs/aejs-operation-conditions.page";
import { AejsOperationsPage } from "../pages/aejs/aejs-operations.page";
import { ProposalsPage } from "../pages/portal/proposals.page";
import {
  getGeneratedSimulationForSlot,
  markGeneratedSimulationReady,
  markGeneratedSimulationRejected,
  type GeneratedSimulationEntry,
} from "../services/generated-simulation-registry";
import { getProvisioningSlot } from "../test-data/provisioning-data";
import {
  PROVISIONING_SLOT_IDS,
  type ProvisioningSlotId,
} from "../types/provisioning";

function resolvePhaseSlot(): ProvisioningSlotId {
  const value = process.env.PORTAL_PROVISION_SLOT?.trim().toUpperCase();
  if (!value || !PROVISIONING_SLOT_IDS.includes(value as ProvisioningSlotId)) {
    throw new Error("Defina PORTAL_PROVISION_SLOT com um slot válido.");
  }

  const slotId = value as ProvisioningSlotId;
  const slot = getProvisioningSlot(slotId);
  if (slot.stateOwner !== "c6-phase-preparation" || !slot.phaseTarget) {
    throw new Error(`${slotId} não possui preparação de fase C6 configurada.`);
  }
  return slotId;
}

function assertC6HtTarget(): void {
  const profile = process.env.PW_PROFILE?.trim().toLowerCase();
  const aejsHost = new URL(process.env.AEJS_URL ?? "").host;
  const usePlatformAccess = process.env.AEJS_USE_PLATFORM_ACCESS;
  const path = process.env.AEJS_PATH?.trim() ?? "";

  if (
    profile !== "ht" ||
    aejsHost !== "c6ht.prognum.com.br" ||
    usePlatformAccess !== "true" ||
    path ||
    process.env.PORTAL_PROVISION_PROVIDER !== "c6"
  ) {
    throw new Error(
      "Preparação de fase bloqueada: use exclusivamente o perfil C6 HT.",
    );
  }
}

async function attachEntry(
  testInfo: TestInfo,
  entry: GeneratedSimulationEntry,
): Promise<void> {
  await testInfo.attach("c6-phase-preparation", {
    body: Buffer.from(JSON.stringify(entry, null, 2)),
    contentType: "application/json",
  });
}

async function expectPortalPhase(
  browser: Browser,
  entry: GeneratedSimulationEntry,
  slotId: ProvisioningSlotId,
): Promise<void> {
  const protocol = entry.protocol;
  if (!protocol) {
    throw new Error(`${slotId} não possui operação registrada.`);
  }

  const runtime = loadPortalRuntimeConfig({
    ...process.env,
    PORTAL_TEST_CPF: entry.applicant.cpfDigits,
    PORTAL_MASS_OPERATION_CPFS_JSON: JSON.stringify({
      [protocol]: entry.applicant.cpfDigits,
    }),
  });
  const context = await browser.newContext({
    baseURL: runtime.portalUrl,
    storageState: { cookies: [], origins: [] },
  });

  try {
    await renewPortalSession(context, runtime, {
      cpf: entry.applicant.cpfDigits,
      persist: false,
    });
    const page = await context.newPage();
    const proposals = new ProposalsPage(page, runtime.paths.proposals);
    await proposals.open();
    await proposals.loadAll();

    const card = proposals.getProposalCard(protocol);
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();

    if (slotId === "CREDIT_REJECTED") {
      await expect(card).toContainText(/Cr[eé]dito Reprovado/i);
      await expect(
        card.getByText(
          /Verifique seu e-mail ou entre em contato com o consultor/i,
        ),
      ).toBeVisible();
      await expect(
        card.getByRole("button", { name: /Completar cadastro/i }),
      ).toHaveCount(0);
      return;
    }

    if (slotId === "CREDIT_APPROVED") {
      await expect(card).toContainText(/Etapa Conclu[ií]da/i);
      await expect(card).toContainText(/Fase Atual\s*Cadastro/i);
      await expect(
        card.getByText(
          /Cadastro conclu[ií]do! Aguarde nosso contato por e-mail ou WhatsApp\./i,
        ),
      ).toBeVisible();
      return;
    }

    throw new Error(`${slotId} não possui contrato funcional no Portal.`);
  } finally {
    await context.close();
  }
}

test(
  "C6 HT | altera e comprova a fase da proposta dedicada",
  { tag: ["@provisioning", "@mutation"] },
  async ({ aejsPage, browser }, testInfo) => {
    assertC6HtTarget();
    const slotId = resolvePhaseSlot();
    const slot = getProvisioningSlot(slotId);
    const target = slot.phaseTarget!;
    let entry = await getGeneratedSimulationForSlot(slotId);
    if (!entry?.protocol) {
      throw new Error(
        `${slotId} precisa ser criado pelo provisionador-base antes da fase ${target.code}.`,
      );
    }

    try {
      const operations = new AejsOperationsPage(aejsPage);
      const conditions = new AejsOperationConditionsPage(aejsPage);

      await test.step(`abre a operação ${entry.protocol}`, async () => {
        await operations.navigateToOperations();
        await operations.openOperationEventually(entry!.protocol!);
        await expect(operations.openedOperationNumber).toHaveValue(
          entry!.protocol!,
        );
      });

      await test.step(
        `aplica a fase ${target.code} — ${target.label}`,
        async () => {
          await conditions.open();
          await conditions.changeCurrentPhase(target);
        },
      );

      await test.step("reabre e comprova a fase persistida", async () => {
        await operations.navigateToOperations();
        await operations.openOperationEventually(entry!.protocol!);
        await conditions.open();
        await conditions.expectCurrentPhase(target);
      });

      await test.step("comprova o reflexo funcional no Portal", async () => {
        await expectPortalPhase(browser, entry!, slotId);
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
