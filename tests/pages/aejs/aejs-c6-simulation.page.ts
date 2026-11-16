import {
  expect,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";
import type { SimulationApplicantInput } from "../../types/simulator";

/**
 * Recorte mínimo do cenário exigido pela simulação interna do C6 (ExtJS).
 */
export interface ScciNewSimulationScenario {
  readonly journey: {
    readonly operationGroup: string;
    readonly borrowerType: string;
    readonly propertyType: string;
    readonly financingType: string;
    readonly interestType: string;
  };
  readonly financial: {
    readonly propertyValueCents: string;
    readonly financingValueCents: string;
    readonly termMonths: number;
    readonly birthDateDigits: string;
  };
  readonly insurer: string;
}

/** Jornada de simulação interna do SCCI C6, usada para criar propostas diretamente no back-office. */
export class AejsC6SimulationPage {
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
    await this.waitForExtJsReady();
    await expect(this.field("CO_GRUPO_TIPO_OPERACAO_A01")).toBeVisible();
  }

  async createProposal(
    scenario: ScciNewSimulationScenario,
    applicant: SimulationApplicantInput,
    options: Readonly<{
      confirmExistingCpfProposal?: boolean;
      expectedCreatedOperation?: string;
      excludedOperations?: readonly string[];
      beforeFinalSubmission?: () => Promise<void>;
    }> = {},
  ): Promise<string> {
    if (
      options.expectedCreatedOperation !== undefined &&
      !/^\d{9}$/.test(options.expectedCreatedOperation)
    ) {
      throw new Error(
        `Operação esperada inválida: ${options.expectedCreatedOperation}.`,
      );
    }

    await this.selectCombo(
      "CO_GRUPO_TIPO_OPERACAO_A01",
      scenario.journey.operationGroup,
    );
    await this.selectCombo(
      "CO_GRUPO_TIPO_OPERACAO_B01",
      scenario.journey.borrowerType,
    );
    await this.selectCombo(
      "CO_GRUPO_TIPO_OPERACAO_B02",
      scenario.journey.propertyType,
    );
    await this.selectCombo(
      "CO_GRUPO_TIPO_OPERACAO_B04",
      scenario.journey.financingType,
    );
    await this.selectCombo(
      "CO_GRUPO_TIPO_OPERACAO_B06",
      scenario.journey.interestType,
    );

    await this.fillCommitted(
      "VA_IMOVEL",
      this.centsToWholeReais(scenario.financial.propertyValueCents),
    );
    await this.fillCommitted(
      "VA_FINANCIAMENTO",
      this.centsToWholeReais(scenario.financial.financingValueCents),
    );
    await this.selectCombo("CO_SEGURADORA", scenario.insurer);
    await this.fillCommitted(
      "DT_NASCIMENTO",
      scenario.financial.birthDateDigits,
    );

    await this.clickVisibleButton("Prosseguir");
    await expect(
      this.page.getByRole("button", { name: /selecionar todas/i }),
    ).toBeVisible({ timeout: 60_000 });
    await this.clickVisibleButton(/selecionar todas/i);
    await this.clickVisibleButton("Prosseguir");

    await expect(this.field("NU_MESES_PRAZO")).toBeVisible({
      timeout: 60_000,
    });
    await this.fillCommitted(
      "NU_MESES_PRAZO",
      String(scenario.financial.termMonths),
    );
    await this.clickVisibleButton("Prosseguir");

    await expect(
      this.page.getByRole("button", { name: "Gravar Proposta", exact: true }),
    ).toBeVisible({ timeout: 60_000 });
    await this.clickVisibleButton("Gravar Proposta");

    const modal = this.page.locator(".x-window:visible").filter({
      has: this.page.getByRole("button", {
        name: "Gravar Proposta",
        exact: true,
      }),
    });
    await expect(modal).toBeVisible();
    await modal.locator('input[name="NU_CPF_AUX"]').fill(applicant.cpfDigits);
    await modal.locator('input[name="NO_PESSOA"]').fill(applicant.name);

    await options.beforeFinalSubmission?.();

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
            hasText: /Proposta encontrada para o CPF\/CNPJ informado/i,
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

      await expect(modal).toBeHidden({ timeout: 60_000 });
      await this.waitForExtJsReady();
    } finally {
      this.page.off("response", captureCreationResponse);
    }

    if (options.expectedCreatedOperation) {
      return options.expectedCreatedOperation;
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
    await expect(field).toBeVisible({ timeout: 60_000 });
    await expect(field).toBeEnabled();
    await field.click();
    await field.fill(value);

    const option = this.page
      .locator(".x-boundlist:visible .x-boundlist-item")
      .filter({ hasText: value })
      .last();
    await expect(option).toBeVisible({ timeout: 30_000 });
    await option.click();
    await expect(field).toHaveValue(value, { timeout: 30_000 });
    await this.waitForExtJsReady();
  }

  private async fillCommitted(name: string, value: string): Promise<void> {
    const field = this.field(name);
    await expect(field).toBeVisible({ timeout: 60_000 });
    await expect(field).toBeEnabled();
    await field.fill(value);
    await field.press("Tab");
    await expect(field).not.toHaveValue("");
    await this.waitForExtJsReady();
  }

  private async clickVisibleButton(name: string | RegExp): Promise<void> {
    const button = this.page
      .getByRole("button", { name, exact: typeof name === "string" })
      .filter({ visible: true })
      .last();
    await expect(button).toBeVisible({ timeout: 60_000 });
    await expect(button).toBeEnabled();
    await button.click();
    await this.waitForExtJsReady();
  }

  private centsToWholeReais(value: string): string {
    if (!/^\d+00$/.test(value)) {
      throw new Error(`Valor monetário sem centavos inteiros: ${value}.`);
    }
    return value.slice(0, -2);
  }

  private async waitForExtJsReady(): Promise<void> {
    await expect(
      this.page.locator(".x-mask-msg:visible, .x-loading-mask:visible"),
    ).toHaveCount(0, { timeout: 60_000 });
  }
}
