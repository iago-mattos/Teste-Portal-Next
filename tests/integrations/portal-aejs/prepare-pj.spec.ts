import { expect, type Page, type Response } from "@playwright/test";
import { test } from "../../fixtures/test";
import type { ProposalPage } from "../../pages/portal/proposal.page";
import {
  getIntegrationPreparationScenario,
  type GuarantorPartnerInput,
  type PjGuarantorInput,
  type SpouseInput,
} from "../../test-data/integration-data";

const integrationMutation = { tag: ["@integration", "@mutation"] };

function isProposalTransitionResponse(
  response: Response,
  method: "PUT" | "POST",
  operationNumber: string,
  endpoint: "cadastro" | "finalizar",
): boolean {
  const url = new URL(response.url());

  return response.request().method() === method
    && url.pathname === `/api/portal/propostas/${operationNumber}/${endpoint}`;
}

async function fillField(
  proposalPage: ProposalPage,
  name: string,
  value: string,
  index = 0,
): Promise<void> {
  const field = proposalPage.getVisibleFieldByName(name).nth(index);
  await expect(field).toBeVisible();
  await field.fill(value);
  await field.blur();
}

async function saveAndAdvance(
  page: Page,
  proposalPage: ProposalPage,
  operationNumber: string,
  nextTab: "Cônjuge" | "Composição de Renda" | "Motivo da Contratação" | "Imóvel" | "Garantidor",
): Promise<void> {
  const advanceButton = page.getByRole("button", {
    name: "Confirmar e avançar cadastro",
    exact: true,
  });
  const saveResponsePromise = page.waitForResponse(
    (response) => isProposalTransitionResponse(
      response,
      "PUT",
      operationNumber,
      "cadastro",
    ),
    { timeout: 30_000 },
  );

  await advanceButton.click();

  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  await expect(proposalPage.tabs.getTabButton(nextTab)).toHaveAttribute("aria-selected", "true");
}

async function saveByOpeningTab(
  page: Page,
  proposalPage: ProposalPage,
  operationNumber: string,
  tab: "Imóvel" | "Garantidor",
): Promise<void> {
  const saveResponsePromise = page.waitForResponse(
    (response) => isProposalTransitionResponse(
      response,
      "PUT",
      operationNumber,
      "cadastro",
    ),
    { timeout: 30_000 },
  );

  await proposalPage.tabs.select(tab);

  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
}

async function selectSearchableOption(
  proposalPage: ProposalPage,
  fieldName: string,
  option: string,
): Promise<void> {
  await proposalPage.getVisibleSearchableCombobox(fieldName).selectOption(option);
}

async function fillSpouse(
  proposalPage: ProposalPage,
  spouse: SpouseInput,
): Promise<void> {
  await fillField(proposalPage, "CONJUGE.NO_PESSOA", spouse.name);
  await fillField(proposalPage, "CONJUGE.NU_CPFCNPJ", spouse.cpf);
  await fillField(proposalPage, "CONJUGE.DT_NASCIMENTO", spouse.dateOfBirth);
  await selectSearchableOption(proposalPage, "CONJUGE.CO_NACIONALIDADE", spouse.nationality);
  await selectSearchableOption(proposalPage, "CONJUGE.CO_UFNASC", spouse.birthState);
  await selectSearchableOption(proposalPage, "CONJUGE.CO_UFIDENTIDADE", spouse.identityState);
  await fillField(proposalPage, "PESSOA.DT_CASAMENTO", spouse.marriageDate);
  await selectSearchableOption(proposalPage, "PESSOA.CO_REGIME_CASAMENTO", spouse.marriageRegime);
  await fillField(proposalPage, "CONJUGE.NU_DDD_CEL", spouse.mobileAreaCode);
  await fillField(proposalPage, "CONJUGE.NU_CELULAR", spouse.mobileNumber);
  await fillField(proposalPage, "CONJUGE.NO_EMAIL", spouse.email);
}

