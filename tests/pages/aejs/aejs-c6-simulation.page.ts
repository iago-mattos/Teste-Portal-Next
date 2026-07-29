import { expect, type Locator, type Page } from "@playwright/test";
import type { C6ProvisioningScenario } from "../../types/c6-provisioning";
import type { SimulationApplicantInput } from "../../types/simulator";

/** Jornada de simulação interna usada exclusivamente para criar propostas C6. */
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
    scenario: C6ProvisioningScenario,
    applicant: SimulationApplicantInput,
  ): Promise<string> {
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
    await modal
      .getByRole("button", { name: "Gravar Proposta", exact: true })
      .click();
    await expect(modal).toBeHidden({ timeout: 60_000 });
    await this.waitForExtJsReady();

    let operation = "";
    await expect
      .poll(
        async () => {
          operation = await this.readCreatedOperation();
          return operation;
        },
        {
          timeout: 120_000,
          intervals: [500, 1_000, 2_000, 5_000],
          message: "O SCCI não apresentou a operação criada.",
        },
      )
      .toMatch(/^\d{9}$/);

    return operation;
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

  private async readCreatedOperation(): Promise<string> {
    const candidates = this.page.locator(
      'input[name="PRETENDENTE$NU_PRETENDENTE"]:visible, input[name="OPERACAO_CREDITO$NU_OPERACAO"]:visible, input[name="NU_OPERACAO"]:visible',
    );
    for (let index = 0; index < (await candidates.count()); index += 1) {
      const digits = (await candidates.nth(index).inputValue()).replace(/\D/g, "");
      if (/^\d{9}$/.test(digits)) return digits;
    }

    const text = await this.page.locator("body").innerText();
    return (
      /(?:operaç(?:ão|ao)|proposta)\s*(?:n[º°o.]*)?\s*[:#-]?\s*(\d{9})/i.exec(
        text,
      )?.[1] ?? ""
    );
  }

  private async waitForExtJsReady(): Promise<void> {
    await expect(
      this.page.locator(".x-mask-msg:visible, .x-loading-mask:visible"),
    ).toHaveCount(0, { timeout: 60_000 });
  }
}
