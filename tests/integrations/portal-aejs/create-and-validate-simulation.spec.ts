import type { TestInfo } from "@playwright/test";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { PortalSimulatorPage } from "../../pages/portal/portal-simulator.page";
import {
  markGeneratedSimulationSubmitted,
  markGeneratedSimulationValidated,
  markGeneratedSimulationReady,
  markGeneratedSimulationRejected,
  reserveProvisioningSlot,
  type GeneratedSimulationEntry,
} from "../../services/generated-simulation-registry";
import {
  getDigitalMortgageSimulation,
  SIMULATOR_INITIAL_PROCESS_STATE,
} from "../../test-data/simulator-data";
import { getProvisioningSlot } from "../../test-data/provisioning-data";
import {
  PROVISIONING_SLOT_IDS,
  type ProvisioningSlotId,
} from "../../types/provisioning";
import { assertEsteiraHtProvisioningTarget } from "../../config/esteira-ht-provisioning-target";

function resolveProvisioningSlot(): ProvisioningSlotId {
  const value =
    process.env.PORTAL_PROVISION_SLOT?.trim().toUpperCase() || "RESERVE";
  if (!PROVISIONING_SLOT_IDS.includes(value as ProvisioningSlotId)) {
    throw new Error(
      "Defina PORTAL_PROVISION_SLOT com um slot válido antes de criar a proposta.",
    );
  }
  return value as ProvisioningSlotId;
}

function formatCurrencyFromCents(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) / 100);
}

const scciMonthNames = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

function formatScciDate(value: string): string {
  const day = value.slice(0, 2);
  const month = scciMonthNames[Number(value.slice(2, 4)) - 1];
  const year = value.slice(4, 8);
  if (!day || !month || year.length !== 4) {
    throw new Error(`Data do simulador inválida: ${value}`);
  }

  return `${day}/${month}/${year}`;
}

async function expectDigits(
  operationsPage: AejsOperationsPage,
  fieldName: string,
  expected: string,
): Promise<void> {
  const actual = await operationsPage.getVisibleField(fieldName).inputValue();
  expect(actual.replace(/\D/g, "")).toBe(expected.replace(/\D/g, ""));
}

async function attachGeneratedSimulation(
  testInfo: TestInfo,
  entry: GeneratedSimulationEntry,
): Promise<void> {
  await testInfo.attach("generated-simulation", {
    body: Buffer.from(JSON.stringify(entry, null, 2)),
    contentType: "application/json",
  });
}