async function fillPartner(
  proposalPage: ProposalPage,
  partner: GuarantorPartnerInput,
  index: number,
): Promise<void> {
  await fillField(proposalPage, "NO_PESSOA", partner.name, index);
  await fillField(proposalPage, "NU_CPFCNPJ", partner.cpf, index);
  await fillField(proposalPage, "DT_NASCIMENTO", partner.dateOfBirth, index);
  await fillField(proposalPage, "NU_DDD_CEL", partner.mobileAreaCode, index);
  await fillField(proposalPage, "NU_CELULAR", partner.mobileNumber, index);
  await fillField(proposalPage, "NO_EMAIL", partner.email, index);
}

async function fillPjGuarantor(
  page: Page,
  proposalPage: ProposalPage,
  guarantor: PjGuarantorInput,
): Promise<void> {
  await fillField(proposalPage, "PESSOA.NO_PESSOA", guarantor.companyName);
  await fillField(proposalPage, "PESSOA.NU_CPFCNPJ", guarantor.cnpj);
  await fillField(proposalPage, "PESSOA.DT_NASCIMENTO", guarantor.foundationDate);
  await page.getByRole("textbox", { name: "DDD opcional", exact: true }).fill(guarantor.phoneAreaCode);
  await fillField(proposalPage, "PESSOA.NU_TELEFONE_COM", guarantor.phone);
  await fillField(proposalPage, "PESSOA.NO_EMAIL", guarantor.email);
  await fillField(proposalPage, "PESSOA.NU_CEP", guarantor.address.postalCode);
  await expect(proposalPage.getVisibleFieldByName("PESSOA.NO_ENDERECO")).toHaveValue(/.+/, {
    timeout: 30_000,
  });
  await fillField(proposalPage, "PESSOA.NO_BAIRRO", guarantor.address.neighborhood);
  await fillField(proposalPage, "PESSOA.NU_APTO", guarantor.address.streetNumber);
  await fillField(proposalPage, "PESSOA.NO_COMPLEMENTO", guarantor.address.complement);
  await expect(proposalPage.getVisibleFieldByName("PESSOA.CO_UF")).toHaveValue(/.+/, {
    timeout: 30_000,
  });
  await expect(proposalPage.getVisibleFieldByName("PESSOA.CO_MUNICIPIO")).toHaveValue(/.+/, {
    timeout: 30_000,
  });

  const partnerNameFields = proposalPage.getVisibleFieldByName("NO_PESSOA");
  if (await partnerNameFields.count() < 2) {
    await page.getByRole("button", { name: /adicionar.*sócio/i }).click();
  }
  await expect(partnerNameFields).toHaveCount(2);
  await fillPartner(proposalPage, guarantor.partners[0], 0);
  await fillPartner(proposalPage, guarantor.partners[1], 1);
}

