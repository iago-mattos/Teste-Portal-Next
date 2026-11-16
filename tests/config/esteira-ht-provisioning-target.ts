const PORTAL_HOST = "portal-desenv.prognum.com.br";
const AEJS_HOST = "esteiradigital-ht.prognum.com.br";

/**
 * Contrato de host exigido para provisionar massas pelo simulador público do
 * Portal. Bloqueia a criação antes de tocar em qualquer proposta caso o
 * ambiente aponte para outro perfil (por exemplo o SCCI interno do C6).
 */
export function assertEsteiraHtProvisioningTarget(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const profile = env.PW_PROFILE?.trim().toLowerCase();
  const portalHost = new URL(env.PORTAL_URL ?? "").host;
  const aejsHost = new URL(env.AEJS_URL ?? "").host;
  const usePlatformAccess = env.AEJS_USE_PLATFORM_ACCESS;
  const path = env.AEJS_PATH?.trim() ?? "";

  if (profile !== "esteira-ht") {
    throw new Error(
      `Provisionamento bloqueado: perfil ${profile || "vazio"} não é esteira-ht.`,
    );
  }
  const provisioningProvider = env.PORTAL_PROVISION_PROVIDER?.trim().toLowerCase();
  if (provisioningProvider && provisioningProvider !== "portal") {
    throw new Error(
      `Provisionamento bloqueado: PORTAL_PROVISION_PROVIDER="${provisioningProvider}" ` +
        'herdado do shell não é "portal". O lote da EsteiraHT não usa o registry do C6.',
    );
  }
  if (portalHost !== PORTAL_HOST) {
    throw new Error(
      `Provisionamento bloqueado: PORTAL_URL aponta para ${portalHost || "host vazio"}.`,
    );
  }
  if (aejsHost !== AEJS_HOST) {
    throw new Error(
      `Provisionamento bloqueado: AEJS_URL aponta para ${aejsHost || "host vazio"}.`,
    );
  }
  if (usePlatformAccess !== "false" || path) {
    throw new Error(
      "Provisionamento bloqueado: a EsteiraHT exige login direto, AEJS_USE_PLATFORM_ACCESS=false e AEJS_PATH vazio.",
    );
  }
}
