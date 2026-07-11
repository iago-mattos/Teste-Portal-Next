/**
 * Massa descartável oficial para os cenários Portal → AEJS da Fase 7.
 *
 * As operações são exclusivas para desenvolvimento e validação de integração.
 * Specs não devem declarar números de proposta; qualquer substituição de massa
 * deve ocorrer exclusivamente neste catálogo.
 */
export type IntegrationScenarioProfile =
  | "spouse-pj"
  | "third-party-pf"
  | "single-quitado"
  | "workflow";

export interface ApplicantInput {
  readonly grossIncome: string;
  readonly maritalStatus: string;
  readonly nationality: string;
  readonly birthState: string;
  readonly identityState: string;
  readonly profession: string;
  readonly professionalActivity: string;
  readonly livesInProperty: string;
}

export interface SpouseInput {
  readonly name: string;
  readonly cpf: string;
  readonly dateOfBirth: string;
  readonly nationality: string;
  readonly birthState: string;
  readonly identityState: string;
  readonly marriageDate: string;
  readonly marriageRegime: string;
  readonly mobileAreaCode: string;
  readonly mobileNumber: string;
  readonly email: string;
  readonly grossIncome: string;
  readonly profession: string;
  readonly professionalActivity: string;
}

export interface CreditPurposeInput {
  readonly purpose: string;
  readonly description: string;
}

export interface PropertyInput {
  readonly use: string;
  readonly type: string;
  readonly condition: string;
  readonly outstandingBalance: string;
  readonly settlementIntervenor: string;
}

export interface AddressInput {
  readonly postalCode: string;
  readonly streetNumber: string;
  readonly complement: string;
  readonly neighborhood: string;
}

export interface GuarantorPartnerInput {
  readonly name: string;
  readonly cpf: string;
  readonly dateOfBirth: string;
  readonly mobileAreaCode: string;
  readonly mobileNumber: string;
  readonly email: string;
}

export interface PjGuarantorInput {
  readonly companyName: string;
  readonly cnpj: string;
  readonly foundationDate: string;
  readonly phoneAreaCode: string;
  readonly phone: string;
  readonly email: string;
  readonly address: AddressInput;
  readonly partners: readonly [GuarantorPartnerInput, GuarantorPartnerInput];
}

/**
 * Dados que a Subfase A grava no Portal para um caso de integração.
 *
 * Estes valores são deliberadamente independentes das evidências históricas
 * do Cypress. As etapas B e C devem consumir esta mesma definição, em vez de
 * declarar expectativas próprias ou reutilizar valores de massas antigas.
 */
export interface IntegrationPreparationScenario {
  readonly profile: "PJ";
  readonly applicant: ApplicantInput;
  readonly spouse: SpouseInput;
  readonly creditPurpose: CreditPurposeInput;
  readonly property: PropertyInput;
  readonly guarantor: PjGuarantorInput;
}

export interface IntegrationScenarioData {
  readonly operationNumber: string;
  readonly profile: IntegrationScenarioProfile;
  readonly purpose: string;
  readonly preparation?: IntegrationPreparationScenario;
}

