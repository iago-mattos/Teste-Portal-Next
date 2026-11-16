import { expect, type Page, type Response } from "@playwright/test";
import type { ProposalTabName } from "../../components/portal/proposal-tabs.component";
import type {
  PfAddressInput,
  WorkflowIntegrationPreparationScenario,
} from "../../test-data/integration-data";
import type { ProposalPage } from "./proposal.page";

export interface ProposalFinalizationResponses {
  readonly saveResponse: Response;
  readonly finalizeResponse: Response;
}

export interface PropertyPostalCodeContract {
  readonly postalCode: string;
  readonly streetNumber?: string;
  readonly complement?: string;
}

export interface PersistedPropertyAddress {
  readonly postalCode: string;
  readonly addressLine: string;
  readonly state?: string;
  readonly municipality?: string;
}

/** Jornada reutilizável do Cadastro sem composição de renda ou garantidor. */
export class ProposalRegistrationPage {
  constructor(
    private readonly page: Page,
    private readonly proposalPage: ProposalPage,
  ) {}

  async fillApplicantAndAdvance(
    operationNumber: string,
    preparation: WorkflowIntegrationPreparationScenario,
  ): Promise<Response> {
    await this.ensureTabSelected(operationNumber, "Sobre Você");
    const { applicant } = preparation;

    await this.fillField("PESSOA.VA_RENDA_BRUTA", applicant.grossIncome);
    await this.proposalPage
      .getVisibleFieldByName("PESSOA.CO_ESTCIV")
      .selectOption(applicant.maritalStatus);
    await this.selectSearchableOption(
      "PESSOA.CO_NACIONALIDADE",
      applicant.nationality,
    );
    await this.selectSearchableOption("PESSOA.CO_UFNASC", applicant.birthState);
    await this.selectSearchableOption(
      "PESSOA.CO_UFIDENTIDADE",
      applicant.identityState,
    );
    await this.selectSearchableOption(
      "PESSOA.CO_PROFISSAO",
      applicant.profession,
    );
    await this.selectSearchableOption(
      "PESSOA.CO_ATIVIDADE_PROFISSIONAL",
      applicant.professionalActivity,
    );
    await this.proposalPage
      .getVisibleFieldByName("PESSOA.IN_RESIDE_NO_IMOVEL")
      .selectOption(applicant.livesInProperty);

    return this.saveAndAdvance(
      operationNumber,
      "Composição de Renda",
    );
  }

  async setNoIncomeCompositionAndAdvance(
    operationNumber: string,
  ): Promise<Response> {
    await this.ensureTabSelected(operationNumber, "Composição de Renda");
    const incomeCompositionGroup = this.page.getByRole("radiogroup", {
      name: "Você vai compor renda com mais alguém nesta operação?",
      exact: true,
    });
    const noCompositionOption = incomeCompositionGroup.getByRole("radio", {
      name: "Não",
      exact: true,
    });
    await noCompositionOption.check();
    await expect(noCompositionOption).toBeChecked();

    return this.saveAndAdvance(
      operationNumber,
      "Motivo da Contratação",
    );
  }

  async fillCreditPurposeAndAdvance(
    operationNumber: string,
    preparation: WorkflowIntegrationPreparationScenario,
  ): Promise<Response> {
    await this.ensureTabSelected(operationNumber, "Motivo da Contratação");
    await this.proposalPage
      .getVisibleFieldByName("CO_MOTIVO_EMPRESTIMO")
      .selectOption(preparation.creditPurpose.purpose);
    await this.fillField(
      "OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO",
      preparation.creditPurpose.description,
    );

    return this.saveAndAdvance(operationNumber, "Imóvel");
  }

  async fillProperty(
    operationNumber: string,
    preparation: WorkflowIntegrationPreparationScenario,
  ): Promise<void> {
    await this.ensureTabSelected(operationNumber, "Imóvel");
    await this.proposalPage.selectVisibleOption(
      "IMOVEL_OPERACAO.IN_USO_DO_IMOVEL",
      preparation.property.use,
    );
    await this.proposalPage
      .getVisibleFieldByName("IMOVEL_OPERACAO.IN_TIPO_IMOVEL")
      .selectOption(preparation.property.type);
    await this.proposalPage
      .getVisibleFieldByName("IMOVEL_OPERACAO.CO_CONDICAO_IMOVEL")
      .selectOption(preparation.property.condition);
    await this.ensurePropertyAddress(preparation.property.addressLine);
  }

  async ensurePropertyAddress(addressLine: string): Promise<void> {
    const addressField = this.proposalPage.getVisibleFieldByName(
      "IMOVEL_OPERACAO.NO_ENDERECO",
    );
    await expect(addressField).toBeVisible();

    if (await addressField.isEditable()) {
      await addressField.fill(addressLine);
      await addressField.blur();
      await expect(addressField).toHaveValue(addressLine);
      return;
    }

    await expect(
      addressField,
      "O Portal manteve o endereço do imóvel desabilitado e não forneceu um valor vindo da simulação.",
    ).toHaveValue(/\S/);
  }

