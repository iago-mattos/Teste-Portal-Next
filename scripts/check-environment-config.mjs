import { loadEnvironmentProfile } from "./environment-profile.mjs";
import { parseCoreCapabilities } from "./core-capabilities.mjs";

const scope = process.argv[2] ?? "all";
if (!new Set(["all", "portal"]).has(scope)) {
  throw new Error("Escopo invalido. Use all ou portal.");
}

const operationPattern = /^\d{9}$/;

function required(key) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Configuracao obrigatoria ausente: ${key}.`);
  return value;
}

function assertRequired(keys) {
  const missing = keys.filter((key) => !process.env[key]?.trim());
  if (missing.length === 0) return;

  throw new Error(
    `Configuracoes obrigatorias ausentes:\n- ${missing.join("\n- ")}`,
  );
}

function validUrl(key) {
  const value = required(key);
  try {
    return new URL(value);
  } catch {
    throw new Error(`${key} precisa conter uma URL valida.`);
  }
}

function validBoolean(key) {
  const value = required(key).toLowerCase();
  if (value !== "true" && value !== "false") {
    throw new Error(`${key} precisa ser true ou false.`);
  }
  return value === "true";
}

function validateOperations(keys) {
  for (const key of keys) {
    if (!operationPattern.test(required(key))) {
      throw new Error(`${key} precisa conter exatamente 9 digitos.`);
    }
  }
}

function validateUniqueOperations(keys, groupName) {
  const operations = new Map();
  for (const key of keys) {
    const operation = required(key);
    const previousKey = operations.get(operation);
    if (previousKey) {
      throw new Error(
        `${groupName}: ${previousKey} e ${key} nao podem usar a mesma operacao ${operation}.`,
      );
    }
    operations.set(operation, key);
  }
}

const profile = loadEnvironmentProfile().name;
const coreCapabilities = parseCoreCapabilities(
  process.env.PORTAL_CORE_CAPABILITIES,
);
if (profile === "esteira-ht") {
  const targetCount = Number(process.env.PORTAL_MASS_TARGET_COUNT?.trim());
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 15) {
    throw new Error(
      "PORTAL_MASS_TARGET_COUNT precisa ser um inteiro entre 1 e 15.",
    );
  }
  if (process.env.PORTAL_MASS_BATCH_STATUS?.trim().toLowerCase() !== "ready") {
    throw new Error(
      "Perfil esteira-ht ainda nao possui um lote de massas pronto. Execute o provisionamento e a preparacao dos estados antes da suite completa.",
    );
  }
}
const functionalOperations = [
  "PORTAL_PROPOSAL_DEFAULT",
  "PORTAL_PROPOSAL_CANCELED",
  "PORTAL_PROPOSAL_EXPIRED",
  "PORTAL_PROPOSAL_CREDIT_REJECTED",
  "PORTAL_PROPOSAL_CREDIT_APPROVED",
  "PORTAL_PROPOSAL_EXPIRED_OVER_30_DAYS",
  "PORTAL_PROPOSAL_TIMELINE_CADASTRO",
  "PORTAL_PROPOSAL_TIMELINE_DOCUMENTS",
];
const portalRequiredKeys = [
  "PORTAL_URL",
  "PORTAL_ADMIN_URL",
  "PORTAL_ADMIN_USER",
  "PORTAL_ADMIN_PASSWORD",
  "PORTAL_TEST_CPF",
  "PORTAL_EXPECTED_PROPONENT_NAME",
  "PORTAL_EXPECTED_CPF_ENDING",
  "PORTAL_EXPECTED_REGISTRATION_DATE",
  "PORTAL_EXPECTED_PROPERTY_VALUE",
  "PORTAL_EXPECTED_FINANCED_VALUE",
  "PORTAL_EXPECTED_TERM",
  "PORTAL_EXPECTED_CURRENT_PHASE",
  "PORTAL_EXPECTED_INTEREST_TYPE",
  "ALLOW_TEST_MUTATION",
  "ALLOW_REACT_418_QUARANTINE",
  ...functionalOperations,
];
const integrationOperations = [
  "PORTAL_INTEGRATION_PJ_OPERATION",
  "PORTAL_INTEGRATION_PF_OPERATION",
  "PORTAL_INTEGRATION_PAID_OFF_OPERATION",
  "PORTAL_INTEGRATION_WORKFLOW_OPERATION",
  "PORTAL_INTEGRATION_DOCUMENT_PERSISTENCE_OPERATION",
  "PORTAL_INTEGRATION_DOCUMENT_SIZE_OPERATION",
];
const workflowTaskKeys = [
  "AEJS_WORKFLOW_REGISTRATION_TASK_CODE",
  "AEJS_WORKFLOW_REGISTRATION_TASK_TITLE",
  "AEJS_WORKFLOW_REGISTRATION_TASK_STATUS",
  "AEJS_WORKFLOW_DOCUMENTS_TASK_CODE",
  "AEJS_WORKFLOW_DOCUMENTS_TASK_TITLE",
  "AEJS_WORKFLOW_DOCUMENTS_TASK_STATUS",
  "AEJS_WORKFLOW_VALIDATION_TASK_CODE",
  "AEJS_WORKFLOW_VALIDATION_TASK_TITLE",
  "AEJS_WORKFLOW_VALIDATION_TASK_STATUS",
];

assertRequired(portalRequiredKeys);
if (scope === "all") {
  assertRequired([
    "AEJS_URL",
    "AEJS_USERNAME",
    "AEJS_PASSWORD",
    "AEJS_USE_PLATFORM_ACCESS",
    ...integrationOperations,
    ...workflowTaskKeys,
  ]);
}

const portalUrl = validUrl("PORTAL_URL");
const adminUrl = validUrl("PORTAL_ADMIN_URL");
if (portalUrl.origin !== adminUrl.origin) {
  throw new Error("PORTAL_URL e PORTAL_ADMIN_URL precisam pertencer ao mesmo host.");
}

if (required("PORTAL_TEST_CPF").replace(/\D/g, "").length !== 11) {
  throw new Error("PORTAL_TEST_CPF precisa conter 11 digitos.");
}
if (!/^\d{2}\/\d{2}\/\d{4}$/.test(required("PORTAL_EXPECTED_REGISTRATION_DATE"))) {
  throw new Error("PORTAL_EXPECTED_REGISTRATION_DATE precisa usar DD/MM/AAAA.");
}

validateOperations(functionalOperations);
validateUniqueOperations(
  [
    "PORTAL_PROPOSAL_CANCELED",
    "PORTAL_PROPOSAL_EXPIRED",
    "PORTAL_PROPOSAL_CREDIT_REJECTED",
    "PORTAL_PROPOSAL_CREDIT_APPROVED",
    "PORTAL_PROPOSAL_EXPIRED_OVER_30_DAYS",
  ],
  "Massas funcionais com estados exclusivos",
);

validBoolean("ALLOW_TEST_MUTATION");
validBoolean("ALLOW_REACT_418_QUARANTINE");

let aejsSummary = "nao validado neste escopo";
let integrationCount = 0;
if (scope === "all") {
  const aejsUrl = validUrl("AEJS_URL");
  required("AEJS_USERNAME");
  required("AEJS_PASSWORD");
  const usePlatformAccess = validBoolean("AEJS_USE_PLATFORM_ACCESS");
  const path = process.env.AEJS_PATH?.trim() ?? "";
  const effectiveLogin = path || !usePlatformAccess ? "direto" : "plataforma C6";
  aejsSummary = `${aejsUrl.host} (${effectiveLogin})`;

  validateOperations(integrationOperations);
  validateUniqueOperations(integrationOperations, "Massas de integracao");
  const workflowTaskCodeKeys = workflowTaskKeys.filter((key) =>
    key.endsWith("_CODE"),
  );
  for (const key of workflowTaskCodeKeys) {
    if (!/^\d+$/.test(required(key))) {
      throw new Error(`${key} precisa conter somente digitos.`);
    }
  }
  validateUniqueOperations(
    workflowTaskCodeKeys,
    "Tarefas do workflow",
  );
  integrationCount = integrationOperations.length;
}

console.log([
  "Configuracao de ambiente valida.",
  `Perfil: ${profile}`,
  `Portal: ${portalUrl.host}`,
  `SCCI/AEJS: ${aejsSummary}`,
  `Massas funcionais: ${functionalOperations.length}`,
  `Massas de integracao: ${integrationCount}`,
  `Capacidades Portal Core: ${coreCapabilities.size}`,
].join("\n"));
