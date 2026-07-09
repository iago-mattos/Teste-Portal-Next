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

export interface IntegrationScenarioData {
  readonly operationNumber: string;
  readonly profile: IntegrationScenarioProfile;
  readonly purpose: string;
}

export const integrationData = {
  "INT-CONFIRM-PJ": {
    operationNumber: "000436033",
    profile: "spouse-pj",
    purpose: "Validar cônjuge, imóvel, garantidor PJ, sócios e interveniente no AEJS.",
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

