import { randomInt, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getProvisioningSlot } from "../test-data/provisioning-data";
import { generateValidCpfDigits } from "../helpers/cpf";
import type {
  SimulationApplicantInput,
} from "../types/simulator";
import type { ProvisioningSimulationScenario } from "../types/provisioning-simulation";
import type { ProvisioningSlotId } from "../types/provisioning";
import type { ProvisioningStateOwner } from "../types/provisioning";

export type GeneratedSimulationStatus =
  | "reserved"
  | "submitted"
  | "scci-validated"
  | "state-prepared"
  | "ready"
  | "rejected";

export interface GeneratedSimulationEntry {
  readonly id: string;
  readonly runId?: string;
  readonly profile: string;
  readonly slotId?: ProvisioningSlotId;
  readonly environmentKey?: string;
  readonly purpose?: string;
  readonly desiredState?: string;
  readonly stateOwner?: ProvisioningStateOwner;
  readonly sequence: number;
  readonly applicant: SimulationApplicantInput;
  readonly scenario: ProvisioningSimulationScenario;
  readonly createdAt: string;
  readonly protocol?: string;
  readonly submittedAt?: string;
  readonly scciValidatedAt?: string;
  readonly statePreparedAt?: string;
  readonly propertyPreparedAt?: string;
  readonly documentNames?: readonly string[];
  readonly documentNamesCapturedAt?: string;
  readonly validatedAt?: string;
  readonly rejectedAt?: string;
  readonly failure?: string;
  readonly status: GeneratedSimulationStatus;
}

export interface C6FreshRunMetadata {
  readonly id: string;
  readonly profile: "ht";
  readonly provider: "c6";
  readonly createdAt: string;
  readonly status: "initialized" | "ready";
  readonly publishedAt?: string;
  readonly freshSlotIds: readonly ProvisioningSlotId[];
  readonly externalSlotIds: readonly ProvisioningSlotId[];
  readonly onDemandSlotIds: readonly ProvisioningSlotId[];
}

interface GeneratedSimulationRegistry {
  run?: C6FreshRunMetadata;
  nextSequence: number;
  entries: GeneratedSimulationEntry[];
}

function resolveProvisioningProvider(): "portal" | "c6" {
  return process.env.PORTAL_PROVISION_PROVIDER === "c6" ? "c6" : "portal";
}

function resolveRegistryDirectory(): string {
  return resolveProvisioningProvider() === "c6"
    ? resolve(".playwright/generated-c6-simulations")
    : resolve(".playwright/generated-simulations");
}

function resolveProfileName(): string {
  const profile = process.env.PW_PROFILE?.trim().toLowerCase() || "default";
  return profile.replace(/[^a-z0-9_-]/g, "-");
}

function registryPath(profile: string): string {
  return resolve(resolveRegistryDirectory(), `${profile}.json`);
}

async function readRegistry(profile: string): Promise<GeneratedSimulationRegistry> {
  try {
    const parsed = JSON.parse(
      await readFile(registryPath(profile), "utf8"),
    ) as Partial<GeneratedSimulationRegistry>;

    if (
      !Number.isInteger(parsed.nextSequence) ||
      Number(parsed.nextSequence) < 1 ||
      !Array.isArray(parsed.entries)
    ) {
      throw new Error("estrutura inválida");
    }

    return {
      run: parsed.run as C6FreshRunMetadata | undefined,
      nextSequence: Number(parsed.nextSequence),
      entries: parsed.entries as GeneratedSimulationEntry[],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { nextSequence: 1, entries: [] };
    }

    throw new Error(
      `Registro local de simulações inválido para o perfil ${profile}.`,
      { cause: error },
    );
  }
}

async function persistRegistry(
  profile: string,
  registry: GeneratedSimulationRegistry,
): Promise<void> {
  await mkdir(resolveRegistryDirectory(), { recursive: true });
  const destination = registryPath(profile);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(
    temporary,
    `${JSON.stringify(registry, null, 2)}\n`,
    { mode: 0o600 },
  );
  await rename(temporary, destination);
}

function buildApplicant(
  scenario: ProvisioningSimulationScenario,
  applicantName: string,
  usedCpfs: ReadonlySet<string>,
): SimulationApplicantInput {
  let cpfDigits = "";
  do {
    cpfDigits = generateValidCpfDigits(() => randomInt(10));
  } while (usedCpfs.has(cpfDigits));

  return {
    cpfDigits,
    name: applicantName,
    email: scenario.applicantSeed.email,
    mobileDigits: scenario.applicantSeed.mobileDigits,
  };
}

