export const coreCapabilityNames = [
  "restorable-draft",
  "controlled-document-slot",
  "registration-form",
  "same-owner-registration-documents",
  "foreign-owner-operation",
  "restorable-registration-pair",
  "consumable-document-pair",
] as const;

export type CoreCapability = (typeof coreCapabilityNames)[number];

export interface CoreCapabilityEligibility {
  readonly enabled: boolean;
  readonly missing: readonly CoreCapability[];
  readonly reason: string;
}

const knownCapabilities = new Set<string>(coreCapabilityNames);

export function loadCoreCapabilities(
  env: NodeJS.ProcessEnv = process.env,
): ReadonlySet<CoreCapability> {
  const configured = (env.PORTAL_CORE_CAPABILITIES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const unknown = configured.filter((value) => !knownCapabilities.has(value));

  if (unknown.length > 0) {
    throw new Error(
      `PORTAL_CORE_CAPABILITIES contem capacidades desconhecidas: ${unknown.join(", ")}. Valores aceitos: ${coreCapabilityNames.join(", ")}.`,
    );
  }

  return new Set(configured as CoreCapability[]);
}

export function evaluateCoreCapabilities(
  required: readonly CoreCapability[],
  env: NodeJS.ProcessEnv = process.env,
): CoreCapabilityEligibility {
  const configured = loadCoreCapabilities(env);
  const missing = required.filter((capability) => !configured.has(capability));

  return Object.freeze({
    enabled: missing.length === 0,
    missing: Object.freeze(missing),
    reason:
      missing.length === 0
        ? "Capacidades Portal Core configuradas."
        : `Perfil sem as capacidades Portal Core necessárias: ${missing.join(", ")}. Configure PORTAL_CORE_CAPABILITIES somente após qualificar as massas exigidas.`,
  });
}
