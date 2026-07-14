import { expect, type Locator, type Page } from "@playwright/test";
import type {
  SimulationApplicantInput,
  SimulationFinancialInput,
  SimulationJourneyInput,
} from "../../types/simulator";

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

  constructor(private readonly page: Page) {
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
    await this.startSimulationButton.click();
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
    ).toBeHidden({ timeout: 30_000 });
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
    await this.propertyValueInput.fill(data.propertyValueCents);
    await this.financingValueInput.fill(data.financingValueCents);
    await this.page
      .getByRole("radio", {
        name: `${data.termMonths} meses`,
        exact: true,
      })
      .check();
    await this.amortizationSelect.selectOption({
      label: data.amortizationSystem,
    });
    await this.gracePeriodSelect.selectOption({
      label: String(data.gracePeriodDays),
    });
    await this.birthDateInput.fill(data.birthDateDigits);
    await this.netIncomeInput.fill(data.netIncomeCents);
    await this.composeIncomeCheckbox.setChecked(data.composeIncome);
  }

  async continueToInsurers(): Promise<void> {
    const advanceButton = this.page.getByRole("button", {
      name: "Avancar",
      exact: true,
    });
    await expect(advanceButton).toHaveCount(1);
    await Promise.all([
      this.page.waitForURL(/\/seguradoras$/),
      advanceButton.click(),
    ]);
    await expect(this.insurerHeading).toBeVisible();
    await expect(
      this.page.getByRole("status").filter({
        hasText: "Calculando seguradoras...",
      }),
    ).toBeHidden({ timeout: 30_000 });
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
    await insurerCard.click();
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
      advanceButton.click(),
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
      advanceButton.click(),
    ]);
    await expect(this.applicantDataHeading).toBeVisible();
  }

  async fillApplicantData(applicant: SimulationApplicantInput): Promise<void> {
    await this.cpfInput.fill(applicant.cpfDigits);
    await this.nameInput.fill(applicant.name);
    await this.emailInput.fill(applicant.email);
    await this.mobileInput.fill(applicant.mobileDigits);
  }

  async submitProposal(): Promise<string> {
    const requestSubmissionButton = this.page.getByRole("button", {
      name: "Enviar Proposta",
      exact: true,
    });
    await expect(requestSubmissionButton).toHaveCount(1);
    await requestSubmissionButton.click();

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
    await confirmButton.click();

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
    await option.click();
  }
}
