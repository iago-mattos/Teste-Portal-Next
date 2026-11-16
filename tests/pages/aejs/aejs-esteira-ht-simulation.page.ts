import {
  expect,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";
import type {
  DigitalMortgageSimulationScenario,
  SimulationApplicantInput,
} from "../../types/simulator";

interface EsteiraHtCreationOptions {
  readonly confirmExistingCpfProposal?: boolean;
  readonly excludedOperations?: readonly string[];
  readonly beforeFinalSubmission?: () => Promise<void>;
}

/**
 * Simulador interno do SCCI EsteiraHT.
 *
 * Apesar de terminar no mesmo modal de gravação do C6, a jornada e os nomes
 * dos campos são próprios deste tenant. Mantê-la isolada impede que uma
 * alteração do C6 seja tratada como contrato da Esteira Digital.
 */
export class AejsEsteiraHtSimulationPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    const origination = this.page
      .getByRole("toolbar")
      .getByRole("button", { name: "Originação", exact: true });
    await expect(origination).toBeVisible();
    await origination.click();

    const newSimulation = this.page.getByRole("menuitem", {
      name: "Realizar nova simulação",
      exact: true,
    });
    await expect(newSimulation).toBeVisible();
    await newSimulation.click();

    // A máscara textual do ExtJS pode continuar visível depois que o elemento
    // de loading some. O campo real é o sinal confiável de prontidão.
    await expect(this.field("CO_GRUPO_TIPO_OPERACAO_009")).toBeVisible({
      timeout: 120_000,
    });
  }

  async createProposal(
    scenario: DigitalMortgageSimulationScenario,
    applicant: SimulationApplicantInput,
    options: EsteiraHtCreationOptions = {},
  ): Promise<string> {
    await this.selectCombo(
      "CO_GRUPO_TIPO_OPERACAO_009",
      scenario.journey.modality,
    );
    await this.selectCombo(
      "CO_GRUPO_TIPO_OPERACAO_500",
      scenario.journey.borrowerType,
    );
    await this.selectCombo(
      "CO_GRUPO_TIPO_OPERACAO_002",
      scenario.journey.propertyType,
    );
    await this.selectCombo(
      "CO_GRUPO_TIPO_OPERACAO_005",
      scenario.journey.propertyOrigin,
    );
    await this.selectCombo(
      "CO_GRUPO_TIPO_OPERACAO_032",
      scenario.journey.indexer,
    );

    await this.fillCommitted(
      "VA_IMOVEL",
      this.centsToWholeReais(scenario.financial.propertyValueCents),
    );
    await this.fillCommitted(
      "VA_FINANCIAMENTO",
      this.centsToWholeReais(scenario.financial.financingValueCents),
    );
    await this.selectCombo(
      "CO_SISTEMA_AMORTIZACAO",
      scenario.scciReflection.amortizationSystem,
    );
    await this.selectCombo("CO_SEGURADORA", scenario.insurer);
    await this.fillCommitted(
      "DT_NASCIMENTO",
      scenario.financial.birthDateDigits,
    );
    await this.fillCommitted(
      "P1_VA_RENDA",
      this.centsToWholeReais(scenario.financial.netIncomeCents),
    );
    const composeIncome = this.field("IN_MAIS_PROPONENTES");
    await expect(composeIncome).toBeVisible();
    if (scenario.financial.composeIncome) {
      throw new Error(
        "O fluxo scci-shared da EsteiraHT ainda não possui contrato para composição de renda.",
      );
    }
    await expect(composeIncome).not.toBeChecked();

    await this.clickVisibleButton("Prosseguir");
    await expect(
      this.page.getByRole("button", {
        name: "Selecionar todas",
        exact: true,
      }),
    ).toBeVisible({ timeout: 120_000 });
    await this.clickVisibleButton("Selecionar todas");
    await this.clickVisibleButton("Prosseguir");

    await expect(this.field("NU_MESES_PRAZO")).toBeVisible({
      timeout: 120_000,
    });
    await this.fillCommitted(
      "NU_MESES_PRAZO",
      String(scenario.financial.termMonths),
    );
    await this.clickVisibleButton("Prosseguir");

    await expect(
      this.page.getByRole("button", {
        name: "Gravar Proposta",
        exact: true,
      }),
    ).toBeVisible({ timeout: 120_000 });
    await this.clickVisibleButton("Gravar Proposta");

    const cpf = this.page.locator('input[name="NU_CPF_AUX"]:visible');
    await expect(cpf).toBeVisible({ timeout: 120_000 });
    const modal = this.page.locator(".x-window:visible").filter({ has: cpf });
    await expect(modal).toBeVisible();
    await cpf.fill(applicant.cpfDigits);
    await modal.locator('input[name="NO_PESSOA"]:visible').fill(applicant.name);

    await options.beforeFinalSubmission?.();
    return this.submitAndReadCreatedOperation(modal, options);
  }

  private async submitAndReadCreatedOperation(
    modal: Locator,
    options: EsteiraHtCreationOptions,
  ): Promise<string> {
    const creationResponses: Response[] = [];
    const captureCreationResponse = (response: Response): void => {
      if (
        response.request().method() === "POST" &&
        response.status() >= 200 &&
        response.status() < 300
      ) {
        creationResponses.push(response);
      }
    };
    this.page.on("response", captureCreationResponse);

    try {
      await modal
        .getByRole("button", { name: "Gravar Proposta", exact: true })
        .click();

      if (options.confirmExistingCpfProposal) {
        const existingCpfDialog = this.page
          .locator(".x-window:visible")
          .filter({
            hasText:
              /(?:Proposta encontrada|existe uma proposta).+CPF\/CNPJ|mesmo CPF/i,
          })
          .filter({
            has: this.page.getByRole("button", {
              name: /^Confirma(?:r)?$/i,
            }),
          });
        await expect(
          existingCpfDialog,
          "O SCCI deve pedir confirmação antes de criar outra proposta para o mesmo CPF",
        ).toBeVisible({ timeout: 60_000 });
        await existingCpfDialog
          .getByRole("button", { name: /^Confirma(?:r)?$/i })
          .click();
        await expect(existingCpfDialog).toBeHidden({ timeout: 60_000 });
      }

      await expect(modal).toBeHidden({ timeout: 120_000 });
    } finally {
      this.page.off("response", captureCreationResponse);
    }

    const excluded = new Set(options.excludedOperations ?? []);
    const candidates = new Map<string, string[]>();
    for (const response of creationResponses) {
      const operation = await this.readCreatedOperationFromResponse(response);
      if (!operation || excluded.has(operation)) continue;
      const urls = candidates.get(operation) ?? [];
      urls.push(response.url());
      candidates.set(operation, urls);
    }

    if (candidates.size !== 1) {
      const evidence = [...candidates.entries()]
        .map(([operation, urls]) => `${operation} em ${urls.join(", ")}`)
        .join("; ");
      throw new Error(
        "Não foi possível identificar de forma inequívoca a operação criada nas respostas HTTP " +
          `da gravação${evidence ? ` (${evidence})` : ""}. ` +
          "A tentativa fica bloqueada para recuperação manual e não pode ser repetida automaticamente.",
      );
    }

    return [...candidates.keys()][0]!;
  }

  private async readCreatedOperationFromResponse(
    response: Response,
  ): Promise<string> {
    const contentType = response.headers()["content-type"] ?? "";
    if (!/json|javascript|text/i.test(contentType)) return "";

    let body: unknown;
    try {
      body = JSON.parse(await response.text()) as unknown;
    } catch {
      return "";
    }

    const operations = new Set<string>();
    const visit = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      for (const [key, nested] of Object.entries(value)) {
        if (
          /^(?:NU_OPERACAO|nuOperacao|operationNumber|protocolo)$/i.test(key)
        ) {
          const digits = String(nested ?? "").replace(/\D/g, "");
          if (/^\d{9}$/.test(digits)) operations.add(digits);
        }
        visit(nested);
      }
    };
    visit(body);

    if (operations.size > 1) {
      throw new Error(
        `Resposta ambígua da criação em ${response.url()}: ${[...operations].join(", ")}.`,
      );
    }
    return [...operations][0] ?? "";
  }

  private field(name: string): Locator {
    return this.page.locator(`input[name=${JSON.stringify(name)}]:visible`);
  }

  private async selectCombo(name: string, value: string): Promise<void> {
    const field = this.field(name);
    await expect(field).toBeVisible({ timeout: 120_000 });
    await expect(field).toBeEnabled();
    await field
      .locator("xpath=../..")
      .locator('[id$="-trigger-picker"]')
      .click();

    const option = this.page
      .locator(".x-boundlist:visible .x-boundlist-item")
      .filter({ hasText: value })
      .last();
    await expect(option).toBeVisible({ timeout: 30_000 });
    await option.click();
    await expect(field).toHaveValue(new RegExp(this.escapeRegExp(value), "i"), {
      timeout: 30_000,
    });
    await this.waitForTransientLoading();
  }

  private async fillCommitted(name: string, value: string): Promise<void> {
    const field = this.field(name);
    await expect(field).toBeVisible({ timeout: 120_000 });
    await expect(field).toBeEnabled();
    await field.fill(value);
    await field.press("Tab");
    await expect(field).not.toHaveValue("");
    await this.waitForTransientLoading();
  }

  private async clickVisibleButton(name: string): Promise<void> {
    const button = this.page
      .getByRole("button", { name, exact: true })
      .filter({ visible: true })
      .last();
    await expect(button).toBeVisible({ timeout: 120_000 });
    await expect(button).toBeEnabled();
    await button.click();
    await this.waitForTransientLoading();
  }

  private async waitForTransientLoading(): Promise<void> {
    await expect(
      this.page.getByText("Aguarde...", { exact: true }).filter({ visible: true }),
    ).toHaveCount(0, { timeout: 120_000 });
  }

  private centsToWholeReais(value: string): string {
    if (!/^\d+00$/.test(value)) {
      throw new Error(`Valor monetário sem centavos inteiros: ${value}.`);
    }
    return value.slice(0, -2);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
