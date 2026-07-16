import type { PortalRuntimeConfig } from "./runtime-config";

export type CoreMassLifecycle =
  | "RESTORABLE"
  | "SEEDABLE_CONSUMABLE";

export interface CoreMassDefinition {
  readonly operationNumber: string;
  readonly expectedApplicantName?: string;
  readonly purpose: string;
  readonly lifecycle: CoreMassLifecycle;
}

export interface CoreMassProvisioningConfig {
  readonly documentA: CoreMassDefinition;
  readonly documentB: CoreMassDefinition;
  readonly cadastroA: CoreMassDefinition;
  readonly cadastroB: CoreMassDefinition;
  readonly finalization: CoreMassDefinition;
}

const operationKeys = {
  documentA: "PORTAL_CORE_DOCUMENT_A_OPERATION",
  documentB: "PORTAL_CORE_DOCUMENT_B_OPERATION",
  cadastroA: "PORTAL_CORE_CAD_A_OPERATION",
  cadastroB: "PORTAL_CORE_CAD_B_OPERATION",
  finalization: "PORTAL_CORE_FINALIZATION_OPERATION",
} as const;

function requireText(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Configure ${key} para qualificar a massa CORE.`);
  return value;
}

function requireOperation(
  env: NodeJS.ProcessEnv,
  key: (typeof operationKeys)[keyof typeof operationKeys],
): string {
  const operation = env[key]?.replace(/\D/g, "");
  if (!operation || /^0+$/.test(operation)) {
    throw new Error(`Configure ${key} com uma operacao real do ambiente.`);
  }

  return operation.padStart(9, "0");
}

export function loadCoreMassProvisioningConfig(
  portalConfig: PortalRuntimeConfig,
  env: NodeJS.ProcessEnv = process.env,
): CoreMassProvisioningConfig {
  const documentA = requireOperation(env, operationKeys.documentA);
  const documentB = requireOperation(env, operationKeys.documentB);
  const cadastroA = requireOperation(env, operationKeys.cadastroA);
  const cadastroB = requireOperation(env, operationKeys.cadastroB);
  const finalization = requireOperation(env, operationKeys.finalization);
  const cadastroAApplicantName = requireText(
    env,
    "PORTAL_CORE_CAD_A_EXPECTED_NAME",
  );
  const cadastroBApplicantName = requireText(
    env,
    "PORTAL_CORE_CAD_B_EXPECTED_NAME",
  );
  const operations = [documentA, documentB, cadastroA, cadastroB, finalization];

  if (new Set(operations).size !== operations.length) {
    throw new Error("As cinco massas CORE de provisionamento devem ser distintas.");
  }

  const cpfFor = (operation: string): string | undefined =>
    portalConfig.testData.operationCpfs[operation.replace(/\D/g, "")];
  const documentCpfA = cpfFor(documentA);
  const documentCpfB = cpfFor(documentB);
  const cadastroCpfA = cpfFor(cadastroA);
  const cadastroCpfB = cpfFor(cadastroB);
  const finalizationCpf = cpfFor(finalization);

  if (operations.some((operation) => !cpfFor(operation))) {
    throw new Error(
      "Mapeie as cinco massas CORE em PORTAL_MASS_OPERATION_CPFS_JSON antes do provisionamento.",
    );
  }
  if (documentCpfA !== documentCpfB) {
    throw new Error("DOC A e DOC B devem pertencer a mesma identidade controlada.");
  }
  if (cadastroCpfA !== cadastroCpfB) {
    throw new Error("CAD A e CAD B devem pertencer a mesma identidade controlada.");
  }
  if (
    new Set([documentCpfA, cadastroCpfA, finalizationCpf]).size !== 3
  ) {
    throw new Error(
      "Os grupos documental, Cadastro e finalizacao devem usar identidades distintas.",
    );
  }

  return Object.freeze({
    documentA: Object.freeze({
      operationNumber: documentA,
      purpose: "Massa documental A com pelo menos dois slots vazios.",
      lifecycle: "SEEDABLE_CONSUMABLE" as const,
    }),
    documentB: Object.freeze({
      operationNumber: documentB,
      purpose: "Massa documental B com pelo menos dois slots vazios.",
      lifecycle: "SEEDABLE_CONSUMABLE" as const,
    }),
    cadastroA: Object.freeze({
      operationNumber: cadastroA,
      expectedApplicantName: cadastroAApplicantName,
      purpose: "Massa de Cadastro A qualificada para mutacao e restauracao.",
      lifecycle: "RESTORABLE" as const,
    }),
    cadastroB: Object.freeze({
      operationNumber: cadastroB,
      expectedApplicantName: cadastroBApplicantName,
      purpose: "Massa de Cadastro B qualificada para isolamento A/B.",
      lifecycle: "RESTORABLE" as const,
    }),
    finalization: Object.freeze({
      operationNumber: finalization,
      purpose: "Massa parada imediatamente antes da confirmacao final.",
      lifecycle: "SEEDABLE_CONSUMABLE" as const,
    }),
  });
}
