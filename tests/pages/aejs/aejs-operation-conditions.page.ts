import { expect, type Locator, type Page } from "@playwright/test";
import type { ProvisioningPhaseTarget } from "../../types/provisioning";

interface ExtJsRecordLike {
  get(field: string): unknown;
}

interface ExtJsStoreLike {
  findRecord(
    field: string,
    value: string,
    startIndex?: number,
    anyMatch?: boolean,
    caseSensitive?: boolean,
    exactMatch?: boolean,
  ): ExtJsRecordLike | null;
}

interface ExtJsPhaseComponentLike {
  getXType?(): string;
  getValue?(): unknown;
  getRawValue?(): unknown;
  getStore?(): ExtJsStoreLike | undefined;
  isVisible?(): boolean;
  setValue?(value: string): void;
  checkChange?(): void;
}

interface ExtJsRuntimeLike {
  ComponentQuery?: {
    query(selector: string): ExtJsPhaseComponentLike[];
  };
}

interface ExtJsWindow extends Window {
  Ext?: ExtJsRuntimeLike;
}

/** Altera somente a fase atual pela aba administrativa Condições do SCCI. */
export class AejsOperationConditionsPage {
  private static readonly phaseFieldName =
    "OPERACAO_CREDITO$NU_FASE_ATUAL";

  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    const conditionsTab = this.page
      .getByRole("tab", { name: "Condições", exact: true })
      .filter({ visible: true })
      .last();
    await expect(conditionsTab).toBeVisible({ timeout: 60_000 });
    await conditionsTab.click();
    await expect(conditionsTab).toHaveAttribute("aria-selected", "true");
    await this.waitForExtJsReady();
    await expect(this.phaseField).toBeVisible();
  }

  async readCurrentPhase(): Promise<ProvisioningPhaseTarget> {
    await expect(this.phaseField).toBeVisible();

    return this.phaseField.evaluate((_, fieldName) => {
      const runtime = (window as ExtJsWindow).Ext;
      const component = runtime?.ComponentQuery?.query(
        `[name="${fieldName}"]`,
      ).find(
        (candidate) =>
          candidate.getXType?.() === "aejs-combobox" &&
          candidate.isVisible?.(),
      );
      const code = String(component?.getValue?.() ?? "").trim();
      const label = String(component?.getRawValue?.() ?? "").trim();
      if (!component || !code || !label) {
        throw new Error(
          `Componente ExtJS da fase atual não encontrado por ${fieldName}.`,
        );
      }
      return { code, label };
    }, AejsOperationConditionsPage.phaseFieldName);
  }

  async changeCurrentPhase(target: ProvisioningPhaseTarget): Promise<void> {
    const current = await this.readCurrentPhase();
    if (current.code === target.code && current.label === target.label) return;

    await this.startEditing();
    const selected = await this.phaseField.evaluate(
      (_, { fieldName, phaseTarget }) => {
        const runtime = (window as ExtJsWindow).Ext;
        const components = runtime?.ComponentQuery?.query(
          `[name="${fieldName}"]`,
        ) ?? [];
        const component = components.find(
          (candidate) =>
            candidate.getXType?.() === "aejs-combobox" &&
            candidate.isVisible?.(),
        );
        const store = component?.getStore?.();
        const record = store?.findRecord(
          "itemValue",
          phaseTarget.code,
          0,
          false,
          true,
          true,
        );
        const configuredLabel = String(record?.get("itemDisplay") ?? "");
        if (!component || !record || configuredLabel !== phaseTarget.label) {
          throw new Error(
            `Fase ${phaseTarget.code} — ${phaseTarget.label} ausente no store ExtJS.`,
          );
        }

        for (const candidate of components) {
          if (
            candidate.getXType?.() === "aejs-combobox" ||
            candidate.getXType?.() === "aejs-numberfield"
          ) {
            candidate.setValue?.(phaseTarget.code);
            candidate.checkChange?.();
          }
        }
        return {
          code: String(component.getValue?.() ?? ""),
          label: String(component.getRawValue?.() ?? ""),
        };
      },
      {
        fieldName: AejsOperationConditionsPage.phaseFieldName,
        phaseTarget: target,
      },
    );

    expect(selected).toEqual(target);
    await this.expectPhaseFieldContract(target);
    await this.save();
  }

  async expectCurrentPhase(target: ProvisioningPhaseTarget): Promise<void> {
    await expect
      .poll(() => this.readCurrentPhase(), {
        timeout: 60_000,
        message: `A fase ${target.code} — ${target.label} não foi persistida.`,
      })
      .toEqual(target);
    await this.expectPhaseFieldContract(target);
  }

  private async expectPhaseFieldContract(
    target: ProvisioningPhaseTarget,
  ): Promise<void> {
    await expect
      .poll(async () => {
        const value = await this.phaseField.inputValue();
        return value === target.code || value === target.label;
      }, {
        message: `O campo da fase não expôs o código ${target.code} nem o rótulo ${target.label}.`,
      })
      .toBe(true);
  }

  private get phaseField(): Locator {
    return this.page
      .locator(
        `input[name=${JSON.stringify(AejsOperationConditionsPage.phaseFieldName)}]:visible`,
      )
      .last();
  }

  private async startEditing(): Promise<void> {
    const changeButton = this.page
      .locator(
        '[role="button"][data-qtip="Permite a alteração do dados do pretendente"]:visible',
      )
      .last();
    await expect(changeButton).toBeVisible();
    await changeButton.click();
    await this.dismissKnownC6WarningIfVisible();
    await this.waitForExtJsReady();
    await expect(this.saveButton).toBeVisible({ timeout: 60_000 });
    await expect(this.saveButton).toBeEnabled();
  }

  private async save(): Promise<void> {
    await expect(this.saveButton).toBeVisible();
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.dismissKnownC6WarningIfVisible();
    await this.waitForExtJsReady();
    await expect(this.changeButton).toBeVisible({ timeout: 60_000 });
  }

  private get saveButton(): Locator {
    return this.page
      .getByRole("button", { name: "Salvar", exact: true })
      .filter({ visible: true })
      .last();
  }

  private get changeButton(): Locator {
    return this.page
      .locator(
        '[role="button"][data-qtip="Permite a alteração do dados do pretendente"]:visible',
      )
      .last();
  }

  private async dismissKnownC6WarningIfVisible(): Promise<void> {
    const alert = this.page.getByRole("alertdialog").filter({ visible: true });
    await alert
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => undefined);
    if (!(await alert.isVisible())) return;

    await expect
      .poll(
        async () =>
          (await alert.isVisible()) &&
          (await alert.innerText()).includes("Transmitindo dados"),
        { timeout: 5 * 60_000 },
      )
      .toBe(false);
    if (!(await alert.isVisible())) return;
    await expect(alert).toContainText(
      "Rotina GetValidaTipoImovelC6 nao encontrada",
    );
    const acknowledge = alert.getByRole("button", {
      name: "OK",
      exact: true,
    });
    await expect(acknowledge).toBeVisible();
    await acknowledge.click();
    await expect(alert).toBeHidden();
  }

  private async waitForExtJsReady(): Promise<void> {
    await expect(
      this.page.locator(".x-mask-msg:visible, .x-loading-mask:visible"),
    ).toHaveCount(0, { timeout: 60_000 });
  }
}
