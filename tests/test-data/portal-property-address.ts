import type { PropertyPostalCodeContract } from "../pages/portal/proposal-registration.page";

function digitsFromEnvironment(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: string,
): string {
  const value = (env[key]?.trim() || fallback).replace(/\D/g, "");
  if (!value) throw new Error(`${key} precisa conter dígitos.`);
  return value;
}

function textFromEnvironment(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: string,
): string {
  const value = env[key]?.trim() || fallback;
  if (!value) throw new Error(`${key} precisa conter um valor.`);
  return value;
}

/**
 * Contrato do CEP que o provisionamento EsteiraHT preenche no cadastro da
 * proposta pelo Portal React (o simulador público não coleta CEP).
 */
export function getPortalPropertyPostalCodeContract(
  env: NodeJS.ProcessEnv = process.env,
): PropertyPostalCodeContract {
  const postalCode = digitsFromEnvironment(
    env,
    "PORTAL_PROVISION_PROPERTY_POSTAL_CODE",
    "24120440",
  );
  if (postalCode.length !== 8) {
    throw new Error(
      "PORTAL_PROVISION_PROPERTY_POSTAL_CODE precisa conter exatamente 8 dígitos.",
    );
  }

  return {
    postalCode,
    streetNumber: textFromEnvironment(
      env,
      "PORTAL_PROVISION_PROPERTY_NUMBER",
      "70",
    ),
    complement: textFromEnvironment(
      env,
      "PORTAL_PROVISION_PROPERTY_COMPLEMENT",
      "casa 3",
    ),
  };
}
