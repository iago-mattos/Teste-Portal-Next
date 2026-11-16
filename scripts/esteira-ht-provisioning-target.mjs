import { resolve } from "node:path";
import { loadEnvironmentProfile } from "./environment-profile.mjs";

const PORTAL_HOST = "portal-desenv.prognum.com.br";
const AEJS_HOST = "esteiradigital-ht.prognum.com.br";

export function loadEsteiraHtProvisioningTarget() {
  const profile = loadEnvironmentProfile().name;
  const portalHost = new URL(process.env.PORTAL_URL ?? "").host;
  const aejsHost = new URL(process.env.AEJS_URL ?? "").host;
  const usePlatformAccess = process.env.AEJS_USE_PLATFORM_ACCESS;
  const path = process.env.AEJS_PATH?.trim() ?? "";

  if (profile !== "esteira-ht") {
    throw new Error(
      `Provisionamento EsteiraHT bloqueado no perfil ${profile}. Use esteira-ht.`,
    );
  }
  const provisioningProvider = process.env.PORTAL_PROVISION_PROVIDER?.trim().toLowerCase();
  if (provisioningProvider && provisioningProvider !== "portal") {
    throw new Error(
      `Provisionamento EsteiraHT bloqueado: PORTAL_PROVISION_PROVIDER="${provisioningProvider}" ` +
        'herdado do shell não é "portal". O lote da EsteiraHT não usa o registry do C6.',
    );
  }
  if (
    portalHost !== PORTAL_HOST ||
    aejsHost !== AEJS_HOST ||
    usePlatformAccess !== "false" ||
    path
  ) {
    throw new Error(
      "Provisionamento EsteiraHT bloqueado: exige PORTAL_URL=portal-desenv, " +
        "AEJS_URL=esteiradigital-ht, AEJS_USE_PLATFORM_ACCESS=false e AEJS_PATH vazio.",
    );
  }

  return Object.freeze({
    profile,
    portalHost,
    aejsHost,
    registryPath: resolve(`.playwright/generated-simulations/${profile}.json`),
    historyDirectory: resolve(
      `.playwright/generated-simulations/history/${profile}`,
    ),
    currentRunPath: resolve(`.playwright/esteira-ht-runs/${profile}/current.json`),
  });
}
