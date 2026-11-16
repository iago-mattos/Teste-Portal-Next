interface C6ProvisioningTarget {
  readonly profile: "ht";
  readonly portalHost: string;
  readonly aejsHost: string;
  readonly requiresPath: boolean;
}

const C6_PROVISIONING_TARGETS: Readonly<Record<string, C6ProvisioningTarget>> =
  Object.freeze({
    ht: Object.freeze({
      profile: "ht",
      portalHost: "minhaproposta-dev.prognum.com.br",
      aejsHost: "c6ht.prognum.com.br",
      requiresPath: false,
    }),
  });

export function assertC6ProvisioningTarget(
  env: NodeJS.ProcessEnv = process.env,
): C6ProvisioningTarget {
  const profile = env.PW_PROFILE?.trim().toLowerCase() ?? "";
  const target = C6_PROVISIONING_TARGETS[profile];
  const portalHost = new URL(env.PORTAL_URL ?? "").host;
  const aejsHost = new URL(env.AEJS_URL ?? "").host;
  const path = env.AEJS_PATH?.trim() ?? "";

  if (!target) {
    throw new Error(
      `Provisionamento C6 bloqueado no perfil ${profile || "vazio"}. Use ht.`,
    );
  }
  if (
    portalHost !== target.portalHost ||
    aejsHost !== target.aejsHost ||
    env.AEJS_USE_PLATFORM_ACCESS !== "true" ||
    env.PORTAL_PROVISION_PROVIDER !== "c6" ||
    (target.requiresPath ? !path : Boolean(path))
  ) {
    throw new Error(
      `Provisionamento C6 bloqueado: o perfil ${profile} não corresponde aos hosts e ao modo de acesso autorizados.`,
    );
  }

  return target;
}