function buildApplicantForSlot(
  registry: GeneratedSimulationRegistry,
  slotId: ProvisioningSlotId,
  scenario: ProvisioningSimulationScenario,
  usedCpfs: ReadonlySet<string>,
): SimulationApplicantInput {
  const slot = getProvisioningSlot(slotId);
  if (slot.creationMode !== "simulator-shared") {
    return buildApplicant(scenario, slot.applicantName, usedCpfs);
  }

  const sharedEntry = registry.entries.find(
    (entry) => entry.slotId === slot.sharedCpfWith,
  );
  if (!sharedEntry?.protocol || !sharedEntry.applicant.cpfDigits) {
    throw new Error(
      `${slot.sharedCpfWith} precisa ser criado antes de ${slot.id} compartilhar seu CPF.`,
    );
  }
  if (registry.run?.id && sharedEntry.runId !== registry.run.id) {
    throw new Error(
      `${slot.sharedCpfWith} não pertence ao lote C6 ativo ${registry.run.id}.`,
    );
  }

  return {
    cpfDigits: sharedEntry.applicant.cpfDigits,
    name: slot.applicantName,
    email: scenario.applicantSeed.email,
    mobileDigits: scenario.applicantSeed.mobileDigits,
  };
}

export async function reserveProvisioningSlot(
  slotId: ProvisioningSlotId,
  scenario: ProvisioningSimulationScenario,
): Promise<GeneratedSimulationEntry> {
  const profile = resolveProfileName();
  const registry = await readRegistry(profile);
  const slot = getProvisioningSlot(slotId);
  const existingIndex = registry.entries.findIndex(
    (entry) => entry.slotId === slotId,
  );

  if (existingIndex >= 0) {
    const existing = registry.entries[existingIndex];
    if (!existing) throw new Error(`Reserva inválida para o slot ${slotId}.`);
    if (existing.protocol) return existing;

    const usedCpfs = new Set(
      registry.entries
        .filter((_, index) => index !== existingIndex)
        .map((entry) => entry.applicant.cpfDigits),
    );
    const applicant = buildApplicantForSlot(
      registry,
      slotId,
      scenario,
      usedCpfs,
    );

    const renewed: GeneratedSimulationEntry = {
      ...existing,
      runId: registry.run?.id,
      environmentKey: slot.environmentKey,
      purpose: slot.purpose,
      desiredState: slot.desiredState,
      stateOwner: slot.stateOwner,
      applicant,
      scenario,
      failure: undefined,
      rejectedAt: undefined,
      status: "reserved",
    };
    registry.entries[existingIndex] = renewed;
    await persistRegistry(profile, registry);
    return renewed;
  }

  const applicant = buildApplicantForSlot(
    registry,
    slotId,
    scenario,
    new Set(registry.entries.map((entry) => entry.applicant.cpfDigits)),
  );

  const entry: GeneratedSimulationEntry = {
    id: randomUUID(),
    runId: registry.run?.id,
    profile,
    slotId,
    environmentKey: slot.environmentKey,
    purpose: slot.purpose,
    desiredState: slot.desiredState,
    stateOwner: slot.stateOwner,
    sequence: slot.sequence,
    applicant,
    scenario,
    createdAt: new Date().toISOString(),
    status: "reserved",
  };

  registry.nextSequence = Math.max(registry.nextSequence, slot.sequence + 1);
  registry.entries.push(entry);
  await persistRegistry(profile, registry);
  return entry;
}

async function updateGeneratedSimulation(
  id: string,
  update: Partial<GeneratedSimulationEntry>,
): Promise<GeneratedSimulationEntry> {
  const profile = resolveProfileName();
  const registry = await readRegistry(profile);
  const index = registry.entries.findIndex((entry) => entry.id === id);
  if (index < 0) {
    throw new Error(`Reserva de simulação não encontrada: ${id}`);
  }

  const current = registry.entries[index];
  if (!current) {
    throw new Error(`Reserva de simulação inválida: ${id}`);
  }

  const updated = { ...current, ...update };
  registry.entries[index] = updated;
  await persistRegistry(profile, registry);
  return updated;
}

export function markGeneratedSimulationSubmitted(
  id: string,
  protocol: string,
): Promise<GeneratedSimulationEntry> {
  return updateGeneratedSimulation(id, {
    protocol,
    submittedAt: new Date().toISOString(),
    status: "submitted",
  });
}

