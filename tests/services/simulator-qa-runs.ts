import { randomInt } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateValidCnpjDigits } from "../helpers/cnpj";
import { generateValidCpfDigits } from "../helpers/cpf";
import type { SimulationApplicantInput } from "../types/simulator";

/**
 * Registro das propostas criadas pelos testes de jornadas do Simulador. É
 * separado do registro de provisionamento (slots): não consome massas do
 * provisionador. Regras de segurança:
 * - uma entrada por cenário; com protocolo, a criação é pulada e só a verificação roda;
 * - tentativa de envio sem protocolo (retorno incerto) bloqueia nova criação:
 *   a proposta pode existir no SCCI e precisa ser conferida manualmente antes.
 */
export type QaRunStatus =
  | "reserved"
  | "submission-attempted"
  | "submitted"
  | "scci-validated"
  | "rejected";

export interface QaRunEntry {
  readonly id: string;
  readonly scenarioId: string;
  readonly profile: string;
  /** Tipo do documento do proponente; ausente em entradas antigas = CPF. */
  readonly documentKind?: "CPF" | "CNPJ";
  /**
   * Proponente. Para `documentKind: "CNPJ"`, `cpfDigits` guarda o CNPJ e `name`
   * a razão social (campos do tipo compartilhado com Pessoa Física).
   */
  readonly applicant: SimulationApplicantInput;
  readonly createdAt: string;
  readonly status: QaRunStatus;
  readonly submissionAttemptedAt?: string;
  readonly protocol?: string;
  readonly submittedAt?: string;
  readonly scciValidatedAt?: string;
  readonly failure?: string;
}

interface QaRunRegistry {
  entries: QaRunEntry[];
}

function profileName(): string {
  const profile = process.env.PW_PROFILE?.trim().toLowerCase() || "default";
  return profile.replace(/[^a-z0-9_-]/g, "-");
}

function registryPath(): string {
  return resolve(".playwright/simulator-qa-runs", `${profileName()}.json`);
}

async function read(): Promise<QaRunRegistry> {
  try {
    const parsed = JSON.parse(
      await readFile(registryPath(), "utf8"),
    ) as Partial<QaRunRegistry>;
    if (!Array.isArray(parsed.entries)) throw new Error("estrutura inválida");
    return { entries: parsed.entries };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { entries: [] };
    }
    throw new Error(
      `Registro de propostas de QA inválido (${registryPath()}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function persist(registry: QaRunRegistry): Promise<void> {
  const path = registryPath();
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporary, path);
}

async function update(
  id: string,
  change: (entry: QaRunEntry) => QaRunEntry,
): Promise<QaRunEntry> {
  const registry = await read();
  const index = registry.entries.findIndex((entry) => entry.id === id);
  const current = registry.entries[index];
  if (index < 0 || !current) throw new Error(`Entrada de QA inexistente: ${id}.`);
  const next = change(current);
  registry.entries[index] = next;
  await persist(registry);
  return next;
}

export async function reserveQaRun(
  scenarioId: string,
  seed: Readonly<{ email: string; mobileDigits: string }>,
  documentKind: "CPF" | "CNPJ" = "CPF",
): Promise<QaRunEntry> {
  const registry = await read();
  const existing = registry.entries.find(
    (entry) => entry.scenarioId === scenarioId,
  );

  if (existing) {
    if (existing.protocol) return existing;
    if (existing.submissionAttemptedAt) {
      throw new Error(
        `${scenarioId}: houve uma tentativa de envio em ${existing.submissionAttemptedAt} sem protocolo. ` +
          "A proposta pode ter sido criada no SCCI; confira antes de remover esta entrada. " +
          "A automação não criará outra proposta.",
      );
    }
    return existing;
  }

  const usedDocuments = new Set(
    registry.entries.map((e) => e.applicant.cpfDigits),
  );
  const generate = () =>
    documentKind === "CNPJ"
      ? generateValidCnpjDigits(() => randomInt(10))
      : generateValidCpfDigits(() => randomInt(10));
  let cpfDigits = generate();
  while (usedDocuments.has(cpfDigits)) cpfDigits = generate();

  const entry: QaRunEntry = {
    id: `${scenarioId}-${Date.now()}`,
    scenarioId,
    profile: profileName(),
    documentKind,
    applicant: {
      cpfDigits,
      name: `Playwright QA ${scenarioId}`,
      email: seed.email,
      mobileDigits: seed.mobileDigits,
    },
    createdAt: new Date().toISOString(),
    status: "reserved",
  };
  registry.entries.push(entry);
  await persist(registry);
  return entry;
}

export function markQaRunAttempt(id: string): Promise<QaRunEntry> {
  return update(id, (entry) => ({
    ...entry,
    status: "submission-attempted",
    submissionAttemptedAt: new Date().toISOString(),
  }));
}

export function markQaRunSubmitted(
  id: string,
  protocol: string,
): Promise<QaRunEntry> {
  return update(id, (entry) => ({
    ...entry,
    status: "submitted",
    protocol,
    submittedAt: new Date().toISOString(),
  }));
}

export function markQaRunValidated(id: string): Promise<QaRunEntry> {
  return update(id, (entry) => ({
    ...entry,
    status: "scci-validated",
    scciValidatedAt: new Date().toISOString(),
  }));
}

export function markQaRunRejected(
  id: string,
  failure: string,
): Promise<QaRunEntry> {
  return update(id, (entry) => ({ ...entry, status: "rejected", failure }));
}

/** Entrada já registrada de um cenário (somente leitura); `undefined` se ainda não existe. */
export async function findQaRun(scenarioId: string): Promise<QaRunEntry | undefined> {
  return (await read()).entries.find((entry) => entry.scenarioId === scenarioId);
}
