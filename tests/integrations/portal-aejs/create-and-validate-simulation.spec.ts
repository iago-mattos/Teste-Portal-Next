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
import { getDigitalMortgageSimulation } from "../../test-data/simulator-data";
import { getProvisioningSlot } from "../../test-data/provisioning-data";
import {
  PROVISIONING_SLOT_IDS,
  type ProvisioningSlotId,
} from "../../types/provisioning";

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

function assertEsteiraHtProvisioningTarget(): void {
  const portalHost = new URL(process.env.PORTAL_URL ?? "").host;
  const aejsHost = new URL(process.env.AEJS_URL ?? "").host;
  const usePlatformAccess = process.env.AEJS_USE_PLATFORM_ACCESS;
  const path = process.env.AEJS_PATH?.trim() ?? "";

  if (portalHost !== "portal-desenv.prognum.com.br") {
    throw new Error(
      `Provisionamento bloqueado: PORTAL_URL aponta para ${portalHost || "host vazio"}.`,
    );
  }
  if (aejsHost !== "esteiradigital-ht.prognum.com.br") {
    throw new Error(
      `Provisionamento bloqueado: AEJS_URL aponta para ${aejsHost || "host vazio"}.`,
    );
  }
  if (usePlatformAccess !== "false" || path) {
    throw new Error(
      "Provisionamento bloqueado: a EsteiraHT exige login direto, AEJS_USE_PLATFORM_ACCESS=false e AEJS_PATH vazio.",
    );
  }
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
    const reservation = await reserveProvisioningSlot(slotId, scenario);
    const simulator = new PortalSimulatorPage(page);
    let generatedEntry = reservation;

    await test.step("cria a proposta pelo simulador", async () => {
      if (!generatedEntry.protocol) {
        try {
          await simulator.open();
          await simulator.startNewSimulation();
          await simulator.chooseJourney(scenario.journey);

          await test.step("rejeita letras nos campos numéricos", async () => {
            const numericInputs = [
              simulator.propertyValueInput,
              simulator.financingValueInput,
              simulator.customTermInput,
              simulator.birthDateInput,
              simulator.netIncomeInput,
            ] as const;

            for (const input of numericInputs) {
              await input.clear();
              const valueBeforeLetters = await input.inputValue();
              await input.pressSequentially("abc");
              await expect(input).toHaveValue(valueBeforeLetters);
            }
          });

          await simulator.fillSimulationData(scenario.financial);
          await simulator.continueToInsurers();
          await simulator.selectInsurer(scenario.insurer);
          await simulator.continueToResult();
          await simulator.continueToApplicantData();
          await simulator.fillApplicantData(reservation.applicant);

          const protocol = await simulator.submitProposal();
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

    generatedEntry = await markGeneratedSimulationValidated(reservation.id);
    if (slot.stateOwner === "provisioner") {
      generatedEntry = await markGeneratedSimulationReady(reservation.id);
    }
    await attachGeneratedSimulation(testInfo, generatedEntry);
  },
);
