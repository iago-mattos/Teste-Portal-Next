import { parseCoreCapabilities } from "./core-capabilities.mjs";
import { loadEnvironmentProfile } from "./environment-profile.mjs";

const operationPattern = /^\d{9}$/;
const profile = loadEnvironmentProfile().name;
const capabilities = parseCoreCapabilities(
  process.env.PORTAL_CORE_CAPABILITIES,
);

if (capabilities.size === 0) {
  throw new Error(
    "PORTAL_CORE_CAPABILITIES nao possui capacidades qualificadas para o perfil ativo.",
  );
}

function requireText(key) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Configuracao Portal Core ausente: ${key}.`);
  return value;
}

function requireOperation(key) {
  const value = requireText(key);
  if (!operationPattern.test(value)) {
    throw new Error(`${key} precisa conter exatamente 9 digitos.`);
  }
  return value;
}

function requireUrl(key) {
  const value = requireText(key);
  try {
    return new URL(value);
  } catch {
    throw new Error(`${key} precisa conter uma URL valida.`);
  }
}

function operationCpfs() {
  const raw = requireText("PORTAL_MASS_OPERATION_CPFS_JSON");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("PORTAL_MASS_OPERATION_CPFS_JSON possui JSON invalido.", {
      cause: error,
    });
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("PORTAL_MASS_OPERATION_CPFS_JSON precisa ser um objeto JSON.");
  }
  return Object.fromEntries(
    Object.entries(parsed).map(([operation, cpf]) => [
      operation.replace(/\D/g, "").padStart(9, "0"),
      String(cpf).replace(/\D/g, ""),
    ]),
  );
}

function requireOwnership(operation, cpfs) {
  const cpf = cpfs[operation];
  if (!cpf || cpf.length !== 11) {
    throw new Error(
      `Mapeie a operacao ${operation} em PORTAL_MASS_OPERATION_CPFS_JSON.`,
    );
  }
  return cpf;
}

const portalUrl = requireUrl("PORTAL_URL");
const adminUrl = requireUrl("PORTAL_ADMIN_URL");
if (portalUrl.origin !== adminUrl.origin) {
  throw new Error("PORTAL_URL e PORTAL_ADMIN_URL precisam pertencer ao mesmo host.");
}
requireText("PORTAL_ADMIN_USER");
requireText("PORTAL_ADMIN_PASSWORD");
if (requireText("PORTAL_TEST_CPF").replace(/\D/g, "").length !== 11) {
  throw new Error("PORTAL_TEST_CPF precisa conter 11 digitos.");
}

if (capabilities.has("restorable-draft")) {
  requireOperation("PORTAL_CORE_PERSISTENCE_OPERATION");
}

if (capabilities.has("controlled-document-slot")) {
  requireOperation("PORTAL_CORE_DOCUMENT_OPERATION");
  const maximumSize = Number(requireText("PORTAL_CORE_DOCUMENT_MAX_SIZE_BYTES"));
  if (!Number.isSafeInteger(maximumSize) || maximumSize <= 0) {
    throw new Error(
      "PORTAL_CORE_DOCUMENT_MAX_SIZE_BYTES precisa ser um inteiro positivo.",
    );
  }
}

if (capabilities.has("registration-form")) {
  requireOperation("PORTAL_CORE_REGISTRATION_OPERATION");
  requireText("PORTAL_CORE_REGISTRATION_EXPECTED_NAME");
}

if (capabilities.has("same-owner-registration-documents")) {
  const registration = requireOperation("PORTAL_CORE_REGISTRATION_OPERATION");
  const documents = requireOperation("PORTAL_CORE_DOCUMENTS_OPERATION");
  requireText("PORTAL_CORE_REGISTRATION_EXPECTED_NAME");
  requireText("PORTAL_CORE_DOCUMENTS_EXPECTED_NAME");
  if (registration === documents) {
    throw new Error(
      "same-owner-registration-documents exige duas operacoes distintas.",
    );
  }
  const cpfs = operationCpfs();
  if (
    requireOwnership(registration, cpfs) !== requireOwnership(documents, cpfs)
  ) {
    throw new Error(
      "same-owner-registration-documents exige propostas do mesmo CPF controlado.",
    );
  }
}

if (capabilities.has("foreign-owner-operation")) {
  const owned = requireOperation("PORTAL_CORE_REGISTRATION_OPERATION");
  const foreign = requireOperation("PORTAL_CORE_FOREIGN_OPERATION");
  requireText("PORTAL_CORE_REGISTRATION_EXPECTED_NAME");
  requireText("PORTAL_CORE_FOREIGN_EXPECTED_NAME");
  if (owned === foreign) {
    throw new Error("foreign-owner-operation exige duas operacoes distintas.");
  }
  const cpfs = operationCpfs();
  if (requireOwnership(owned, cpfs) === requireOwnership(foreign, cpfs)) {
    throw new Error(
      "foreign-owner-operation exige uma operacao real pertencente a outro CPF.",
    );
  }
}

if (capabilities.has("restorable-registration-pair")) {
  const a = requireOperation("PORTAL_CORE_CAD_A_OPERATION");
  const b = requireOperation("PORTAL_CORE_CAD_B_OPERATION");
  if (a === b) {
    throw new Error("restorable-registration-pair exige CAD A/B distintas.");
  }
  requireText("PORTAL_CORE_CAD_A_EXPECTED_NAME");
  requireText("PORTAL_CORE_CAD_B_EXPECTED_NAME");
  const cpfs = operationCpfs();
  if (requireOwnership(a, cpfs) !== requireOwnership(b, cpfs)) {
    throw new Error(
      "restorable-registration-pair exige CAD A/B do mesmo CPF controlado.",
    );
  }
}

if (capabilities.has("consumable-document-pair")) {
  const a = requireOperation("PORTAL_CORE_DOCUMENT_A_OPERATION");
  const b = requireOperation("PORTAL_CORE_DOCUMENT_B_OPERATION");
  if (a === b) {
    throw new Error("consumable-document-pair exige DOC A/B distintas.");
  }
  const cpfs = operationCpfs();
  if (requireOwnership(a, cpfs) !== requireOwnership(b, cpfs)) {
    throw new Error(
      "consumable-document-pair exige DOC A/B do mesmo CPF controlado.",
    );
  }
}

console.log(
  [
    "Configuracao Portal Core valida.",
    `Perfil: ${profile}`,
    `Capacidades: ${[...capabilities].join(", ")}`,
  ].join("\n"),
);