  /**
   * Preenche o CEP do imóvel na aba Imóvel e aguarda a consulta real de CEP
   * (GET /api/portal/cep) preencher o endereço. Não salva sozinho — combine
   * com {@link persistPropertyWithoutFinalizing} ou {@link finalize} para
   * provocar o PUT real de cadastro.
   */
  async fillPropertyPostalCode(
    operationNumber: string,
    contract: PropertyPostalCodeContract,
  ): Promise<PersistedPropertyAddress> {
    await this.ensureTabSelected(operationNumber, "Imóvel");

    const postalCodeField = this.proposalPage.getVisibleFieldByName(
      "IMOVEL_OPERACAO.NU_CEP",
    );
    await expect(
      postalCodeField,
      "O Portal deve exibir o CEP do imóvel na aba Imóvel.",
    ).toBeVisible();

    const cepResponsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === "/api/portal/cep" &&
        new URL(response.url()).searchParams.get("cep") === contract.postalCode,
      { timeout: 30_000 },
    );
    await postalCodeField.fill(contract.postalCode);
    await postalCodeField.blur();
    const cepResponse = await cepResponsePromise;
    if (!cepResponse.ok()) {
      throw new Error(
        `A consulta real de CEP do imóvel respondeu HTTP ${cepResponse.status()}.`,
      );
    }
    const cepPayload = (await cepResponse.json().catch(() => ({}))) as Record<
      string,
      string
    >;

    const addressField = this.proposalPage.getVisibleFieldByName(
      "IMOVEL_OPERACAO.NO_ENDERECO",
    );
    await expect(
      addressField,
      "O Portal deve preencher o endereço do imóvel após a consulta real de CEP.",
    ).toHaveValue(/\S/, { timeout: 30_000 });

    // O imóvel não tem um campo separado de número (diferente de PESSOA/
    // CONJUGE, que têm NU_APTO): o número compõe o próprio NO_ENDERECO,
    // igual ao fluxo já usado no SCCI (ver c6-provisioning-data.ts).
    const returnedAddressLine = (await addressField.inputValue()).trim();
    if (!returnedAddressLine) {
      throw new Error(
        "A consulta de CEP do imóvel não retornou um logradouro para compor o endereço.",
      );
    }
    const addressLine = contract.streetNumber
      ? `${returnedAddressLine}, ${contract.streetNumber}`
      : returnedAddressLine;

    if (contract.streetNumber) {
      await addressField.fill(addressLine);
      await addressField.blur();
      await expect(addressField).toHaveValue(addressLine);
    }

    if (contract.complement !== undefined) {
      await this.fillField("IMOVEL_OPERACAO.NO_COMPLEMENTO", contract.complement);
    }

    const state = cepPayload["IMOVEL_OPERACAO.CO_UF"]?.trim();
    const municipality = cepPayload["IMOVEL_OPERACAO.CO_MUNICIPIO"]?.trim();