test(
  "Simulador → SCCI | cria uma proposta e valida os dados integrados",
  { tag: ["@integration", "@mutation"] },
  async ({ page, openAuthenticatedAejsPage }, testInfo) => {
    test.skip(
      process.env.PW_PROFILE !== "esteira-ht",
      "Provisionamento exclusivo do perfil EsteiraHT.",
    );
    assertEsteiraHtProvisioningTarget();

    const scenario = getDigitalMortgageSimulation();
    const slotId = resolveProvisioningSlot();
    const slot = getProvisioningSlot(slotId);
    if (slot.creationMode === "scci-shared") {
      throw new Error(
        `${slotId} usa CPF compartilhado e não pode ser criado pelo simulador React ` +
          "— a execução real comprovou que o Portal recusa a segunda proposta. Use " +
          "scripts/run-esteira-ht-scci-shared-creation.mjs (ou o dispatcher do lote).",
      );
    }
    const reservation = await reserveProvisioningSlot(slotId, scenario);
    const simulator = new PortalSimulatorPage(page);
    let generatedEntry = reservation;

    await test.step("cria a proposta pelo simulador", async () => {
      if (!generatedEntry.protocol) {
        try {
          const protocol = await simulator.completeSimulation(
            scenario,
            reservation.applicant,
          );
          generatedEntry = await markGeneratedSimulationSubmitted(
            reservation.id,
            protocol,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Falha desconhecida";
          generatedEntry = await markGeneratedSimulationRejected(
            reservation.id,
            message,
          );
          await attachGeneratedSimulation(testInfo, generatedEntry);
          throw error;
        }
      }

      await attachGeneratedSimulation(testInfo, generatedEntry);
    });

    const protocol = generatedEntry.protocol;
    if (!protocol) {
      throw new Error("A proposta foi enviada sem protocolo para validação no SCCI.");
    }
    const aejsPage = await openAuthenticatedAejsPage();
    const operationsPage = new AejsOperationsPage(aejsPage);

    await test.step("aguarda e abre a mesma operação no SCCI", async () => {
      await operationsPage.navigateToOperations();
      await operationsPage.openOperationEventually(protocol);

      await expect(operationsPage.openedOperationNumber).toHaveValue(protocol);
      await expect(operationsPage.openedTerm).toHaveValue(
        String(scenario.financial.termMonths),
      );
    });

    await test.step("valida os dados pessoais e de contato do pretendente", async () => {
      await operationsPage.openPrimaryApplicant(reservation.applicant.name);

      await expect(
        operationsPage.getVisibleField("PESSOA$NO_PESSOA"),
      ).toHaveValue(reservation.applicant.name);
      await expectDigits(
        operationsPage,
        "PESSOA$NU_CPFCNPJ",
        reservation.applicant.cpfDigits,
      );
      await expect(
        operationsPage.getVisibleField("PESSOA$DT_NASCIMENTO"),
      ).toHaveValue(formatScciDate(scenario.financial.birthDateDigits));

      await operationsPage.selectVisibleTab("Dados de Contato");
      await expect(
        operationsPage.getVisibleField("PESSOA$NU_DDD_CEL"),
      ).toHaveValue(reservation.applicant.mobileDigits.slice(0, 2));
      await expectDigits(
        operationsPage,
        "PESSOA$NU_CELULAR",
        reservation.applicant.mobileDigits.slice(2),
      );
      await expect(
        operationsPage.getVisibleField("PESSOA$NO_EMAIL"),
      ).toHaveValue(reservation.applicant.email.toLowerCase());
      await operationsPage.closeCurrentWindow();
    });

    await test.step("valida os dados integrados da simulação", async () => {
      await operationsPage.openSimulation();

      const expectedFields: ReadonlyArray<readonly [string, string]> = [
        [
          "Modalidade de financiamento:",
          scenario.scciReflection.financingModality,
        ],
        ["Produto:", scenario.journey.modality],
        ["Comprador:", scenario.journey.borrowerType],
        ["Tipo do imóvel:", scenario.journey.propertyType],
        ["Origem do Imóvel:", scenario.journey.propertyOrigin],
        ["Índice de correção:", scenario.journey.indexer],
        ["Condições:", scenario.scciReflection.conditions],
        [
          "Data de nascimento:",
          formatScciDate(scenario.financial.birthDateDigits),
        ],
        ["Renda:", formatCurrencyFromCents(scenario.financial.netIncomeCents)],
        [
          "Renda Familiar:",
          formatCurrencyFromCents(scenario.scciReflection.familyIncomeCents),
        ],
        [
          "Valor de compra e venda:",
          formatCurrencyFromCents(scenario.financial.propertyValueCents),
        ],
        [
          "Valor estimado/avaliação do imóvel:",
          formatCurrencyFromCents(scenario.financial.propertyValueCents),
        ],
        [
          "Valor Pretendido do Financiamento de Construção:",
          formatCurrencyFromCents(
            scenario.scciReflection.constructionFinancingValueCents,
          ),
        ],
        [
          "Valor financiamento imobiliário:",
          formatCurrencyFromCents(scenario.financial.financingValueCents),
        ],
        ["Sistema amortização:", scenario.scciReflection.amortizationSystem],
        ["Seguradora do financiamento:", scenario.insurer],
      ];

      for (const [label, expectedValue] of expectedFields) {
        const control = operationsPage.getVisibleControlByLabel(label);
        await expect(control).toBeVisible();
        await expect
          .poll(async () => (await control.inputValue()).trim())
          .toBe(expectedValue);
      }
    });

    await test.step("valida a fase inicial e o andamento do processo", async () => {
      await operationsPage.openProcessProgress();

      for (const task of SIMULATOR_INITIAL_PROCESS_STATE.tasks) {
        const row = operationsPage.getProcessTaskRow(task.code);
        await expect(row).toHaveCount(1);
        await expect(
          row.getByRole("gridcell", { name: task.title, exact: true }),
        ).toBeVisible();
        await expect(
          row.getByRole("gridcell", { name: task.status, exact: true }),
        ).toBeVisible();
      }
      // Somente as tarefas esperadas: a criação não pode avançar o fluxo nem duplicá-lo.
      await expect(
        operationsPage.processProgressGrid.getByRole("row"),
      ).toHaveCount(SIMULATOR_INITIAL_PROCESS_STATE.tasks.length + 1);
      await expect(operationsPage.openedCurrentPhase).toHaveValue(
        SIMULATOR_INITIAL_PROCESS_STATE.phase,
      );
    });

    generatedEntry = await markGeneratedSimulationValidated(reservation.id);
    if (slot.stateOwner === "provisioner") {
      generatedEntry = await markGeneratedSimulationReady(reservation.id);
    }
    await attachGeneratedSimulation(testInfo, generatedEntry);
  },
);
