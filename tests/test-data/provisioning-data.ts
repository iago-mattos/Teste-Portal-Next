import rawSlots from "./provisioning-slots.json";
import {
  PROVISIONING_SLOT_IDS,
  type ProvisioningCreationMode,
  type ProvisioningSlotDefinition,
  type ProvisioningSlotId,
  type ProvisioningStateOwner,
} from "../types/provisioning";

const validSlotIds = new Set<string>(PROVISIONING_SLOT_IDS);
const validStateOwners = new Set<ProvisioningStateOwner>([
  "provisioner",
  "existing-integration-test",
  "external-preparation",
]);
const validCreationModes = new Set<ProvisioningCreationMode>([
  "simulator",
  "manual-shared",
]);

function parseSlot(entry: (typeof rawSlots)[number]): ProvisioningSlotDefinition {
  const creationMode = entry.creationMode as ProvisioningCreationMode;
  const sharedCpfWith = (entry as { sharedCpfWith?: string }).sharedCpfWith;
  if (
    !validSlotIds.has(entry.id) ||
    !Number.isInteger(entry.sequence) ||
    entry.sequence < 1 ||
    !entry.applicantName.startsWith("Playwright ") ||
    !entry.environmentKey.startsWith("PORTAL_") ||
    !entry.purpose.trim() ||
    !entry.desiredState.trim() ||
    !validStateOwners.has(entry.stateOwner as ProvisioningStateOwner) ||
    !validCreationModes.has(creationMode) ||
    (creationMode === "manual-shared" &&
      (!sharedCpfWith ||
        !validSlotIds.has(sharedCpfWith) ||
        sharedCpfWith === entry.id))
  ) {
    throw new Error(`Slot de provisionamento inválido: ${entry.id}`);
  }

  return Object.freeze({
    ...entry,
    id: entry.id as ProvisioningSlotId,
    stateOwner: entry.stateOwner as ProvisioningStateOwner,
    creationMode,
    sharedCpfWith: sharedCpfWith as ProvisioningSlotId | undefined,
  });
}

export const ESTEIRA_HT_PROVISIONING_SLOTS = Object.freeze(
  rawSlots.map(parseSlot),
);

export function getProvisioningSlot(
  id: ProvisioningSlotId,
): ProvisioningSlotDefinition {
  const slot = ESTEIRA_HT_PROVISIONING_SLOTS.find((entry) => entry.id === id);
  if (!slot) throw new Error(`Slot de provisionamento desconhecido: ${id}`);
  return slot;
}