    return {
      postalCode: contract.postalCode,
      addressLine,
      ...(state ? { state } : {}),
      ...(municipality ? { municipality } : {}),
    };
  }

  /**
   * Comprova, após reload/reabertura, que CEP, endereço completo (com
   * número) e complemento do imóvel persistiram de verdade.
   */
  async expectPersistedPropertyPostalCode(
    operationNumber: string,
    contract: PropertyPostalCodeContract,
    expectedAddressLine: string,
  ): Promise<void> {
    await this.ensureTabSelected(operationNumber, "Imóvel");

    const postalCodeField = this.proposalPage.getVisibleFieldByName(
      "IMOVEL_OPERACAO.NU_CEP",
    );
    await expect(
      postalCodeField,
      "O CEP do imóvel não persistiu após o reload.",
    ).toHaveValue(new RegExp(contract.postalCode));

    const addressField = this.proposalPage.getVisibleFieldByName(
      "IMOVEL_OPERACAO.NO_ENDERECO",
    );
    await expect(
      addressField,
      "O endereço completo do imóvel (com número) não persistiu após o reload.",
    ).toHaveValue(expectedAddressLine);

    if (contract.complement !== undefined) {
      await expect(
        this.proposalPage.getVisibleFieldByName("IMOVEL_OPERACAO.NO_COMPLEMENTO"),
        "O complemento do imóvel não persistiu após o reload.",
      ).toHaveValue(contract.complement);
    }
  }

  async fillParticipantResidentialAddress(
    prefix: "CONJUGE" | "PESSOA",
    livesInProperty: string,
    address: PfAddressInput,
  ): Promise<void> {
    const residenceField = this.proposalPage.getVisibleFieldByName(
      `${prefix}.IN_RESIDE_NO_IMOVEL`,
    );
    await expect(
      residenceField,
      `O Portal deve exibir o campo residencial ${prefix}.IN_RESIDE_NO_IMOVEL`,
    ).toBeVisible();
    await residenceField.selectOption(livesInProperty);
    await expect(
      this.proposalPage.getVisibleFieldByName(`${prefix}.NU_CEP`),
      `O Portal deve exibir o endereço residencial de ${prefix} após selecionar que não reside no imóvel`,
    ).toBeVisible();
    await this.fillField(`${prefix}.NU_CEP`, address.postalCode);
    await expect(
      this.proposalPage.getVisibleFieldByName(`${prefix}.NO_ENDERECO`),
    ).toHaveValue(/\S/, { timeout: 30_000 });
    await this.fillField(
      `${prefix}.NO_ENDERECO`,
      `${address.street}, ${address.streetNumber}`,
    );
    await this.fillField(`${prefix}.NO_COMPLEMENTO`, address.complement);
    await this.fillField(`${prefix}.NO_BAIRRO`, address.neighborhood);
    await expect(
      this.proposalPage.getVisibleFieldByName(`${prefix}.CO_UF`),
    ).toHaveValue(/\S/, { timeout: 30_000 });
    await expect(
      this.proposalPage.getVisibleFieldByName(`${prefix}.CO_MUNICIPIO`),
    ).toHaveValue(/\S/, { timeout: 30_000 });
  }

  async expectReadyForFinalConfirmation(): Promise<void> {
    await expect(this.proposalPage.tabs.getTabButton("Imóvel")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const confirmButton = this.page.getByRole("button", {
      name: "Confirmar",
      exact: true,
    });
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeEnabled();
  }

  async persistPropertyWithoutFinalizing(
    operationNumber: string,
  ): Promise<Response> {
    await this.ensureTabSelected(operationNumber, "Imóvel");
    const responsePromise = this.page.waitForResponse(
      (response) => this.isTransitionResponse(
        response,
        "PUT",
        operationNumber,
        "cadastro",
      ),
      { timeout: 30_000 },
    );

    await this.proposalPage.tabs.select("Motivo da Contratação");
    const response = await responsePromise;
    await this.ensureTabSelected(operationNumber, "Imóvel");
    await expect(this.proposalPage.tabs.getTabButton("Imóvel")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    return response;
  }

  async finalize(
    operationNumber: string,
  ): Promise<ProposalFinalizationResponses> {
    await this.expectReadyForFinalConfirmation();
    const confirmButton = this.page.getByRole("button", {
      name: "Confirmar",
      exact: true,
    });
    const saveResponsePromise = this.page.waitForResponse(
      (response) => this.isTransitionResponse(
        response,
        "PUT",
        operationNumber,
        "cadastro",
      ),
      { timeout: 30_000 },
    );
    const finalizeResponsePromise = this.page.waitForResponse(
      (response) => this.isTransitionResponse(
        response,
        "POST",
        operationNumber,
        "finalizar",
      ),
      { timeout: 60_000 },
    );

    await confirmButton.click();
    const saveResponse = await saveResponsePromise;

    const advanceDialog = this.page
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

    return {
      saveResponse,
      finalizeResponse: await finalizeResponsePromise,
    };
  }

  private async ensureTabSelected(
    operationNumber: string,
    tabName: ProposalTabName,
  ): Promise<void> {
    const tab = this.proposalPage.tabs.getTabButton(tabName);
    if ((await tab.getAttribute("aria-selected")) === "true") return;

    const responsePromise = this.page.waitForResponse(
      (response) => this.isTransitionResponse(
        response,
        "PUT",
        operationNumber,
        "cadastro",
      ),
      { timeout: 30_000 },
    );
    await this.proposalPage.tabs.select(tabName);
    const response = await responsePromise;
    if (response.status() !== 200) {
      throw new Error(
        `O Portal rejeitou o salvamento ao abrir ${tabName} (HTTP ${response.status()}).`,
      );
    }
  }

  private async saveAndAdvance(
    operationNumber: string,
    nextTab: "Composição de Renda" | "Motivo da Contratação" | "Imóvel",
  ): Promise<Response> {
    const advanceButton = this.page.getByRole("button", {
      name: "Confirmar e avançar cadastro",
      exact: true,
    });
    const responsePromise = this.page.waitForResponse(
      (response) => this.isTransitionResponse(
        response,
        "PUT",
        operationNumber,
        "cadastro",
      ),
      { timeout: 30_000 },
    );

    await advanceButton.click();
    const response = await responsePromise;
    await expect(this.proposalPage.tabs.getTabButton(nextTab)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    return response;
  }

  private async fillField(name: string, value: string): Promise<void> {
    const field = this.proposalPage.getVisibleFieldByName(name);
    await expect(field).toBeVisible();
    await field.fill(value);
    await field.blur();
  }

  private async selectSearchableOption(
    fieldName: string,
    option: string,
  ): Promise<void> {
    await this.proposalPage
      .getVisibleSearchableCombobox(fieldName)
      .selectOption(option);
  }

  private isTransitionResponse(
    response: Response,
    method: "PUT" | "POST",
    operationNumber: string,
    endpoint: "cadastro" | "finalizar",
  ): boolean {
    const url = new URL(response.url());
    return response.request().method() === method
      && url.pathname === `/api/portal/propostas/${operationNumber}/${endpoint}`;
  }
}
