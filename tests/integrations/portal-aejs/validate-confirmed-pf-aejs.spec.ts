import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import {
  attachFunctionalEvidence,
  checkedEvidenceField,
  inputEvidenceField,
  type EvidenceMask,
  type FunctionalEvidenceField,
} from "../../fixtures/evidence";
import { getIntegrationPreparationScenario } from "../../test-data/integration-data";

const scenarioId = "INT-CONFIRM-PF";

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

function aejsInputEvidence(
  operationsPage: AejsOperationsPage,
  label: string,
  fieldName: string,
  expected: string | number,
  mask: EvidenceMask = "none",
): Promise<FunctionalEvidenceField> {
  return inputEvidenceField(
    label,
    operationsPage.getVisibleField(fieldName),
    expected,
    mask,
  );
}

test(
  "Portal → AEJS | valida terceiro e garantidor da operação PF",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }, testInfo) => {
    const scenario = getIntegrationPreparationScenario(scenarioId);
    const { thirdParty, guarantor } = scenario.preparation;
    const operationsPage = new AejsOperationsPage(aejsPage);

    await test.step("abre a operação confirmada", async () => {
      await operationsPage.navigateToOperations();
      await operationsPage.openOperation(scenario.operationNumber);
      await expect(operationsPage.openedOperationNumber).toHaveValue(
        scenario.operationNumber,
      );
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 1,
        slug: "pf-operacao-aberta",
        title: "Operação PF aberta no SCCI",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: [
          await inputEvidenceField(
            "Operação",
            operationsPage.openedOperationNumber,
            scenario.operationNumber,
            "operation",
          ),
        ],
      });
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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 2,
        slug: "pf-terceiro-dados-pessoais",
        title: "Terceiro — dados pessoais e autorização SCR",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "CPF",
            "PESSOA$NU_CPFCNPJ",
            thirdParty.cpf,
            "tax-id",
          ),
          aejsInputEvidence(
            operationsPage,
            "Nome",
            "PESSOA$NO_PESSOA",
            thirdParty.name,
            "name",
          ),
          aejsInputEvidence(
            operationsPage,
            "Nascimento",
            "PESSOA$DT_NASCIMENTO",
            formatDate(thirdParty.dateOfBirth),
            "date",
          ),
          aejsInputEvidence(
            operationsPage,
            "Nacionalidade",
            "PESSOA$CO_NACIONALIDADE",
            thirdParty.nationality,
          ),
          checkedEvidenceField(
            "Composição de renda",
            operationsPage.getVisibleInput("PESSOA$IN_EADQUIRENTE"),
            true,
          ),
          checkedEvidenceField(
            "Pretendente principal",
            operationsPage.getVisibleInput("PESSOA$IN_E_PRINCIPAL"),
            false,
          ),
          checkedEvidenceField(
            "Autorização SCR",
            operationsPage.getVisibleInput("PESSOA$IN_AUTORZC"),
            true,
          ),
          aejsInputEvidence(
            operationsPage,
            "Data da autorização SCR",
            "PESSOA$DT_AUTORZC",
            await operationsPage
              .getVisibleField("PESSOA$DT_AUTORZC")
              .inputValue(),
            "date",
          ),
        ]),
      });

      await operationsPage.selectVisibleTab("Dados de Contato");
      await expectFieldDigits(
        operationsPage,
        "PESSOA$NU_CEP",
        thirdParty.address.postalCode,
      );
      await expect(
        operationsPage.getVisibleField("PESSOA$NO_ENDERECO"),
      ).toHaveValue(new RegExp(thirdParty.address.street));
      await expect(
        operationsPage.getVisibleField("PESSOA$NO_ENDERECO"),
      ).toHaveValue(new RegExp(thirdParty.address.streetNumber));
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_COMPLEMENTO",
        thirdParty.address.complement,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_BAIRRO",
        thirdParty.address.neighborhood,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_MUNICIPIO",
        thirdParty.address.city,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_UF",
        thirdParty.address.state,
      );
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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 3,
        slug: "pf-terceiro-endereco-contato",
        title: "Terceiro — endereço e contato",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "CEP",
            "PESSOA$NU_CEP",
            thirdParty.address.postalCode,
            "postal-code",
          ),
          aejsInputEvidence(
            operationsPage,
            "Endereço",
            "PESSOA$NO_ENDERECO",
            `${thirdParty.address.street}, ${thirdParty.address.streetNumber}`,
            "address",
          ),
          aejsInputEvidence(
            operationsPage,
            "Complemento",
            "PESSOA$NO_COMPLEMENTO",
            thirdParty.address.complement,
          ),
          aejsInputEvidence(
            operationsPage,
            "Bairro",
            "PESSOA$NO_BAIRRO",
            thirdParty.address.neighborhood,
          ),
          aejsInputEvidence(
            operationsPage,
            "Município",
            "PESSOA$CO_MUNICIPIO",
            thirdParty.address.city,
          ),
          aejsInputEvidence(
            operationsPage,
            "UF",
            "PESSOA$CO_UF",
            thirdParty.address.state,
          ),
          aejsInputEvidence(
            operationsPage,
            "DDD celular",
            "PESSOA$NU_DDD_CEL",
            thirdParty.mobileAreaCode,
            "phone",
          ),
          aejsInputEvidence(
            operationsPage,
            "Celular",
            "PESSOA$NU_CELULAR",
            thirdParty.mobileNumber,
            "phone",
          ),
          aejsInputEvidence(
            operationsPage,
            "E-mail",
            "PESSOA$NO_EMAIL",
            thirdParty.email,
            "email",
          ),
        ]),
      });

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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 4,
        slug: "pf-terceiro-ocupacao",
        title: "Terceiro — ocupação e renda",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "Atividade profissional",
            "PESSOA$CO_ATIVIDADE_PROFISSIONAL",
            thirdParty.professionalActivity,
          ),
          aejsInputEvidence(
            operationsPage,
            "Profissão",
            "PESSOA$CO_PROFISSAO",
            thirdParty.profession,
          ),
          aejsInputEvidence(
            operationsPage,
            "Renda bruta",
            "PESSOA$VA_RENDA_BRUTA",
            formatCurrency(thirdParty.grossIncome),
          ),
        ]),
      });

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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 5,
        slug: "pf-garantidor-dados-pessoais",
        title: "Garantidor PF — dados pessoais",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "CPF",
            "PESSOA$NU_CPFCNPJ",
            guarantor.cpf,
            "tax-id",
          ),
          aejsInputEvidence(
            operationsPage,
            "Nome",
            "PESSOA$NO_PESSOA",
            guarantor.name,
            "name",
          ),
          aejsInputEvidence(
            operationsPage,
            "Nascimento",
            "PESSOA$DT_NASCIMENTO",
            formatDate(guarantor.dateOfBirth),
            "date",
          ),
          aejsInputEvidence(
            operationsPage,
            "Estado civil",
            "PESSOA$CO_ESTCIV",
            getMappedValue(
              maritalStatusLabels,
              guarantor.maritalStatus,
              "Estado civil",
            ),
          ),
        ]),
      });

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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 6,
        slug: "pf-garantidor-endereco-contato",
        title: "Garantidor PF — endereço e contato",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "CEP",
            "PESSOA$NU_CEP",
            guarantor.address.postalCode,
            "postal-code",
          ),
          aejsInputEvidence(
            operationsPage,
            "Endereço",
            "PESSOA$NO_ENDERECO",
            `${guarantor.address.street}, ${guarantor.address.streetNumber}`,
            "address",
          ),
          aejsInputEvidence(
            operationsPage,
            "Complemento",
            "PESSOA$NO_COMPLEMENTO",
            guarantor.address.complement,
          ),
          aejsInputEvidence(
            operationsPage,
            "UF",
            "PESSOA$CO_UF",
            guarantor.address.state,
          ),
          aejsInputEvidence(
            operationsPage,
            "Município",
            "PESSOA$CO_MUNICIPIO",
            guarantor.address.city,
          ),
          aejsInputEvidence(
            operationsPage,
            "Bairro",
            "PESSOA$NO_BAIRRO",
            guarantor.address.neighborhood,
          ),
          aejsInputEvidence(
            operationsPage,
            "DDD celular",
            "PESSOA$NU_DDD_CEL",
            guarantor.mobileAreaCode,
            "phone",
          ),
          aejsInputEvidence(
            operationsPage,
            "Celular",
            "PESSOA$NU_CELULAR",
            guarantor.mobileNumber,
            "phone",
          ),
          aejsInputEvidence(
            operationsPage,
            "E-mail",
            "PESSOA$NO_EMAIL",
            guarantor.email,
            "email",
          ),
        ]),
      });

      await operationsPage.closeCurrentWindow();
    });
  },
);
