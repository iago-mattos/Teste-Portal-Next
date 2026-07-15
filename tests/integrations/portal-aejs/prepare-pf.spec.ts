import { expect, type Page, type Response } from "@playwright/test";
import { test } from "../../fixtures/test";
import type { ProposalPage } from "../../pages/portal/proposal.page";
import {
  getIntegrationPreparationScenario,
  type PfGuarantorInput,
  type ThirdPartyInput,
} from "../../test-data/integration-data";

const integrationMutation = { tag: ["@integration", "@mutation"] };
test.use({ skipPortalSessionBootstrap: true });

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
): Promise<void> {
  const field = proposalPage.getVisibleFieldByName(name);
  await expect(field).toBeVisible();
  await field.fill(value);
  await field.blur();
}

async function saveAndAdvance(
  page: Page,
  proposalPage: ProposalPage,
  operationNumber: string,
  nextTab: "Composição de Renda" | "Motivo da Contratação" | "Imóvel" | "Garantidor",
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
  await expect(proposalPage.tabs.getTabButton(nextTab)).toHaveAttribute(
    "aria-selected",
    "true",
  );
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

async function fillThirdParty(
  proposalPage: ProposalPage,
  thirdParty: ThirdPartyInput,
): Promise<void> {
  await fillField(proposalPage, "PESSOA.NO_PESSOA", thirdParty.name);
  await fillField(proposalPage, "PESSOA.NU_CPFCNPJ", thirdParty.cpf);
  await fillField(proposalPage, "PESSOA.DT_NASCIMENTO", thirdParty.dateOfBirth);
  await fillField(proposalPage, "PESSOA.VA_RENDA_BRUTA", thirdParty.grossIncome);
  await selectSearchableOption(
    proposalPage,
    "PESSOA.CO_PROFISSAO",
    thirdParty.profession,
  );
  await proposalPage
    .getVisibleFieldByName("PESSOA.CO_ATIVIDADE_PROFISSIONAL")
    .selectOption(thirdParty.professionalActivity);
  await fillField(proposalPage, "PESSOA.NU_DDD_CEL", thirdParty.mobileAreaCode);
  await fillField(proposalPage, "PESSOA.NU_CELULAR", thirdParty.mobileNumber);
  await fillField(proposalPage, "PESSOA.NO_EMAIL", thirdParty.email);
}

async function fillPfGuarantor(
  proposalPage: ProposalPage,
  guarantor: PfGuarantorInput,
): Promise<void> {
  await fillField(proposalPage, "PESSOA.NO_PESSOA", guarantor.name);
  await fillField(proposalPage, "PESSOA.NU_CPFCNPJ", guarantor.cpf);
  await proposalPage
    .getVisibleFieldByName("PESSOA.CO_ESTCIV")
    .selectOption(guarantor.maritalStatus);
  await fillField(proposalPage, "PESSOA.DT_NASCIMENTO", guarantor.dateOfBirth);
  await fillField(proposalPage, "PESSOA.NU_DDD_CEL", guarantor.mobileAreaCode);
  await fillField(proposalPage, "PESSOA.NU_CELULAR", guarantor.mobileNumber);
  await fillField(proposalPage, "PESSOA.NO_EMAIL", guarantor.email);
  await fillField(proposalPage, "PESSOA.NU_CEP", guarantor.address.postalCode);
  await expect(
    proposalPage.getVisibleFieldByName("PESSOA.NO_ENDERECO"),
  ).toHaveValue(/.+/, { timeout: 30_000 });
  await fillField(
    proposalPage,
    "PESSOA.NO_BAIRRO",
    guarantor.address.neighborhood,
  );
  await fillField(
    proposalPage,
    "PESSOA.NU_APTO",
    guarantor.address.streetNumber,
  );
  await fillField(
    proposalPage,
    "PESSOA.NO_COMPLEMENTO",
    guarantor.address.complement,
  );
  await expect(proposalPage.getVisibleFieldByName("PESSOA.CO_UF")).toHaveValue(
    /.+/,
    { timeout: 30_000 },
  );
  await expect(
    proposalPage.getVisibleFieldByName("PESSOA.CO_MUNICIPIO"),
  ).toHaveValue(/.+/, { timeout: 30_000 });
}

test(
  "Portal → AEJS | prepara e confirma a operação PF descartável",
  integrationMutation,
  async ({ page, proposalPage, portalSession }) => {
    const scenario = getIntegrationPreparationScenario("INT-CONFIRM-PF");
    await portalSession.useOperation(scenario.operationNumber);
    const { applicant, thirdParty, creditPurpose, property, guarantor } =
      scenario.preparation;

    await test.step("abre a proposta descartável", async () => {
      await proposalPage.open(scenario.operationNumber);
    });

    await test.step("preenche titular sem cônjuge", async () => {
      await fillField(
        proposalPage,
        "PESSOA.VA_RENDA_BRUTA",
        applicant.grossIncome,
      );
      await proposalPage
        .getVisibleFieldByName("PESSOA.CO_ESTCIV")
        .selectOption(applicant.maritalStatus);
      await selectSearchableOption(
        proposalPage,
        "PESSOA.CO_NACIONALIDADE",
        applicant.nationality,
      );
      await selectSearchableOption(
        proposalPage,
        "PESSOA.CO_UFNASC",
        applicant.birthState,
      );
      await selectSearchableOption(
        proposalPage,
        "PESSOA.CO_UFIDENTIDADE",
        applicant.identityState,
      );
      await selectSearchableOption(
        proposalPage,
        "PESSOA.CO_PROFISSAO",
        applicant.profession,
      );
      await selectSearchableOption(
        proposalPage,
        "PESSOA.CO_ATIVIDADE_PROFISSIONAL",
        applicant.professionalActivity,
      );
      await proposalPage
        .getVisibleFieldByName("PESSOA.IN_RESIDE_NO_IMOVEL")
        .selectOption(applicant.livesInProperty);
      await saveAndAdvance(
        page,
        proposalPage,
        scenario.operationNumber,
        "Composição de Renda",
      );
    });

    await test.step("preenche terceiro na composição de renda", async () => {
      const incomeCompositionGroup = page.getByRole("radiogroup", {
        name: "Você vai compor renda com mais alguém nesta operação?",
        exact: true,
      });
      await incomeCompositionGroup
        .getByRole("radio", { name: "Sim", exact: true })
        .check();
      await page
        .getByRole("radio", { name: "Outra Pessoa", exact: true })
        .check();
      await fillThirdParty(proposalPage, thirdParty);
      await page
        .getByRole("checkbox", {
          name: "Autorizo a consulta de dados dos demais participantes no Sistema de Informações de Crédito (SCR) e demais instituições de proteção a fraudes, lavagem de dinheiro e risco de crédito",
          exact: true,
        })
        .check();
      await saveAndAdvance(
        page,
        proposalPage,
        scenario.operationNumber,
        "Motivo da Contratação",
      );
    });

    await test.step("preenche motivo da contratação", async () => {
      await proposalPage
        .getVisibleFieldByName("CO_MOTIVO_EMPRESTIMO")
        .selectOption(creditPurpose.purpose);
      await fillField(
        proposalPage,
        "OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO",
        creditPurpose.description,
      );
      await saveAndAdvance(
        page,
        proposalPage,
        scenario.operationNumber,
        "Imóvel",
      );
    });

    await test.step("preenche imóvel de terceiro alienado", async () => {
      await proposalPage.selectVisibleOption(
        "IMOVEL_OPERACAO.IN_USO_DO_IMOVEL",
        property.use,
      );
      await proposalPage
        .getVisibleFieldByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL")
        .selectOption(property.type);
      await proposalPage
        .getVisibleFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL")
        .selectOption(property.condition);
      await fillField(
        proposalPage,
        "OPERACAO_CREDITO.VA_INTERVENIENTE",
        property.outstandingBalance,
      );
      await selectSearchableOption(
        proposalPage,
        "INTERVENIENTE.CODIGO",
        property.settlementIntervenor,
      );
      await expect(
        proposalPage.getVisibleFieldByName("IMOVEL_OPERACAO.NO_ENDERECO"),
      ).toHaveValue(/\d+/);
      await saveByOpeningTab(
        page,
        proposalPage,
        scenario.operationNumber,
        "Garantidor",
      );
    });

    await test.step("preenche garantidor PF", async () => {
      await fillPfGuarantor(proposalPage, guarantor);
      await saveByOpeningTab(
        page,
        proposalPage,
        scenario.operationNumber,
        "Imóvel",
      );
      await saveAndAdvance(
        page,
        proposalPage,
        scenario.operationNumber,
        "Garantidor",
      );
      await expect(
        proposalPage.tabs.getTabButton("Garantidor"),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        proposalPage.getVisibleFieldByName("PESSOA.NO_PESSOA"),
      ).toHaveValue(guarantor.name);
    });

    await test.step("confirma o cadastro na aba Garantidor PF", async () => {
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
      await expect(advanceDialog).toBeVisible({ timeout: 30_000 });
      await advanceDialog
        .getByRole("button", { name: "Confirmar", exact: true })
        .click();

      const finalizeResponse = await finalizeResponsePromise;
      expect(finalizeResponse.status()).toBe(200);
      await expect(finalizeResponse.json()).resolves.toMatchObject({
        sucesso: true,
      });
      await expect(
        page.getByText(/Etapa concluída|Cadastro concluído|sucesso/i),
      ).toBeVisible({ timeout: 60_000 });
    });
  },
);
