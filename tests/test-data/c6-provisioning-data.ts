import type { C6ProvisioningScenario } from "../types/c6-provisioning";

function digitsFromEnvironment(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: string,
): string {
  const value = (env[key]?.trim() || fallback).replace(/\D/g, "");
  if (!value) throw new Error(`${key} precisa conter dígitos.`);
  return value;
}

function termFromEnvironment(env: NodeJS.ProcessEnv): number {
  const value = Number(env.C6_PROVISION_TERM_MONTHS?.trim() || "72");
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("C6_PROVISION_TERM_MONTHS precisa ser um inteiro positivo.");
  }
  return value;
}

/** Contrato oficial da criação de massas funcionais no C6 HT. */
export function getC6ProvisioningScenario(
  env: NodeJS.ProcessEnv = process.env,
): C6ProvisioningScenario {
  const applicantPostalCode = digitsFromEnvironment(
    env,
    "C6_PROVISION_APPLICANT_POSTAL_CODE",
    "24120440",
  );
  if (applicantPostalCode.length !== 8) {
    throw new Error(
      "C6_PROVISION_APPLICANT_POSTAL_CODE precisa conter exatamente 8 dígitos.",
    );
  }

  return Object.freeze({
    provider: "c6-scci",
    journey: Object.freeze({
      operationGroup: "WEB",
      borrowerType: "Pessoa Física",
      propertyType: "Imóvel Residencial",
      financingType: "Empréstimo com Garantia Imobiliária",
      interestType: "Pré-fixado",
    }),
    financial: Object.freeze({
      propertyValueCents: "150000000",
      financingValueCents: "50000000",
      termMonths: termFromEnvironment(env),
      birthDateDigits: "01012001",
    }),
    insurer: "ZURICH",
    applicantPostalCode,
    applicantSeed: Object.freeze({ email: "", mobileDigits: "" }),
  });
}
