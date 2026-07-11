import { expect, type Page, type Response } from "@playwright/test";
import { test } from "../../fixtures/test";
import type { ProposalPage } from "../../pages/portal/proposal.page";
import { getIntegrationPreparationScenario } from "../../test-data/integration-data";

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
): Promise<void> {
  const field = proposalPage.getVisibleFieldByName(name);
  await expect(field).toBeVisible();
  await field.fill(value);
  await field.blur();
}

async function selectSearchableOption(
  proposalPage: ProposalPage,
  fieldName: string,
  option: string,
): Promise<void> {
  await proposalPage.getVisibleSearchableCombobox(fieldName).selectOption(option);
}

async function saveAndAdvance(
  page: Page,
  proposalPage: ProposalPage,
  operationNumber: string,
  nextTab: "Composição de Renda" | "Motivo da Contratação" | "Imóvel",
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

test(
  "Portal → AEJS | prepara e confirma a operação de workflow",
  integrationMutation,
  async ({ page, proposalPage }) => {
    const scenario = getIntegrationPreparationScenario(
      "INT-CONFIRM-WORKFLOW",
    );
    const { applicant, creditPurpose, property } = scenario.preparation;

    await test.step("abre a proposta descartável de workflow", async () => {
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

    await test.step("define composição de renda como Não", async () => {
      const incomeCompositionGroup = page.getByRole("radiogroup", {
        name: "Você vai compor renda com mais alguém nesta operação?",
        exact: true,
      });
      const noCompositionOption = incomeCompositionGroup.getByRole("radio", {
        name: "Não",
        exact: true,
      });
      await noCompositionOption.check();
      await expect(noCompositionOption).toBeChecked();
      await saveAndAdvance(
        page,
        proposalPage,
        scenario.operationNumber,
        "Motivo da Contratação",
      );
    });

    await test.step("preenche o motivo próprio do workflow", async () => {
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

    await test.step("preenche o imóvel sem garantidor ou interveniente", async () => {
      await selectSearchableOption(
        proposalPage,
        "IMOVEL_OPERACAO.IN_USO_DO_IMOVEL",
        property.use,
      );
      await proposalPage
        .getVisibleFieldByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL")
        .selectOption(property.type);
      await proposalPage
        .getVisibleFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL")
        .selectOption(property.condition);
      await expect(
        proposalPage.getVisibleFieldByName("IMOVEL_OPERACAO.NO_ENDERECO"),
      ).toHaveValue(/\d+/);
      await expect(proposalPage.tabs.getTabButton("Imóvel")).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    await test.step("confirma o workflow na aba Imóvel", async () => {
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
      const requiresDialogConfirmation = await Promise.race([
        advanceDialog
          .waitFor({ state: "visible", timeout: 60_000 })
          .then(() => true),
        finalizeResponsePromise.then(() => false),
      ]);

      if (requiresDialogConfirmation) {
        await advanceDialog
          .getByRole("button", { name: "Confirmar", exact: true })
          .click();
      }

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