export const integrationData = {
  "INT-CONFIRM-PJ": {
    operationNumber: "000436033",
    profile: "spouse-pj",
    purpose: "Validar cônjuge, imóvel, garantidor PJ, sócios e interveniente no AEJS.",
    preparation: {
      profile: "PJ",
      applicant: {
        grossIncome: "835000",
        maritalStatus: "2",
        nationality: "Brasileira",
        birthState: "SP",
        identityState: "SP",
        profession: "ADMINISTRADOR",
        professionalActivity: "ASSALARIADO",
        livesInProperty: "T",
      },
      spouse: {
        name: "CONJUGE PLAYWRIGHT INT PJ 033",
        cpf: "49382716564",
        dateOfBirth: "15021991",
        nationality: "Brasileira",
        birthState: "SP",
        identityState: "SP",
        marriageDate: "12062015",
        marriageRegime: "Comunhão Parcial de Bens",
        mobileAreaCode: "11",
        mobileNumber: "998765432",
        email: "conjuge.pw.int033@example.test",
        grossIncome: "420000",
        profession: "ADMINISTRADOR",
        professionalActivity: "ASSALARIADO",
      },
      creditPurpose: {
        purpose: "Investir",
        description:
          "Preparação controlada Playwright para refletir dados do cenário PJ na integração AEJS.",
      },
      property: {
        use: "Casa",
        type: "Residencial",
        condition: "6",
        outstandingBalance: "27500000",
        settlementIntervenor: "Banco C6 S.A.",
      },
      guarantor: {
        companyName: "GARANTIDORA PLAYWRIGHT INT PJ 033 LTDA",
        cnpj: "48273619000104",
        foundationDate: "23052012",
        phoneAreaCode: "11",
        phone: "998765432",
        email: "garantidora.pw.int033@example.test",
        address: {
          postalCode: "01310930",
          streetNumber: "330",
          complement: "CONJUNTO 33",
          neighborhood: "Bela Vista",
        },
        partners: [
          {
            name: "SOCIO PLAYWRIGHT PJ 033 UM",
            cpf: "74839261555",
            dateOfBirth: "11041988",
            mobileAreaCode: "11",
            mobileNumber: "997654321",
            email: "socio.um.pw.int033@example.test",
          },
          {
            name: "SOCIO PLAYWRIGHT PJ 033 DOIS",
            cpf: "83627194519",
            dateOfBirth: "29091993",
            mobileAreaCode: "11",
            mobileNumber: "996543210",
            email: "socio.dois.pw.int033@example.test",
          },
        ],
      },
    },
  },
  "INT-CONFIRM-PF": {
    operationNumber: "000436034",
    profile: "third-party-pf",
    purpose: "Validar terceiro na composição de renda e garantidor PF no AEJS.",
  },
  "INT-CONFIRM-QUITADO": {
    operationNumber: "000436035",
    profile: "single-quitado",
    purpose: "Validar titular sem composição de renda e imóvel quitado no AEJS.",
  },
  "INT-CONFIRM-WORKFLOW": {
    operationNumber: "000436036",
    profile: "workflow",
    purpose: "Validar tarefas, documentos e o fluxo controlado de cancelamento no AEJS.",
  },
} as const satisfies Record<string, IntegrationScenarioData>;

export type IntegrationCaseId = keyof typeof integrationData;

export interface ResolvedIntegrationScenario {
  readonly caseId: IntegrationCaseId;
  readonly operationNumber: string;
  readonly profile: IntegrationScenarioProfile;
  readonly purpose: string;
}

export interface ResolvedIntegrationPreparationScenario
  extends ResolvedIntegrationScenario {
  readonly preparation: IntegrationPreparationScenario;
}

export function getIntegrationScenario(
  caseIdInput: IntegrationCaseId,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedIntegrationScenario {
  const caseIdEnv = env.PORTAL_INTEGRATION_CASE_ID?.trim();
  const caseId = (caseIdEnv && caseIdEnv in integrationData)
    ? (caseIdEnv as IntegrationCaseId)
    : caseIdInput;

  const scenario = integrationData[caseId];
  const operationOverride = env.PORTAL_INTEGRATION_OPERATION?.trim().replace(/\D/g, "");

  if (operationOverride) {
    const officialOperations = Object.values(integrationData).map((d) => d.operationNumber.replace(/\D/g, ""));
    if (!officialOperations.includes(operationOverride)) {
      throw new Error(
        `Erro de Governanca: A proposta de override '${operationOverride}' nao esta cadastrada no catalogo oficial de massas de integracao.`,
      );
    }
  }

  const operationNumber = operationOverride || scenario.operationNumber;

  if (!operationNumber) {
    throw new Error(`Numero de operacao nao configurado para o cenario: ${caseId}`);
  }

  return {
    caseId,
    operationNumber: operationNumber.padStart(9, "0"),
    profile: scenario.profile,
    purpose: scenario.purpose,
  };
}

export function getIntegrationPreparationScenario(
  caseId: IntegrationCaseId,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedIntegrationPreparationScenario {
  const scenario = getIntegrationScenario(caseId, env);
  const requestedScenario = integrationData[caseId];

  if (
    scenario.caseId !== caseId
    || scenario.operationNumber !== requestedScenario.operationNumber
  ) {
    throw new Error(
      `Erro de Governanca: a preparacao ${caseId} deve usar exclusivamente a operacao ${requestedScenario.operationNumber}.`,
    );
  }

  const configuredScenario = integrationData[scenario.caseId];
  const preparation = "preparation" in configuredScenario
    ? configuredScenario.preparation
    : undefined;

  if (!preparation) {
    throw new Error(
      `O cenário ${scenario.caseId} não possui dados de preparação cadastrados.`,
    );
  }

  return { ...scenario, preparation };
}
