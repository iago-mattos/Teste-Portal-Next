import { resolve } from "node:path";
import { loadEnvironmentProfile } from "./environment-profile.mjs";

const targets = Object.freeze({
  ht: Object.freeze({
    portalHost: "minhaproposta-dev.prognum.com.br",
    aejsHost: "c6ht.prognum.com.br",
    requiresPath: false,
  }),
});

export function loadC6ProvisioningTarget() {
  const profile = loadEnvironmentProfile().name;
  const target = targets[profile];
  const portalHost = new URL(process.env.PORTAL_URL ?? "").host;
  const aejsHost = new URL(process.env.AEJS_URL ?? "").host;
  const path = process.env.AEJS_PATH?.trim() ?? "";

  if (!target) {
    throw new Error(`Provisionamento C6 bloqueado no perfil ${profile}. Use ht.`);
  }
  if (
    portalHost !== target.portalHost ||
    aejsHost !== target.aejsHost ||
    process.env.AEJS_USE_PLATFORM_ACCESS !== "true" ||
    (target.requiresPath ? !path : Boolean(path))
  ) {
    throw new Error(
      `Provisionamento C6 bloqueado: o perfil ${profile} não corresponde aos hosts e ao modo de acesso autorizados.`,
    );
  }

  return Object.freeze({
    ...target,
    profile,
    registryPath: resolve(
      `.playwright/generated-c6-simulations/${profile}.json`,
    ),
    historyDirectory: resolve(
      `.playwright/generated-c6-simulations/history/${profile}`,
    ),
    currentRunPath: resolve(`.playwright/c6-runs/${profile}/current.json`),
  });
}
