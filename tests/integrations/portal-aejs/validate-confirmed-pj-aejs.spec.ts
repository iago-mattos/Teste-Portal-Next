import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import {
  attachFunctionalEvidence,
  checkedEvidenceField,
  inputEvidenceField,
  textEvidenceField,
  type EvidenceMask,
  type FunctionalEvidenceField,
} from "../../fixtures/evidence";
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

const scenarioId = "INT-CONFIRM-PJ";

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
): Promise<readonly FunctionalEvidenceField[]> {
  await operationsPage.openVisibleGridRow(partner.name);
  await expectFieldDigits(operationsPage, "NU_CPFCNPJ", partner.cpf);
  await expectFieldValue(operationsPage, "NO_PESSOA", partner.name);
  await expectFieldValue(
    operationsPage,
    "DT_NASCIMENTO",
    formatDate(partner.dateOfBirth),
  );

  const fields: FunctionalEvidenceField[] = await Promise.all([
    inputEvidenceField(
      "CPF do sócio",
      operationsPage.getVisibleField("NU_CPFCNPJ"),
      partner.cpf,
      "tax-id",
    ),
    inputEvidenceField(
      "Nome do sócio",
      operationsPage.getVisibleField("NO_PESSOA"),
      partner.name,
      "name",
    ),
    inputEvidenceField(
      "Nascimento do sócio",
      operationsPage.getVisibleField("DT_NASCIMENTO"),
      formatDate(partner.dateOfBirth),
      "date",
    ),
  ]);

  await operationsPage.selectVisibleTab("Dados de Contato");
  await expectFieldValue(operationsPage, "NU_DDD_CEL", partner.mobileAreaCode);
  await expectFieldDigits(
    operationsPage,
    "NU_CELULAR",
    partner.mobileNumber,
  );
  await expectFieldValue(operationsPage, "NO_EMAIL", partner.email);

  fields.push(
    ...(await Promise.all([
      inputEvidenceField(
        "DDD celular",
        operationsPage.getVisibleField("NU_DDD_CEL"),
        partner.mobileAreaCode,
        "phone",
      ),
      inputEvidenceField(
        "Celular",
        operationsPage.getVisibleField("NU_CELULAR"),
        partner.mobileNumber,
        "phone",
      ),
      inputEvidenceField(
        "E-mail",
        operationsPage.getVisibleField("NO_EMAIL"),
        partner.email,
        "email",
      ),
    ])),
  );
  return fields;
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
  "Portal → AEJS | valida os dados confirmados da operação PJ",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }, testInfo) => {
    const scenario = getIntegrationPreparationScenario(scenarioId);
    const {
      applicant,
      spouse,
      creditPurpose,
      property,
      guarantor,
      aejsReflection,
    } = scenario.preparation;
    const provisionedApplicant = scenario.provisionedMass?.applicant;
    const expectedApplicantName =
      provisionedApplicant?.name.toLocaleUpperCase("pt-BR");
    const expectedApplicantCpf =
      provisionedApplicant?.cpf ?? aejsReflection.applicant.cpf;
    const expectedApplicantBirthDate = formatDate(
      provisionedApplicant?.dateOfBirth ??
        aejsReflection.applicant.dateOfBirth,
    );
    const expectedScrAuthorizationDate = formatDate(
      provisionedApplicant?.expectedScrAuthorizationDate ??
        aejsReflection.applicant.generatedScrAuthorizationDate,
    );
    const operationsPage = new AejsOperationsPage(aejsPage);

    await test.step("abre a operação confirmada", async () => {
      await operationsPage.navigateToOperations();
      await operationsPage.openOperation(scenario.operationNumber);
      await expect(operationsPage.openedOperationNumber).toHaveValue(
        scenario.operationNumber,
      );
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 1,
        slug: "pj-operacao-aberta",
        title: "Operação PJ aberta no SCCI",
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

    await test.step("valida titular e cônjuge", async () => {
      const applicantName = await operationsPage.openPrimaryApplicant(
        spouse.name,
      );
      if (provisionedApplicant) {
        expect(applicantName).toBe(expectedApplicantName);
      }
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_PESSOA",
        expectedApplicantName ?? applicantName,
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
      await expectFieldDigits(
        operationsPage,
        "PESSOA$NU_CPFCNPJ",
        expectedApplicantCpf,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$DT_NASCIMENTO",
        expectedApplicantBirthDate,
      );
      await expect(
        operationsPage.getVisibleInput("PESSOA$IN_E_PRINCIPAL"),
      ).toBeChecked();
      await expect(
        operationsPage.getVisibleInput("PESSOA$IN_EADQUIRENTE"),
      ).toBeChecked();
      await expect(
        operationsPage.getVisibleInput("PESSOA$IN_AUTORZC"),
      ).toBeChecked();
      await expectFieldValue(
        operationsPage,
        "PESSOA$DT_AUTORZC",
        expectedScrAuthorizationDate,
      );

      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 2,
        slug: "pj-titular-dados-pessoais",
        title: "Titular — dados pessoais e autorização SCR",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "Nome",
            "PESSOA$NO_PESSOA",
            expectedApplicantName ?? applicantName,
            "name",
          ),
          aejsInputEvidence(
            operationsPage,
            "CPF",
            "PESSOA$NU_CPFCNPJ",
            expectedApplicantCpf,
            "tax-id",
          ),
          aejsInputEvidence(
            operationsPage,
            "Nascimento",
            "PESSOA$DT_NASCIMENTO",
            expectedApplicantBirthDate,
            "date",
          ),
          aejsInputEvidence(
            operationsPage,
            "Nacionalidade",
            "PESSOA$CO_NACIONALIDADE",
            applicant.nationality,
          ),
          aejsInputEvidence(
            operationsPage,
            "UF identidade",
            "PESSOA$CO_UFIDENTIDADE",
            applicant.identityState,
          ),
          aejsInputEvidence(
            operationsPage,
            "Estado civil",
            "PESSOA$CO_ESTCIV",
            getMappedValue(
              maritalStatusLabels,
              applicant.maritalStatus,
              "Estado civil",
            ),
          ),
          aejsInputEvidence(
            operationsPage,
            "Regime de casamento",
            "PESSOA$CO_REGIME_CASAMENTO",
            spouse.marriageRegime,
          ),
          aejsInputEvidence(
            operationsPage,
            "Data do casamento",
            "PESSOA$DT_CASAMENTO",
            formatDate(spouse.marriageDate),
            "date",
          ),
          aejsInputEvidence(
            operationsPage,
            "UF naturalidade",
            "PESSOA$CO_UFNASC",
            applicant.birthState,
          ),
          checkedEvidenceField(
            "Pretendente principal",
            operationsPage.getVisibleInput("PESSOA$IN_E_PRINCIPAL"),
            true,
          ),
          checkedEvidenceField(
            "Composição de renda",
            operationsPage.getVisibleInput("PESSOA$IN_EADQUIRENTE"),
            true,
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
            expectedScrAuthorizationDate,
            "date",
          ),
        ]),
      });

      await operationsPage.selectVisibleTab("Dados de Contato");
      if (!provisionedApplicant) {
        await expectFieldDigits(
          operationsPage,
          "PESSOA$NU_CEP",
          aejsReflection.applicant.residentialAddress.postalCode,
        );
        await expectFieldValue(
          operationsPage,
          "PESSOA$NO_ENDERECO",
          aejsReflection.applicant.residentialAddress.fullAddress,
        );
        await expectFieldValue(
          operationsPage,
          "PESSOA$NO_COMPLEMENTO",
          aejsReflection.applicant.residentialAddress.complement,
        );
        await expectFieldValue(
          operationsPage,
          "PESSOA$NO_BAIRRO",
          aejsReflection.applicant.residentialAddress.neighborhood,
        );
        await expectFieldValue(
          operationsPage,
          "PESSOA$CO_MUNICIPIO",
          aejsReflection.applicant.residentialAddress.city,
        );
        await expectFieldValue(
          operationsPage,
          "PESSOA$CO_UF",
          aejsReflection.applicant.residentialAddress.state,
        );
        await attachFunctionalEvidence(aejsPage, testInfo, {
          order: 3,
          slug: "pj-titular-endereco",
          title: "Titular — endereço residencial",
          scenario: scenarioId,
          operationNumber: scenario.operationNumber,
          fields: await Promise.all([
            aejsInputEvidence(
              operationsPage,
              "CEP",
              "PESSOA$NU_CEP",
              aejsReflection.applicant.residentialAddress.postalCode,
              "postal-code",
            ),
            aejsInputEvidence(
              operationsPage,
              "Endereço",
              "PESSOA$NO_ENDERECO",
              aejsReflection.applicant.residentialAddress.fullAddress,
              "address",
            ),
            aejsInputEvidence(
              operationsPage,
              "Complemento",
              "PESSOA$NO_COMPLEMENTO",
              aejsReflection.applicant.residentialAddress.complement,
            ),
            aejsInputEvidence(
              operationsPage,
              "Bairro",
              "PESSOA$NO_BAIRRO",
              aejsReflection.applicant.residentialAddress.neighborhood,
            ),
            aejsInputEvidence(
              operationsPage,
              "Município",
              "PESSOA$CO_MUNICIPIO",
              aejsReflection.applicant.residentialAddress.city,
            ),
            aejsInputEvidence(
              operationsPage,
              "UF",
              "PESSOA$CO_UF",
              aejsReflection.applicant.residentialAddress.state,
            ),
          ]),
        });
      }

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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 4,
        slug: "pj-titular-ocupacao",
        title: "Titular — ocupação e renda",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "Atividade profissional",
            "PESSOA$CO_ATIVIDADE_PROFISSIONAL",
            applicant.professionalActivity,
          ),
          aejsInputEvidence(
            operationsPage,
            "Profissão",
            "PESSOA$CO_PROFISSAO",
            applicant.profession,
          ),
          aejsInputEvidence(
            operationsPage,
            "Renda bruta",
            "PESSOA$VA_RENDA_BRUTA",
            formatCurrency(applicant.grossIncome),
          ),
        ]),
      });

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
      await expectFieldValue(
        operationsPage,
        "CONJUGE$DT_AUTORZC",
        formatDate(
          provisionedApplicant?.expectedScrAuthorizationDate ??
          aejsReflection.spouse.generatedScrAuthorizationDate,
        ),
      );
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 5,
        slug: "pj-conjuge-dados-pessoais",
        title: "Cônjuge — dados pessoais e autorização SCR",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "CPF",
            "CONJUGE$NU_CPFCNPJ",
            spouse.cpf,
            "tax-id",
          ),
          aejsInputEvidence(
            operationsPage,
            "Nome",
            "CONJUGE$NO_PESSOA",
            spouse.name,
            "name",
          ),
          aejsInputEvidence(
            operationsPage,
            "Nascimento",
            "CONJUGE$DT_NASCIMENTO",
            formatDate(spouse.dateOfBirth),
            "date",
          ),
          aejsInputEvidence(
            operationsPage,
            "Nacionalidade",
            "CONJUGE$CO_NACIONALIDADE",
            spouse.nationality,
          ),
          aejsInputEvidence(
            operationsPage,
            "UF identidade",
            "CONJUGE$CO_UFIDENTIDADE",
            spouse.identityState,
          ),
          aejsInputEvidence(
            operationsPage,
            "Estado civil",
            "CONJUGE$CO_ESTCIV",
            getMappedValue(
              maritalStatusLabels,
              applicant.maritalStatus,
              "Estado civil",
            ),
          ),
          aejsInputEvidence(
            operationsPage,
            "Regime de casamento",
            "CONJUGE$CO_REGIME_CASAMENTO",
            spouse.marriageRegime,
          ),
          aejsInputEvidence(
            operationsPage,
            "Data do casamento",
            "CONJUGE$DT_CASAMENTO",
            formatDate(spouse.marriageDate),
            "date",
          ),
          aejsInputEvidence(
            operationsPage,
            "UF naturalidade",
            "CONJUGE$CO_UFNASC",
            spouse.birthState,
          ),
          checkedEvidenceField(
            "Composição de renda",
            operationsPage.getVisibleInput("CONJUGE$IN_EADQUIRENTE"),
            true,
          ),
          checkedEvidenceField(
            "Autorização SCR",
            operationsPage.getVisibleInput("CONJUGE$IN_AUTORZC"),
            true,
          ),
          aejsInputEvidence(
            operationsPage,
            "Data da autorização SCR",
            "CONJUGE$DT_AUTORZC",
            formatDate(
              provisionedApplicant?.expectedScrAuthorizationDate ??
                aejsReflection.spouse.generatedScrAuthorizationDate,
            ),
            "date",
          ),
        ]),
      });

      await operationsPage.selectVisibleTab("Dados de Contato");
      await expectFieldDigits(
        operationsPage,
        "CONJUGE$NU_CEP",
        spouse.address.postalCode,
      );
      await expect(
        operationsPage.getVisibleField("CONJUGE$NO_ENDERECO"),
      ).toHaveValue(new RegExp(spouse.address.street));
      await expect(
        operationsPage.getVisibleField("CONJUGE$NO_ENDERECO"),
      ).toHaveValue(new RegExp(spouse.address.streetNumber));
      await expectFieldValue(
        operationsPage,
        "CONJUGE$NO_COMPLEMENTO",
        spouse.address.complement,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$NO_BAIRRO",
        spouse.address.neighborhood,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$CO_MUNICIPIO",
        spouse.address.city,
      );
      await expectFieldValue(
        operationsPage,
        "CONJUGE$CO_UF",
        spouse.address.state,
      );
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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 6,
        slug: "pj-conjuge-endereco-contato",
        title: "Cônjuge — endereço e contato",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "CEP",
            "CONJUGE$NU_CEP",
            spouse.address.postalCode,
            "postal-code",
          ),
          aejsInputEvidence(
            operationsPage,
            "Endereço",
            "CONJUGE$NO_ENDERECO",
            `${spouse.address.street}, ${spouse.address.streetNumber}`,
            "address",
          ),
          aejsInputEvidence(
            operationsPage,
            "Complemento",
            "CONJUGE$NO_COMPLEMENTO",
            spouse.address.complement,
          ),
          aejsInputEvidence(
            operationsPage,
            "Bairro",
            "CONJUGE$NO_BAIRRO",
            spouse.address.neighborhood,
          ),
          aejsInputEvidence(
            operationsPage,
            "Município",
            "CONJUGE$CO_MUNICIPIO",
            spouse.address.city,
          ),
          aejsInputEvidence(
            operationsPage,
            "UF",
            "CONJUGE$CO_UF",
            spouse.address.state,
          ),
          aejsInputEvidence(
            operationsPage,
            "DDD celular",
            "CONJUGE$NU_DDD_CEL",
            spouse.mobileAreaCode,
            "phone",
          ),
          aejsInputEvidence(
            operationsPage,
            "Celular",
            "CONJUGE$NU_CELULAR",
            spouse.mobileNumber,
            "phone",
          ),
          aejsInputEvidence(
            operationsPage,
            "E-mail",
            "CONJUGE$NO_EMAIL",
            spouse.email,
            "email",
          ),
        ]),
      });

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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 7,
        slug: "pj-conjuge-ocupacao",
        title: "Cônjuge — ocupação e renda",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "Atividade profissional",
            "CONJUGE$CO_ATIVIDADE_PROFISSIONAL",
            spouse.professionalActivity,
          ),
          aejsInputEvidence(
            operationsPage,
            "Profissão",
            "CONJUGE$CO_PROFISSAO",
            spouse.profession,
          ),
          aejsInputEvidence(
            operationsPage,
            "Renda bruta",
            "CONJUGE$VA_RENDA_BRUTA",
            formatCurrency(spouse.grossIncome),
          ),
        ]),
      });

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
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 8,
        slug: "pj-finalidade-credito",
        title: "Finalidade e motivo do crédito",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: [
          await textEvidenceField(
            "Finalidade",
            operationsPage.getVisibleText(creditPurpose.purpose),
            creditPurpose.purpose,
          ),
          await aejsInputEvidence(
            operationsPage,
            "Motivo",
            "OPERACAO_CREDITO$TE_OBS_MOTIVO_EMPRESTIMO",
            creditPurpose.description,
          ),
        ],
      });
    });

    await test.step("valida os dados preparados do imóvel", async () => {
      await operationsPage.selectVisibleTab("Imóvel Operação");
      await operationsPage.selectVisibleTab("Dados do imóvel");
      await expectFieldValue(
        operationsPage,
        "IMOVEL_OPERACAO$VA_AVALIACAO_PROVISORIA",
        formatCurrency(
          scenario.provisionedMass?.propertyValueCents ??
            aejsReflection.property.appraisalValue,
        ),
      );
      if (!scenario.provisionedMass) {
        await expectFieldDigits(
          operationsPage,
          "IMOVEL_OPERACAO$NU_CEP",
          aejsReflection.property.address.postalCode,
        );
        await expectFieldValue(
          operationsPage,
          "IMOVEL_OPERACAO$NO_ENDERECO",
          aejsReflection.property.address.fullAddress,
        );
        await expectFieldValue(
          operationsPage,
          "IMOVEL_OPERACAO$NO_COMPLEMENTO",
          aejsReflection.property.address.complement,
        );
        await expectFieldValue(
          operationsPage,
          "IMOVEL_OPERACAO$NO_BAIRRO",
          aejsReflection.property.address.neighborhood,
        );
        await expectFieldValue(
          operationsPage,
          "IMOVEL_OPERACAO$NU_MUNICIPIO",
          aejsReflection.property.address.city,
        );
        await expectFieldValue(
          operationsPage,
          "IMOVEL_OPERACAO$CO_UF",
          aejsReflection.property.address.state,
        );
      }
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
      const propertyEvidence: FunctionalEvidenceField[] = await Promise.all([
        aejsInputEvidence(
          operationsPage,
          "Avaliação provisória",
          "IMOVEL_OPERACAO$VA_AVALIACAO_PROVISORIA",
          formatCurrency(
            scenario.provisionedMass?.propertyValueCents ??
              aejsReflection.property.appraisalValue,
          ),
        ),
        aejsInputEvidence(
          operationsPage,
          "Uso do imóvel",
          "IMOVEL_OPERACAO$IN_USO_DO_IMOVEL",
          property.use,
        ),
        aejsInputEvidence(
          operationsPage,
          "Tipo do imóvel",
          "IMOVEL_OPERACAO$IN_TIPO_IMOVEL",
          property.type.toUpperCase(),
        ),
        aejsInputEvidence(
          operationsPage,
          "Condição do imóvel",
          "IMOVEL_OPERACAO$CO_CONDICAO_IMOVEL",
          getMappedValue(
            propertyConditionLabels,
            property.condition,
            "Condição do imóvel",
          ),
        ),
      ]);
      if (!scenario.provisionedMass) {
        propertyEvidence.push(
          ...(await Promise.all([
            aejsInputEvidence(
              operationsPage,
              "CEP",
              "IMOVEL_OPERACAO$NU_CEP",
              aejsReflection.property.address.postalCode,
              "postal-code",
            ),
            aejsInputEvidence(
              operationsPage,
              "Endereço",
              "IMOVEL_OPERACAO$NO_ENDERECO",
              aejsReflection.property.address.fullAddress,
              "address",
            ),
            aejsInputEvidence(
              operationsPage,
              "Complemento",
              "IMOVEL_OPERACAO$NO_COMPLEMENTO",
              aejsReflection.property.address.complement,
            ),
            aejsInputEvidence(
              operationsPage,
              "Bairro",
              "IMOVEL_OPERACAO$NO_BAIRRO",
              aejsReflection.property.address.neighborhood,
            ),
            aejsInputEvidence(
              operationsPage,
              "Município",
              "IMOVEL_OPERACAO$NU_MUNICIPIO",
              aejsReflection.property.address.city,
            ),
            aejsInputEvidence(
              operationsPage,
              "UF",
              "IMOVEL_OPERACAO$CO_UF",
              aejsReflection.property.address.state,
            ),
          ])),
        );
      }
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 9,
        slug: "pj-imovel",
        title: "Imóvel — dados refletidos",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: propertyEvidence,
      });
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
      await expectFieldValue(
        operationsPage,
        "PESSOA$NO_ENDERECO",
        aejsReflection.guarantor.fullAddress,
      );
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
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_UF",
        aejsReflection.guarantor.state,
      );
      await expectFieldValue(
        operationsPage,
        "PESSOA$CO_MUNICIPIO",
        aejsReflection.guarantor.city,
      );
      await expectFieldDigits(
        operationsPage,
        "PESSOA$NU_TELEFONE_COM",
        guarantor.phone,
      );

      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 10,
        slug: "pj-garantidor",
        title: "Garantidor PJ — identificação, endereço e contato",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: await Promise.all([
          aejsInputEvidence(
            operationsPage,
            "CNPJ",
            "PESSOA$NU_CPFCNPJ",
            guarantor.cnpj,
            "tax-id",
          ),
          aejsInputEvidence(
            operationsPage,
            "Empresa",
            "PESSOA$NO_PESSOA",
            guarantor.companyName,
            "name",
          ),
          aejsInputEvidence(
            operationsPage,
            "Fundação",
            "PESSOA$DT_NASCIMENTO",
            formatDate(guarantor.foundationDate),
            "date",
          ),
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
            aejsReflection.guarantor.fullAddress,
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
            "Bairro",
            "PESSOA$NO_BAIRRO",
            guarantor.address.neighborhood,
          ),
          aejsInputEvidence(
            operationsPage,
            "UF",
            "PESSOA$CO_UF",
            aejsReflection.guarantor.state,
          ),
          aejsInputEvidence(
            operationsPage,
            "Município",
            "PESSOA$CO_MUNICIPIO",
            aejsReflection.guarantor.city,
          ),
          aejsInputEvidence(
            operationsPage,
            "Telefone",
            "PESSOA$NU_TELEFONE_COM",
            guarantor.phone,
            "phone",
          ),
        ]),
      });

      await operationsPage.selectVisibleTab("Sócios/Representantes");
      const firstPartnerEvidence = await validatePartner(
        operationsPage,
        guarantor.partners[0],
      );
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 11,
        slug: "pj-primeiro-socio",
        title: "Garantidor PJ — primeiro sócio",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: firstPartnerEvidence,
      });
      await operationsPage.closeCurrentWindow();

      const secondPartnerEvidence = await validatePartner(
        operationsPage,
        guarantor.partners[1],
      );
      await attachFunctionalEvidence(aejsPage, testInfo, {
        order: 12,
        slug: "pj-segundo-socio",
        title: "Garantidor PJ — segundo sócio",
        scenario: scenarioId,
        operationNumber: scenario.operationNumber,
        fields: secondPartnerEvidence,
      });
      await operationsPage.closeCurrentWindow();
      await operationsPage.closeCurrentWindow();
    });
  },
);