export function markGeneratedSimulationValidated(
  id: string,
): Promise<GeneratedSimulationEntry> {
  return updateGeneratedSimulation(id, {
    scciValidatedAt: new Date().toISOString(),
    status: "scci-validated",
  });
}

export function markGeneratedSimulationStatePrepared(
  id: string,
): Promise<GeneratedSimulationEntry> {
  return updateGeneratedSimulation(id, {
    statePreparedAt: new Date().toISOString(),
    status: "state-prepared",
  });
}

export function markGeneratedSimulationPropertyPrepared(
  id: string,
): Promise<GeneratedSimulationEntry> {
  return updateGeneratedSimulation(id, {
    propertyPreparedAt: new Date().toISOString(),
  });
}

export function refreshGeneratedSimulationScenario(
  id: string,
  scenario: ProvisioningSimulationScenario,
): Promise<GeneratedSimulationEntry> {
  return updateGeneratedSimulation(id, { scenario });
}

export function markGeneratedSimulationDocumentNames(
  id: string,
  documentNames: readonly string[],
): Promise<GeneratedSimulationEntry> {
  if (documentNames.length === 0) {
    throw new Error("A massa documental precisa possuir pelo menos um slot.");
  }
  return updateGeneratedSimulation(id, {
    documentNames: Object.freeze([...documentNames]),
    documentNamesCapturedAt: new Date().toISOString(),
  });
}

export async function recordGeneratedSimulationDocumentNames(
  operationNumber: string,
  documentNames: readonly string[],
): Promise<GeneratedSimulationEntry | undefined> {
  const profile = resolveProfileName();
  const registry = await readRegistry(profile);
  const normalizedOperation = operationNumber.replace(/\D/g, "");
  const entry = registry.entries.find(
    (candidate) =>
      candidate.protocol?.replace(/\D/g, "") === normalizedOperation &&
      (!registry.run?.id || candidate.runId === registry.run.id),
  );
  if (!entry) return undefined;

  return markGeneratedSimulationDocumentNames(entry.id, documentNames);
}

export function markGeneratedSimulationReady(
  id: string,
): Promise<GeneratedSimulationEntry> {
  return updateGeneratedSimulation(id, {
    validatedAt: new Date().toISOString(),
    rejectedAt: undefined,
    failure: undefined,
    status: "ready",
  });
}

export function markGeneratedSimulationRejected(
  id: string,
  failure: string,
): Promise<GeneratedSimulationEntry> {
  return updateGeneratedSimulation(id, {
    rejectedAt: new Date().toISOString(),
    failure,
    status: "rejected",
  });
}

export async function listGeneratedSimulations(): Promise<
  readonly GeneratedSimulationEntry[]
> {
  return (await readRegistry(resolveProfileName())).entries;
}

export async function getExpectedNextOperationForActiveRun(): Promise<string> {
  const profile = resolveProfileName();
  const registry = await readRegistry(profile);
  if (!registry.run?.id) {
    throw new Error(
      "Não existe lote C6 ativo para calcular a próxima operação esperada.",
    );
  }

  const operations = registry.entries
    .filter((entry) => entry.runId === registry.run?.id && entry.protocol)
    .map((entry) => entry.protocol!)
    .filter((operation) => /^\d{9}$/.test(operation))
    .map(Number);
  if (operations.length === 0) {
    throw new Error(
      `O lote C6 ${registry.run.id} ainda não possui uma operação anterior.`,
    );
  }

  return String(Math.max(...operations) + 1).padStart(9, "0");
}

export async function getGeneratedSimulationForSlot(
  slotId: ProvisioningSlotId,
): Promise<GeneratedSimulationEntry | undefined> {
  const profile = resolveProfileName();
  const registry = await readRegistry(profile);
  const index = registry.entries.findIndex((entry) => entry.slotId === slotId);
  if (index < 0) return undefined;

  const current = registry.entries[index];
  if (!current) return undefined;

  const slot = getProvisioningSlot(slotId);
  const synchronized: GeneratedSimulationEntry = {
    ...current,
    environmentKey: slot.environmentKey,
    purpose: slot.purpose,
    desiredState: slot.desiredState,
    stateOwner: slot.stateOwner,
  };
  registry.entries[index] = synchronized;
  await persistRegistry(profile, registry);
  return synchronized;
}
