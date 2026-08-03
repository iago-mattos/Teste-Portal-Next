export const PROVISIONING_SLOT_IDS = [
  "DEFAULT",
  "EXPIRED",
  "CREDIT_REJECTED",
  "CREDIT_APPROVED",
  "CANCELED_WITHIN_30_DAYS",
  "CANCELED_OVER_30_DAYS",
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
  | "c6-document-preparation"
  | "existing-integration-test"
  | "external-preparation";

export type ProvisioningCreationMode =
  | "simulator"
  | "simulator-shared"
  | "manual-shared";

export type ProvisioningLifecycle =
  | "fresh-per-run"
  | "external-static"
  | "on-demand";

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
  readonly lifecycle: ProvisioningLifecycle;
  readonly sharedCpfWith?: ProvisioningSlotId;
  readonly phaseTarget?: ProvisioningPhaseTarget;
}
