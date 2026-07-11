import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { getIntegrationPreparationScenario } from "../../test-data/integration-data";

const monthNames = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

const maritalStatusLabels: Readonly<Record<string, string>> = {
  "1": "Solteiro",
};

function formatDate(value: string): string {
  const day = value.slice(0, 2);
  const monthIndex = Number(value.slice(2, 4)) - 1;
  const year = value.slice(4, 8);
  const month = monthNames[monthIndex];

  if (!day || !month || year.length !== 4) {
    throw new Error(`Data de integração inválida: ${value}`);
  }

  return `${day}/${month}/${year}`;
}

function formatCurrency(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) / 100);
}

function getMappedValue(
  values: Readonly<Record<string, string>>,
  key: string,
  field: string,
): string {
  const value = values[key];
  if (!value) {
    throw new Error(`${field} sem mapeamento AEJS para o valor ${key}.`);
  }
  return value;
}

async function expectFieldValue(
  operationsPage: AejsOperationsPage,
  name: string,
  value: string,
): Promise<void> {
  await expect(operationsPage.getVisibleField(name)).toHaveValue(value);
}

async function expectFieldDigits(
  operationsPage: AejsOperationsPage,
  name: string,
  value: string,
): Promise<void> {
  const actualValue = await operationsPage.getVisibleField(name).inputValue();
  expect(actualValue.replace(/\D/g, "")).toBe(value.replace(/\D/g, ""));
}

test(
  "Portal → AEJS | valida terceiro e garantidor da operação PF",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }) => {
    const scenario = getIntegrationPreparationScenario("INT-CONFIRM-PF");
    const { thirdParty, guarantor } = scenario.preparation;
    const operationsPage = new AejsOperationsPage(aejsPage);

    await test.step("abre a operação confirmada", async () => {
      await operationsPage.navigateToOperations();
      await operationsPage.openOperation(scenario.operationNumber);
      await expect(operationsPage.openedOperationNumber).toHaveValue(
        scenario.operationNumber,
      );
    });

    await test.step("valida terceiro na composição de renda", async () => {
      await operationsPage.openVisibleGridRow(thirdParty.name);

      await expectFieldDigits(
        operationsPage,
        "PESSOA$NU_CPFCNPJ",
        thirdParty.cpf,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_PESSOA",
        thirdParty.name,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$DT_NASCIMENTO",
        formatDate(thirdParty.dateOfBirth),
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_NACIONALIDADE",
        thirdParty.nationality,
      );
      await expect(
        operationsPage.getVisibleInput("PESSOA$IN_EADQUIRENTE"),
      ).toBeChecked();
      await expect(
        operationsPage.getVisibleInput("PESSOA$IN_E_PRINCIPAL"),
      ).not.toBeChecked();
      await expect(
        operationsPage.getVisibleInput("PESSOA$IN_AUTORZC"),
      ).toBeChecked();
      await expect(
        operationsPage.getVisibleField("PESSOA$DT_AUTORZC"),
      ).toHaveValue(/\S/);

      await operationsPage.selectVisibleTab("Dados de Contato");
      await expectFieldValue(
        operationsPage,
        "PESSOA$NU_DDD_CEL",
        thirdParty.mobileAreaCode,
      );
      await expectFieldDigits(
        operationsPage,
        "PESSOA$NU_CELULAR",
        thirdParty.mobileNumber,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_EMAIL",
        thirdParty.email,
      );

      await operationsPage.selectVisibleTab("Ocupação");
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_ATIVIDADE_PROFISSIONAL",
        thirdParty.professionalActivity,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_PROFISSAO",
        thirdParty.profession,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$VA_RENDA_BRUTA",
        formatCurrency(thirdParty.grossIncome),
      );

      await operationsPage.closeCurrentWindow();
    });

    await test.step("valida garantidor PF", async () => {
      await operationsPage.selectVisibleTab("Imóvel Operação");
      await operationsPage.selectVisibleTab("Garantidor Pessoa Física");
      await operationsPage.openVisibleGridRow(guarantor.name);

      await expectFieldDigits(
        operationsPage,
        "PESSOA$NU_CPFCNPJ",
        guarantor.cpf,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_PESSOA",
        guarantor.name,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$DT_NASCIMENTO",
        formatDate(guarantor.dateOfBirth),
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_ESTCIV",
        getMappedValue(
          maritalStatusLabels,
          guarantor.maritalStatus,
          "Estado civil",
        ),
      );

      await operationsPage.selectVisibleTab("Dados de Contato");
      await expectFieldDigits(
        operationsPage,
        "PESSOA$NU_CEP",
        guarantor.address.postalCode,
      );
      await expect(
        operationsPage.getVisibleField("PESSOA$NO_ENDERECO"),
      ).toHaveValue(new RegExp(guarantor.address.street));
      await expect(
        operationsPage.getVisibleField("PESSOA$NO_ENDERECO"),
      ).toHaveValue(new RegExp(guarantor.address.streetNumber));
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_COMPLEMENTO",
        guarantor.address.complement,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_UF",
        guarantor.address.state,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_MUNICIPIO",
        guarantor.address.city,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_BAIRRO",
        guarantor.address.neighborhood,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$NU_DDD_CEL",
        guarantor.mobileAreaCode,
      );
      await expectFieldDigits(
        operationsPage,
        "PESSOA$NU_CELULAR",
        guarantor.mobileNumber,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_EMAIL",
        guarantor.email,
      );

      await operationsPage.closeCurrentWindow();
    });
  },
);