test(
  "Portal → AEJS | prepara e confirma a operação PJ descartável",
  integrationMutation,
  async ({ page, proposalPage }) => {
    const scenario = getIntegrationPreparationScenario("INT-CONFIRM-PJ");
    const { applicant, spouse, creditPurpose, property, guarantor } = scenario.preparation;

    await test.step("abre a proposta descartável", async () => {
      await proposalPage.open(scenario.operationNumber);
    });

    await test.step("preenche titular", async () => {
      await fillField(proposalPage, "PESSOA.VA_RENDA_BRUTA", applicant.grossIncome);
      await proposalPage.getVisibleFieldByName("PESSOA.CO_ESTCIV").selectOption(applicant.maritalStatus);
      await selectSearchableOption(proposalPage, "PESSOA.CO_NACIONALIDADE", applicant.nationality);
      await selectSearchableOption(proposalPage, "PESSOA.CO_UFNASC", applicant.birthState);
      await selectSearchableOption(proposalPage, "PESSOA.CO_UFIDENTIDADE", applicant.identityState);
      await selectSearchableOption(proposalPage, "PESSOA.CO_PROFISSAO", applicant.profession);
      await selectSearchableOption(
        proposalPage,
        "PESSOA.CO_ATIVIDADE_PROFISSIONAL",
        applicant.professionalActivity,
      );
      await proposalPage.getVisibleFieldByName("PESSOA.IN_RESIDE_NO_IMOVEL").selectOption(applicant.livesInProperty);
      await saveAndAdvance(page, proposalPage, scenario.operationNumber, "Cônjuge");
    });

    await test.step("preenche cônjuge", async () => {
      await fillSpouse(proposalPage, spouse);
      await saveAndAdvance(page, proposalPage, scenario.operationNumber, "Composição de Renda");
    });

    await test.step("preenche composição de renda", async () => {
      await page.getByRole("radio", { name: "Sim", exact: true }).check();
      await page.getByRole("radio", { name: "Conjuge", exact: true }).check();
      await fillField(proposalPage, "CONJUGE.VA_RENDA_BRUTA", spouse.grossIncome);
      await selectSearchableOption(proposalPage, "CONJUGE.CO_PROFISSAO", spouse.profession);
      await selectSearchableOption(
        proposalPage,
        "CONJUGE.CO_ATIVIDADE_PROFISSIONAL",
        spouse.professionalActivity,
      );
      await page
        .getByRole("checkbox", {
          name: "Autorizo a consulta de dados dos demais participantes no Sistema de Informações de Crédito (SCR) e demais instituições de proteção a fraudes, lavagem de dinheiro e risco de crédito",
          exact: true,
        })
        .check();
      await saveAndAdvance(page, proposalPage, scenario.operationNumber, "Motivo da Contratação");
    });

    await test.step("preenche motivo da contratação", async () => {
      await proposalPage.getVisibleFieldByName("CO_MOTIVO_EMPRESTIMO").selectOption(creditPurpose.purpose);
      await fillField(
        proposalPage,
        "OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO",
        creditPurpose.description,
      );
      await saveAndAdvance(page, proposalPage, scenario.operationNumber, "Imóvel");
    });

    await test.step("preenche imóvel", async () => {
      await selectSearchableOption(proposalPage, "IMOVEL_OPERACAO.IN_USO_DO_IMOVEL", property.use);
      await proposalPage.getVisibleFieldByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL").selectOption(property.type);
      await proposalPage.getVisibleFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL").selectOption(property.condition);
      await fillField(proposalPage, "OPERACAO_CREDITO.VA_INTERVENIENTE", property.outstandingBalance);
      await selectSearchableOption(proposalPage, "INTERVENIENTE.CODIGO", property.settlementIntervenor);
      await expect(proposalPage.getVisibleFieldByName("IMOVEL_OPERACAO.NO_ENDERECO")).toHaveValue(/\d+/);
      await saveByOpeningTab(page, proposalPage, scenario.operationNumber, "Garantidor");
    });

    await test.step("preenche garantidor PJ e sócios", async () => {
      await fillPjGuarantor(page, proposalPage, guarantor);
      await saveByOpeningTab(page, proposalPage, scenario.operationNumber, "Imóvel");
      await saveAndAdvance(page, proposalPage, scenario.operationNumber, "Garantidor");
      await expect(proposalPage.tabs.getTabButton("Garantidor")).toHaveAttribute("aria-selected", "true");
    });

    await test.step("confirma o cadastro na aba Garantidor", async () => {
      const confirmButton = page.getByRole("button", {
        name: "Confirmar",
        exact: true,
      });
      await expect(confirmButton).toBeVisible();
      await expect(confirmButton).toBeEnabled();

      const saveResponsePromise = page.waitForResponse(
        (response) => isProposalTransitionResponse(
          response,
          "PUT",
          scenario.operationNumber,
          "cadastro",
        ),
        { timeout: 30_000 },
      );
      const finalizeResponsePromise = page.waitForResponse(
        (response) => isProposalTransitionResponse(
          response,
          "POST",
          scenario.operationNumber,
          "finalizar",
        ),
        { timeout: 60_000 },
      );

      await confirmButton.click();

      const saveResponse = await saveResponsePromise;
      expect(saveResponse.status()).toBe(200);

      const advanceDialog = page
        .getByRole("alertdialog", { name: "Confirmar", exact: true })
        .filter({ hasText: /Deseja prosseguir para a próxima fase/i });
      if (await advanceDialog.count() > 0) {
        await expect(advanceDialog).toBeVisible();
        await advanceDialog.getByRole("button", { name: "Confirmar", exact: true }).click();
      }

      const finalizeResponse = await finalizeResponsePromise;
      expect(finalizeResponse.status()).toBe(200);
      await expect(finalizeResponse.json()).resolves.toMatchObject({ sucesso: true });
      await expect(
        page.getByText(/Etapa concluída|Cadastro concluído|sucesso/i),
      ).toBeVisible({ timeout: 60_000 });
    });
  },
);
