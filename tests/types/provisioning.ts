export const PROVISIONING_SLOT_IDS = [
  "CANCELED",
  "DEFAULT",
  "EXPIRED",
  "CREDIT_REJECTED",
  "CREDIT_APPROVED",
  "EXPIRED_OVER_30_DAYS",
  "TIMELINE_REGISTRATION",
  "TIMELINE_DOCUMENTS",
  "INTEGRATION_PJ",
  "INTEGRATION_PF",
  "INTEGRATION_PAID_OFF",
  "INTEGRATION_WORKFLOW",
  "DOCUMENT_PERSISTENCE",
  "DOCUMENT_SIZE",
  "RESERVE",
] as const;

export type ProvisioningSlotId = (typeof PROVISIONING_SLOT_IDS)[number];

export type ProvisioningStateOwner =
  | "provisioner"
  | "c6-phase-preparation"
  | "existing-integration-test"
  | "external-preparation";

export type ProvisioningCreationMode = "simulator" | "manual-shared";

export interface ProvisioningPhaseTarget {
  readonly code: string;
  readonly label: string;
}

export interface ProvisioningSlotDefinition {
  readonly id: ProvisioningSlotId;
  readonly sequence: number;
  readonly applicantName: string;
  readonly environmentKey: string;
  readonly purpose: string;
  readonly desiredState: string;
  readonly stateOwner: ProvisioningStateOwner;
  readonly creationMode: ProvisioningCreationMode;
  readonly sharedCpfWith?: ProvisioningSlotId;
  readonly phaseTarget?: ProvisioningPhaseTarget;
}
