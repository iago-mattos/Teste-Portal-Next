import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import {
  getIntegrationPreparationScenario,
  type GuarantorPartnerInput,
} from "../../test-data/integration-data";

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
  "2": "Casado",
};

const propertyConditionLabels: Readonly<Record<string, string>> = {
  "6": "Em nome de empresa (PJ) alienado/financiado",
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

async function validatePartner(
  operationsPage: AejsOperationsPage,
  partner: GuarantorPartnerInput,
): Promise<void> {
  await operationsPage.openVisibleGridRow(partner.name);
  await expectFieldDigits(operationsPage, "NU_CPFCNPJ", partner.cpf);
  await expectFieldValue(operationsPage, "NO_PESSOA", partner.name);
  await expectFieldValue(
    operationsPage,
    "DT_NASCIMENTO",
    formatDate(partner.dateOfBirth),
  );

  await operationsPage.selectVisibleTab("Dados de Contato");
  await expectFieldValue(operationsPage, "NU_DDD_CEL", partner.mobileAreaCode);
  await expectFieldDigits(
    operationsPage,
    "NU_CELULAR",
    partner.mobileNumber,
  );
  await expectFieldValue(operationsPage, "NO_EMAIL", partner.email);
  await operationsPage.closeCurrentWindow();
}

test(
  "Portal → AEJS | valida os dados confirmados da operação PJ",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }) => {
    const scenario = getIntegrationPreparationScenario("INT-CONFIRM-PJ");
    const { applicant, spouse, creditPurpose, property, guarantor } =
      scenario.preparation;
    const operationsPage = new AejsOperationsPage(aejsPage);

    await test.step("abre a operação confirmada", async () => {
      await operationsPage.navigateToOperations();
      await operationsPage.openOperation(scenario.operationNumber);
      await expect(operationsPage.openedOperationNumber).toHaveValue(
        scenario.operationNumber,
      );
    });

    await test.step("valida titular e cônjuge", async () => {
      const applicantName = await operationsPage.openPrimaryApplicant(
        spouse.name,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_PESSOA",
        applicantName,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_NACIONALIDADE",
        applicant.nationality,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_UFIDENTIDADE",
        applicant.identityState,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_ESTCIV",
        getMappedValue(
          maritalStatusLabels,
          applicant.maritalStatus,
          "Estado civil",
        ),
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_REGIME_CASAMENTO",
        spouse.marriageRegime,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$DT_CASAMENTO",
        formatDate(spouse.marriageDate),
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_UFNASC",
        applicant.birthState,
      );
      await expect(
        operationsPage.getVisibleInput("PESSOA$IN_E_PRINCIPAL"),
      ).toBeChecked();
      await expect(
        operationsPage.getVisibleInput("PESSOA$IN_EADQUIRENTE"),
      ).toBeChecked();

      await operationsPage.selectVisibleTab("Ocupação");
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_ATIVIDADE_PROFISSIONAL",
        applicant.professionalActivity,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_PROFISSAO",
        applicant.profession,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$VA_RENDA_BRUTA",
        formatCurrency(applicant.grossIncome),
      );

      await operationsPage.selectVisibleTab("Cônjuge");
      await expectFieldDigits(
        operationsPage,
        "CONJUGE$NU_CPFCNPJ",
        spouse.cpf,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$NO_PESSOA",
        spouse.name,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$DT_NASCIMENTO",
        formatDate(spouse.dateOfBirth),
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$CO_NACIONALIDADE",
        spouse.nationality,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$CO_UFIDENTIDADE",
        spouse.identityState,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$CO_ESTCIV",
        getMappedValue(
          maritalStatusLabels,
          applicant.maritalStatus,
          "Estado civil",
        ),
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$CO_REGIME_CASAMENTO",
        spouse.marriageRegime,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$DT_CASAMENTO",
        formatDate(spouse.marriageDate),
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$CO_UFNASC",
        spouse.birthState,
      );
      await expect(
        operationsPage.getVisibleInput("CONJUGE$IN_EADQUIRENTE"),
      ).toBeChecked();
      await expect(
        operationsPage.getVisibleInput("CONJUGE$IN_AUTORZC"),
      ).toBeChecked();

      await operationsPage.selectVisibleTab("Dados de Contato");
      await expectFieldValue(
        operationsPage,
        "CONJUGE$NU_DDD_CEL",
        spouse.mobileAreaCode,
      );
      await expectFieldDigits(
        operationsPage,
        "CONJUGE$NU_CELULAR",
        spouse.mobileNumber,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$NO_EMAIL",
        spouse.email,
      );

      await operationsPage.selectVisibleTab("Ocupação");
      await expectFieldValue(
        operationsPage,
        "CONJUGE$CO_ATIVIDADE_PROFISSIONAL",
        spouse.professionalActivity,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$CO_PROFISSAO",
        spouse.profession,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$VA_RENDA_BRUTA",
        formatCurrency(spouse.grossIncome),
      );

      await operationsPage.closeCurrentWindow();
    });

    await test.step("valida finalidade e motivo do crédito", async () => {
      await operationsPage.selectVisibleTab("Finalidade do Crédito");
      await expect(
        operationsPage.getVisibleText(creditPurpose.purpose),
      ).toBeVisible();
      await expectFieldValue(
        operationsPage,
        "OPERACAO_CREDITO$TE_OBS_MOTIVO_EMPRESTIMO",
        creditPurpose.description,
      );
    });

    await test.step("valida os dados preparados do imóvel", async () => {
      await operationsPage.selectVisibleTab("Imóvel Operação");
      await operationsPage.selectVisibleTab("Dados do imóvel");
      await expectFieldValue(
        operationsPage,
        "IMOVEL_OPERACAO$IN_USO_DO_IMOVEL",
        property.use,
      );
      await expectFieldValue(
        operationsPage,
        "IMOVEL_OPERACAO$IN_TIPO_IMOVEL",
        property.type.toUpperCase(),
      );
      await expectFieldValue(
        operationsPage,
        "IMOVEL_OPERACAO$CO_CONDICAO_IMOVEL",
        getMappedValue(
          propertyConditionLabels,
          property.condition,
          "Condição do imóvel",
        ),
      );
      await expect(
        operationsPage.getVisibleField("IMOVEL_OPERACAO$NO_ENDERECO"),
      ).toHaveValue(/\S/);
    });

    await test.step("valida garantidor PJ e os dois sócios", async () => {
      await operationsPage.selectVisibleTab("Garantidor Pessoa Jurídica");
      await operationsPage.openVisibleGridRow(guarantor.companyName);

      await expectFieldDigits(
        operationsPage,
        "PESSOA$NU_CPFCNPJ",
        guarantor.cnpj,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_PESSOA",
        guarantor.companyName,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$DT_NASCIMENTO",
        formatDate(guarantor.foundationDate),
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$NU_CEP",
        guarantor.address.postalCode,
      );
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
        "PESSOA$NO_BAIRRO",
        guarantor.address.neighborhood,
      );
      await expect(
        operationsPage.getVisibleField("PESSOA$CO_UF"),
      ).toHaveValue(/\S/);
      await expect(
        operationsPage.getVisibleField("PESSOA$CO_MUNICIPIO"),
      ).toHaveValue(/\S/);
      await expectFieldDigits(
        operationsPage,
        "PESSOA$NU_TELEFONE_COM",
        guarantor.phone,
      );

      await operationsPage.selectVisibleTab("Sócios/Representantes");
      await validatePartner(operationsPage, guarantor.partners[0]);
      await validatePartner(operationsPage, guarantor.partners[1]);
      await operationsPage.closeCurrentWindow();
    });
  },
);
