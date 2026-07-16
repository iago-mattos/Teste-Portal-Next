export const coreCapabilityNames = Object.freeze([
  "restorable-draft",
  "controlled-document-slot",
  "registration-form",
  "same-owner-registration-documents",
  "foreign-owner-operation",
  "restorable-registration-pair",
  "consumable-document-pair",
]);

const knownCapabilities = new Set(coreCapabilityNames);

export function parseCoreCapabilities(rawValue = "") {
  const configured = rawValue
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const unknown = configured.filter((value) => !knownCapabilities.has(value));

  if (unknown.length > 0) {
    throw new Error(
      `PORTAL_CORE_CAPABILITIES contem capacidades desconhecidas: ${unknown.join(", ")}. Valores aceitos: ${coreCapabilityNames.join(", ")}.`,
    );
  }

  return new Set(configured);
}
