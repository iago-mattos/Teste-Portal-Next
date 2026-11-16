import type { TestInfo } from "@playwright/test";
import { aejsTest as test, expect } from "../fixtures/aejs/aejs.fixture";
import {
  renewPortalSession,
  restorePortalOperationSession,
} from "../fixtures/auth.fixture";
import { AejsEsteiraHtSimulationPage } from "../pages/aejs/aejs-esteira-ht-simulation.page";
import { AejsOperationsPage } from "../pages/aejs/aejs-operations.page";
import { ProposalsPage } from "../pages/portal/proposals.page";
import {
  getGeneratedSimulationForSlot,
  markGeneratedSimulationPortalListValidated,
  markGeneratedSimulationRejected,
  markGeneratedSimulationSubmissionStarted,
  markGeneratedSimulationSubmitted,
  markGeneratedSimulationValidated,
  reserveProvisioningSlot,
  type GeneratedSimulationEntry,
} from "../services/generated-simulation-registry";
import { getDigitalMortgageSimulation } from "../test-data/simulator-data";
import { getProvisioningSlot } from "../test-data/provisioning-data";
import {
  PROVISIONING_SLOT_IDS,
  type ProvisioningSlotId,
} from "../types/provisioning";
import { assertEsteiraHtProvisioningTarget } from "../config/esteira-ht-provisioning-target";

function resolveProvisioningSlot(): ProvisioningSlotId {
  const value = process.env.PORTAL_PROVISION_SLOT?.trim().toUpperCase();
  if (!value || !PROVISIONING_SLOT_IDS.includes(value as ProvisioningSlotId)) {
    throw new Error(
      "Defina PORTAL_PROVISION_SLOT com um slot válido antes de criar a proposta pelo SCCI.",
    );
  }
  return value as ProvisioningSlotId;
}

async function attachEntry(
  testInfo: TestInfo,
  entry: GeneratedSimulationEntry,
): Promise<void> {
  await testInfo.attach("esteira-ht-scci-shared", {
    body: Buffer.from(JSON.stringify(entry, null, 2)),
    contentType: "application/json",
  });
}

test(
  "SCCI EsteiraHT | cria TIMELINE_DOCUMENTS com o CPF compartilhado de DEFAULT",
  { tag: ["@provisioning", "@mutation"] },
  async ({ page, aejsPage, portalConfig }, testInfo) => {
    test.skip(
      process.env.PW_PROFILE !== "esteira-ht",
      "Exceção exclusiva do perfil EsteiraHT.",
    );
    assertEsteiraHtProvisioningTarget();

    const slotId = resolveProvisioningSlot();
    const slot = getProvisioningSlot(slotId);
    if (slotId !== "TIMELINE_DOCUMENTS") {
      throw new Error(
        `A exceção scci-shared é exclusiva de TIMELINE_DOCUMENTS, não de ${slotId}.`,
      );
    }
    if (slot.creationMode !== "scci-shared") {
      throw new Error(
        `${slot.id} não usa o fluxo excepcional scci-shared; use o provisionador padrão (simulador React).`,
      );
    }
    if (!slot.sharedCpfWith) {
      throw new Error(`${slot.id} precisa declarar sharedCpfWith no catálogo.`);
    }
    if (slot.applicantName !== "Playwright BASE 02") {
      throw new Error(
        `TIMELINE_DOCUMENTS deve usar o nome controlado Playwright BASE 02; encontrado: ${slot.applicantName}.`,
      );
    }

    const sharedSlotId = slot.sharedCpfWith;
    const defaultEntry = await getGeneratedSimulationForSlot(sharedSlotId);
    if (!defaultEntry?.protocol) {
      throw new Error(
        `${sharedSlotId} precisa ser criado (com protocolo real) antes de ${slot.id} compartilhar seu CPF.`,
      );
    }

    const scenario = getDigitalMortgageSimulation();
    let entry = await reserveProvisioningSlot(slotId, scenario);
    if (entry.applicant.cpfDigits !== defaultEntry.applicant.cpfDigits) {
      throw new Error(
        `${slot.id} não está com o CPF de ${sharedSlotId} no lote ativo.`,
      );
    }

    try {
      if (!entry.protocol) {
        await test.step(
          "cria a proposta no simulador interno do SCCI EsteiraHT",
          async () => {
            const simulation = new AejsEsteiraHtSimulationPage(aejsPage);
            await simulation.open();

            // Nunca calcula ou prevê o próximo protocolo: apenas o valor real
            // devolvido pelo SCCI após gravar a proposta é aceito.
            const operation = await simulation.createProposal(
              scenario,
              entry.applicant,
              {
                confirmExistingCpfProposal: true,
                excludedOperations: [defaultEntry.protocol!],
                beforeFinalSubmission: async () => {
                  entry = await markGeneratedSimulationSubmissionStarted(
                    entry.id,
                  );
                  await attachEntry(testInfo, entry);
                },
              },
            );

            if (operation === defaultEntry.protocol) {
              throw new Error(
                `O SCCI devolveu o mesmo protocolo de ${sharedSlotId} (${operation}); ` +
                  "nenhuma operação nova foi criada.",
              );
            }

            entry = await markGeneratedSimulationSubmitted(entry.id, operation);
            await attachEntry(testInfo, entry);
          },
        );
      }

      const protocol = entry.protocol;
      if (!protocol) {
        throw new Error(
          `${slot.id} foi processado sem receber um protocolo real do SCCI.`,
        );
      }

      if (!entry.scciValidatedAt) {
        await test.step(
          "valida a operação criada por nova leitura no SCCI",
          async () => {
            const operations = new AejsOperationsPage(aejsPage);
            await operations.navigateToOperations();
            await operations.openOperationEventually(protocol);
            await expect(operations.openedOperationNumber).toHaveValue(protocol);
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

            entry = await markGeneratedSimulationValidated(entry.id);
            await attachEntry(testInfo, entry);
          },
        );
      }

      if (!entry.portalListValidatedAt) {
        await test.step(
          "comprova no Portal que DEFAULT e TIMELINE_DOCUMENTS são propostas distintas",
          async () => {
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

            const proposalsPage = new ProposalsPage(
              page,
              portalConfig.paths.proposals,
            );
            await proposalsPage.open();
            await proposalsPage.loadAll();

            await expect(
              proposalsPage.getProposalCard(defaultEntry.protocol!),
            ).toHaveCount(1);
            await expect(proposalsPage.getProposalCard(protocol)).toHaveCount(1);
            expect(protocol).not.toBe(defaultEntry.protocol);

            entry = await markGeneratedSimulationPortalListValidated(entry.id);
            await attachEntry(testInfo, entry);
          },
        );
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
