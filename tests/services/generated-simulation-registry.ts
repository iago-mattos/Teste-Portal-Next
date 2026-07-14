import { randomInt, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getProvisioningSlot } from "../test-data/provisioning-data";
import { generateValidCpfDigits } from "../helpers/cpf";
import type {
  DigitalMortgageSimulationScenario,
  SimulationApplicantInput,
} from "../types/simulator";
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
  readonly profile: string;
  readonly slotId?: ProvisioningSlotId;
  readonly environmentKey?: string;
  readonly purpose?: string;
  readonly desiredState?: string;
  readonly stateOwner?: ProvisioningStateOwner;
  readonly sequence: number;
  readonly applicant: SimulationApplicantInput;
  readonly scenario: DigitalMortgageSimulationScenario;
  readonly createdAt: string;
  readonly protocol?: string;
  readonly submittedAt?: string;
  readonly scciValidatedAt?: string;
  readonly statePreparedAt?: string;
  readonly validatedAt?: string;
  readonly rejectedAt?: string;
  readonly failure?: string;
  readonly status: GeneratedSimulationStatus;
}

interface GeneratedSimulationRegistry {
  nextSequence: number;
  entries: GeneratedSimulationEntry[];
}

const registryDirectory = resolve(".playwright/generated-simulations");

function resolveProfileName(): string {
  const profile = process.env.PW_PROFILE?.trim().toLowerCase() || "default";
  return profile.replace(/[^a-z0-9_-]/g, "-");
}

function registryPath(profile: string): string {
  return resolve(registryDirectory, `${profile}.json`);
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
  await mkdir(registryDirectory, { recursive: true });
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
  scenario: DigitalMortgageSimulationScenario,
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

export async function reserveProvisioningSlot(
  slotId: ProvisioningSlotId,
  scenario: DigitalMortgageSimulationScenario,
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
    const applicant = buildApplicant(
      scenario,
      slot.applicantName,
      usedCpfs,
    );

    const renewed: GeneratedSimulationEntry = {
      ...existing,
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

  const applicant = buildApplicant(
    scenario,
    slot.applicantName,
    new Set(registry.entries.map((entry) => entry.applicant.cpfDigits)),
  );

  const entry: GeneratedSimulationEntry = {
    id: randomUUID(),
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

export function markGeneratedSimulationReady(
  id: string,
): Promise<GeneratedSimulationEntry> {
  return updateGeneratedSimulation(id, {
    validatedAt: new Date().toISOString(),
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
