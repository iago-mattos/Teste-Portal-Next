import { expect, type Locator, type Page } from "@playwright/test";
import type {
  DigitalMortgageSimulationScenario,
  SimulationApplicantInput,
  SimulationFinancialInput,
  SimulationJourneyInput,
} from "../../types/simulator";

export interface SimulatorInteractions {
  click(locator: Locator): Promise<void>;
  type(
    locator: Locator,
    value: string,
    options?: Readonly<{ clear?: boolean }>,
  ): Promise<void>;
  selectOption(locator: Locator, label: string): Promise<void>;
  setChecked(locator: Locator, checked: boolean): Promise<void>;
}

const defaultInteractions: SimulatorInteractions = {
  click: async (locator) => locator.click(),
  type: async (locator, value, options) => {
    if (options?.clear === false) {
      await locator.pressSequentially(value);
      return;
    }
    await locator.fill(value);
  },
  selectOption: async (locator, label) => {
    await locator.selectOption({ label });
  },
  setChecked: async (locator, checked) => {
    await locator.setChecked(checked);
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class PortalSimulatorPage {
  readonly welcomeHeading: Locator;
  readonly simulationDataHeading: Locator;
  readonly propertyValueInput: Locator;
  readonly financingValueInput: Locator;
  readonly customTermInput: Locator;
  readonly amortizationSelect: Locator;
  readonly gracePeriodSelect: Locator;
  readonly birthDateInput: Locator;
  readonly netIncomeInput: Locator;
  readonly composeIncomeCheckbox: Locator;
  readonly insurerHeading: Locator;
  readonly resultHeading: Locator;
  readonly applicantDataHeading: Locator;
  readonly cpfInput: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly mobileInput: Locator;

  private readonly startSimulationButton: Locator;
  private readonly insurersGroup: Locator;

  constructor(
    private readonly page: Page,
    private readonly interactions: SimulatorInteractions = defaultInteractions,
    private readonly loadingTimeoutMs = 30_000,
  ) {
    this.welcomeHeading = page.getByRole("heading", {
      name: "Seja bem-vindo!",
      level: 1,
    });
    this.startSimulationButton = page.getByRole("button", {
      name: /Realizar nova simula[cç][aã]o/i,
    });
    this.simulationDataHeading = page.getByRole("heading", {
      name: "Dados da simulacao",
      level: 1,
    });
    this.propertyValueInput = page.getByRole("textbox", {
      name: "Valor do imovel",
      exact: true,
    });
    this.financingValueInput = page.getByRole("textbox", {
      name: "Valor do financiamento",
      exact: true,
    });
    this.customTermInput = page.getByRole("textbox", {
      name: "Prazo (meses)",
      exact: true,
    });
    this.amortizationSelect = page.getByRole("combobox", {
      name: "Sistema de amortizacao",
      exact: true,
    });
    this.gracePeriodSelect = page.getByRole("combobox", {
      name: "Carencia",
      exact: true,
    });
    this.birthDateInput = page.getByRole("textbox", {
      name: "Data de nascimento",
      exact: true,
    });
    this.netIncomeInput = page.getByRole("textbox", {
      name: "Renda liquida",
      exact: true,
    });
    this.composeIncomeCheckbox = page.getByRole("checkbox", {
      name: "Compor renda com co-adquirente",
      exact: true,
    });
    this.insurerHeading = page.getByRole("heading", {
      name: "Escolha sua seguradora",
      level: 1,
    });
    this.insurersGroup = page.getByRole("radiogroup", {
      name: "Seguradoras disponiveis",
      exact: true,
    });
    this.resultHeading = page.getByRole("heading", {
      name: "Resultado da simulacao",
      level: 1,
    });
    this.applicantDataHeading = page.getByRole("heading", {
      name: "Seus dados",
      level: 1,
    });
    this.cpfInput = page.getByRole("textbox", { name: "CPF", exact: true });
    this.nameInput = page.getByRole("textbox", { name: "Nome", exact: true });
    this.emailInput = page.getByRole("textbox", {
      name: "Email",
      exact: true,
    });
    this.mobileInput = page.getByRole("textbox", {
      name: "Celular",
      exact: true,
    });
  }

  async open(): Promise<void> {
    await this.page.goto("/");
    await expect(this.welcomeHeading).toBeVisible();
    await expect(this.startSimulationButton).toBeVisible();
  }

  async startNewSimulation(): Promise<void> {
    await expect(this.startSimulationButton).toHaveCount(1);
    await this.interactions.click(this.startSimulationButton);
    await expect(
      this.page.getByRole("heading", {
        name: "Simule o tipo de credito desejado",
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("status").filter({
        hasText: "Carregando modalidades...",
      }),
    ).toBeHidden({ timeout: this.loadingTimeoutMs });
  }

  async chooseJourney(journey: SimulationJourneyInput): Promise<void> {
    await this.clickUniqueOption(journey.modality);
    await this.clickUniqueOption(journey.borrowerType);
    await this.clickUniqueOption(journey.propertyType);
    await this.clickUniqueOption(journey.propertyOrigin);

    await Promise.all([
      this.page.waitForURL(/\/dados-simulacao$/),
      this.clickUniqueOption(journey.indexer),
    ]);
    await expect(this.simulationDataHeading).toBeVisible();
  }

  async fillSimulationData(data: SimulationFinancialInput): Promise<void> {
    await this.interactions.type(
      this.propertyValueInput,
      data.propertyValueCents,
    );
    await this.interactions.type(
      this.financingValueInput,
      data.financingValueCents,
    );
    await this.interactions.setChecked(
      this.page.getByRole("radio", {
        name: `${data.termMonths} meses`,
        exact: true,
      }),
      true,
    );
    await this.interactions.selectOption(
      this.amortizationSelect,
      data.amortizationSystem,
    );
    await this.interactions.selectOption(
      this.gracePeriodSelect,
      String(data.gracePeriodDays),
    );
    await this.interactions.type(this.birthDateInput, data.birthDateDigits);
    await this.interactions.type(this.netIncomeInput, data.netIncomeCents);
    await this.interactions.setChecked(
      this.composeIncomeCheckbox,
      data.composeIncome,
    );
  }

  async continueToInsurers(): Promise<void> {
    const advanceButton = this.page.getByRole("button", {
      name: "Avancar",
      exact: true,
    });
    await expect(advanceButton).toHaveCount(1);
    await Promise.all([
      this.page.waitForURL(/\/seguradoras$/),
      this.interactions.click(advanceButton),
    ]);
    await expect(this.insurerHeading).toBeVisible();
    await expect(
      this.page.getByRole("status").filter({
        hasText: "Calculando seguradoras...",
      }),
    ).toBeHidden({ timeout: this.loadingTimeoutMs });
  }

  async selectInsurer(name: string): Promise<void> {
    const insurer = this.insurersGroup.getByRole("radio", {
      name: new RegExp(`^${escapeRegExp(name)}\\b`),
    });
    await expect(insurer).toHaveCount(1);

    const labelledBy = await insurer.getAttribute("aria-labelledby");
    if (!labelledBy) {
      throw new Error(
        `A seguradora ${name} nao informou o card associado via aria-labelledby.`,
      );
    }

    const insurerCard = this.insurersGroup.locator(
      `[id=${JSON.stringify(labelledBy)}]`,
    );
    await expect(insurerCard).toHaveCount(1);
    await this.interactions.click(insurerCard);
    await expect(insurer).toBeChecked();
  }

  async continueToResult(): Promise<void> {
    const advanceButton = this.page.getByRole("button", {
      name: "Avancar",
      exact: true,
    });
    await expect(advanceButton).toHaveCount(1);
    await expect(advanceButton).toBeEnabled();
    await Promise.all([
      this.page.waitForURL(/\/resultado$/),
      this.interactions.click(advanceButton),
    ]);
    await expect(this.resultHeading).toBeVisible();
  }

  async continueToApplicantData(): Promise<void> {
    const advanceButton = this.page.getByRole("button", {
      name: "Avancar",
      exact: true,
    });
    await expect(advanceButton).toHaveCount(1);
    await Promise.all([
      this.page.waitForURL(/\/enviar-proposta$/),
      this.interactions.click(advanceButton),
    ]);
    await expect(this.applicantDataHeading).toBeVisible();
  }

  async fillApplicantData(applicant: SimulationApplicantInput): Promise<void> {
    await this.interactions.type(this.cpfInput, applicant.cpfDigits);
    await this.interactions.type(this.nameInput, applicant.name);
    await this.interactions.type(this.emailInput, applicant.email);
    await this.interactions.type(this.mobileInput, applicant.mobileDigits);
    await expect(this.nameInput).toHaveValue(applicant.name);
  }

  async completeSimulation(
    scenario: DigitalMortgageSimulationScenario,
    applicant: SimulationApplicantInput,
  ): Promise<string> {
    await this.open();
    await this.startNewSimulation();
    await this.chooseJourney(scenario.journey);
    await this.verifyNumericInputsRejectLetters();
    await this.fillSimulationData(scenario.financial);
    await this.continueToInsurers();
    await this.selectInsurer(scenario.insurer);
    await this.continueToResult();
    await this.continueToApplicantData();
    await this.fillApplicantData(applicant);
    return this.submitProposal();
  }

  async submitProposal(): Promise<string> {
    const requestSubmissionButton = this.page.getByRole("button", {
      name: "Enviar Proposta",
      exact: true,
    });
    await expect(requestSubmissionButton).toHaveCount(1);
    await this.interactions.click(requestSubmissionButton);

    const confirmationDialog = this.page.getByRole("alertdialog", {
      name: "Confirmar envio",
      exact: true,
    });
    await expect(confirmationDialog).toBeVisible();

    const confirmButton = confirmationDialog.getByRole("button", {
      name: "Enviar",
      exact: true,
    });
    await expect(confirmButton).toHaveCount(1);
    await this.interactions.click(confirmButton);

    const successMessage = this.page.getByText(
      "Tudo certo! Enviamos o link de acesso.",
      { exact: true },
    );
    const duplicateProposalAlert = this.page.getByRole("alert").filter({
      hasText: "existe uma proposta cadastrada para este mesmo CPF",
    });

    await expect(successMessage.or(duplicateProposalAlert)).toBeVisible({
      timeout: 60_000,
    });

    if (await duplicateProposalAlert.isVisible()) {
      const message = (await duplicateProposalAlert.textContent())?.trim();
      throw new Error(
        `O Portal recusou a criação da proposta: ${message ?? "CPF com proposta em análise."}`,
      );
    }

    const protocolText = this.page.getByText(/^Protocolo:\s*\d+$/);
    await expect(protocolText).toHaveCount(1);
    await expect(protocolText).toBeVisible();

    const value = await protocolText.textContent();
    const protocol = /Protocolo:\s*(\d+)/.exec(value ?? "")?.[1];
    if (!protocol) {
      throw new Error("O Portal concluiu o envio sem apresentar um protocolo válido.");
    }

    return protocol;
  }

  private async clickUniqueOption(name: string): Promise<void> {
    const option = this.page.getByRole("button", { name, exact: true });
    await expect(option).toHaveCount(1);
    await this.interactions.click(option);
  }

  private async verifyNumericInputsRejectLetters(): Promise<void> {
    const numericInputs = [
      this.propertyValueInput,
      this.financingValueInput,
      this.customTermInput,
      this.birthDateInput,
      this.netIncomeInput,
    ] as const;

    for (const input of numericInputs) {
      await input.clear();
      const valueBeforeLetters = await input.inputValue();
      await this.interactions.type(input, "abc", { clear: false });
      await expect(input).toHaveValue(valueBeforeLetters);
    }
  }
}
