import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import slots from "../tests/test-data/provisioning-slots.json" with { type: "json" };
import { loadEnvironmentProfile } from "./environment-profile.mjs";

const command = process.argv[2] ?? "status";
const slotId = process.argv[3]?.trim().toUpperCase();
const operationArgument = process.argv[4]?.replace(/\D/g, "");
const profile = loadEnvironmentProfile().name;
const registryPath = resolve(
  `.playwright/generated-simulations/${profile}.json`,
);
const massesPath = resolve(`.env.${profile}.masses.local`);

function resolveTargetCount() {
  const rawValue = process.env.PORTAL_MASS_TARGET_COUNT?.trim();
  const value = Number(rawValue);
  if (
    !rawValue ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > slots.length
  ) {
    throw new Error(
      `PORTAL_MASS_TARGET_COUNT deve ser um inteiro entre 1 e ${slots.length}.`,
    );
  }
  return value;
}

async function readRegistry() {
  try {
    const registry = JSON.parse(await readFile(registryPath, "utf8"));
    if (!Array.isArray(registry.entries)) throw new Error("entries ausente");
    return registry;
  } catch (error) {
    if (error?.code === "ENOENT") return { nextSequence: 1, entries: [] };
    throw new Error(`Registro inválido: ${registryPath}`, { cause: error });
  }
}

async function writeAtomic(path, content) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path);
}

function formatDate(isoValue) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(isoValue));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.day}/${value.month}/${value.year}`;
}

function formatCurrency(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents) / 100).replace(/\u00a0/g, " ");
}

function quote(value) {
  return JSON.stringify(String(value));
}

function findEntry(registry, id) {
  return registry.entries.find((entry) => entry.slotId === id);
}

async function showStatus() {
  const registry = await readRegistry();
  const targetCount = resolveTargetCount();
  console.log(`Provisionamento: ${profile} (${targetCount} massa(s) no lote)`);
  console.table(
    slots.map((slot) => {
      const entry = findEntry(registry, slot.id);
      const sharedEntry = slot.sharedCpfWith
        ? findEntry(registry, slot.sharedCpfWith)
        : undefined;
      return {
        lote: slot.sequence <= targetCount ? "sim" : "não",
        slot: slot.id,
        nome: entry?.applicant?.name ?? slot.applicantName,
        cpf:
          entry?.applicant?.cpfDigits ??
          sharedEntry?.applicant?.cpfDigits ??
          "-",
        operacao: entry?.protocol ?? "-",
        status:
          entry?.status ??
          (slot.creationMode === "manual-shared" ? "manual" : "pendente"),
        estado: slot.desiredState,
      };
    }),
  );
}

async function markReady() {
  if (!slotId) {
    throw new Error(
      "Informe o slot confirmado, por exemplo: npm run pw:provision:mark-ready -- DEFAULT",
    );
  }
  const slot = slots.find((entry) => entry.id === slotId);
  if (!slot) throw new Error(`Slot desconhecido: ${slotId}`);

  const registry = await readRegistry();
  const entry = findEntry(registry, slot.id);
  if (!entry?.protocol) {
    throw new Error(`${slot.id} ainda não possui uma operação criada.`);
  }

  entry.status = "ready";
  entry.statePreparedAt = new Date().toISOString();
  entry.validatedAt = entry.validatedAt ?? entry.statePreparedAt;
  entry.environmentKey = slot.environmentKey;
  entry.purpose = slot.purpose;
  entry.desiredState = slot.desiredState;
  entry.stateOwner = slot.stateOwner;
  await writeAtomic(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`${slot.id} marcado como pronto para ${slot.desiredState}.`);
}

async function registerManual() {
  const slot = slots.find((entry) => entry.id === slotId);
  if (!slot || slot.creationMode !== "manual-shared") {
    throw new Error("Informe um slot manual compartilhado valido.");
  }
  if (!/^\d{9}$/.test(operationArgument ?? "")) {
    throw new Error("A operacao manual precisa conter exatamente 9 digitos.");
  }

  const registry = await readRegistry();
  const sharedEntry = findEntry(registry, slot.sharedCpfWith);
  if (!sharedEntry?.protocol) {
    throw new Error(
      `${slot.sharedCpfWith} precisa ser provisionado antes de registrar ${slot.id}.`,
    );
  }

  const duplicate = registry.entries.find(
    (entry) => entry.protocol === operationArgument && entry.slotId !== slot.id,
  );
  if (duplicate) {
    throw new Error(
      `A operacao ${operationArgument} ja pertence ao slot ${duplicate.slotId}.`,
    );
  }

  const existing = findEntry(registry, slot.id);
  if (existing?.protocol === operationArgument) {
    console.log(`${slot.id} ja registra a operacao ${operationArgument}.`);
    return;
  }
  if (existing?.protocol) {
    throw new Error(
      `${slot.id} ja possui a operacao ${existing.protocol}; remova-a conscientemente antes de substituir a massa.`,
    );
  }

  const now = new Date().toISOString();
  const entry = {
    id: existing?.id ?? randomUUID(),
    profile,
    slotId: slot.id,
    environmentKey: slot.environmentKey,
    purpose: slot.purpose,
    desiredState: slot.desiredState,
    stateOwner: slot.stateOwner,
    sequence: slot.sequence,
    applicant: {
      ...sharedEntry.applicant,
      name: slot.applicantName,
    },
    scenario: sharedEntry.scenario,
    createdAt: existing?.createdAt ?? now,
    protocol: operationArgument,
    submittedAt: now,
    status: "submitted",
  };

  if (existing) {
    Object.assign(existing, entry);
  } else {
    registry.entries.push(entry);
  }
  registry.nextSequence = Math.max(registry.nextSequence, slot.sequence + 1);
  await writeAtomic(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(
    `${slot.id} registrou ${operationArgument} com o CPF compartilhado de ${slot.sharedCpfWith}.`,
  );
}

async function publishMasses() {
  const registry = await readRegistry();
  const officialSlots = slots.filter((slot) => slot.id !== "RESERVE");
  const targetCount = resolveTargetCount();
  if (targetCount < officialSlots.length) {
    throw new Error(
      `Publicação completa exige ${officialSlots.length} massas oficiais; o lote atual solicita somente ${targetCount}.`,
    );
  }
  const incomplete = officialSlots.filter((slot) => {
    const entry = findEntry(registry, slot.id);
    return !entry?.protocol || entry.status !== "ready";
  });
  if (incomplete.length > 0) {
    throw new Error(
      `Publicação bloqueada. Slots não prontos: ${incomplete.map((slot) => slot.id).join(", ")}.`,
    );
  }

  const defaultEntry = findEntry(registry, "DEFAULT");
  if (!defaultEntry?.protocol || !defaultEntry.submittedAt) {
    throw new Error("A massa DEFAULT não possui protocolo e data de criação.");
  }
  const phase = process.env.PORTAL_MASS_DEFAULT_PHASE?.trim();
  const interestType = process.env.PORTAL_MASS_DEFAULT_INTEREST_TYPE?.trim();
  if (!phase || !interestType) {
    throw new Error(
      "Defina PORTAL_MASS_DEFAULT_PHASE e PORTAL_MASS_DEFAULT_INTEREST_TYPE no perfil após confirmar o contrato visual da massa DEFAULT.",
    );
  }

  const lines = [
    "# Gerado pelo provisionador. Não edite operações manualmente.",
    "# Para substituir uma massa, atualize o registro e publique novamente.",
    "PORTAL_MASS_BATCH_STATUS=ready",
    `PORTAL_MASS_TARGET_COUNT=${targetCount}`,
    `PORTAL_TEST_CPF=${defaultEntry.applicant.cpfDigits}`,
    "",
  ];
  for (const slot of officialSlots) {
    const entry = findEntry(registry, slot.id);
    lines.push(`# ${slot.id}: ${slot.purpose}`);
    lines.push(`# Estado necessário: ${slot.desiredState}`);
    lines.push(`${slot.environmentKey}=${entry.protocol}`);
  }

  const operationCpfs = Object.fromEntries(
    officialSlots.map((slot) => {
      const entry = findEntry(registry, slot.id);
      return [entry.protocol, entry.applicant.cpfDigits];
    }),
  );
  lines.push(
    `PORTAL_MASS_OPERATION_CPFS_JSON='${JSON.stringify(operationCpfs)}'`,
  );

  const financial = defaultEntry.scenario.financial;
  lines.push(
    "",
    "# Contrato visual gerado a partir da massa DEFAULT.",
    `PORTAL_EXPECTED_PROPONENT_NAME=${quote(defaultEntry.applicant.name)}`,
    `PORTAL_EXPECTED_CPF_ENDING=${defaultEntry.applicant.cpfDigits.slice(-2)}`,
    `PORTAL_EXPECTED_REGISTRATION_DATE=${formatDate(defaultEntry.submittedAt)}`,
    `PORTAL_EXPECTED_PROPERTY_VALUE=${quote(formatCurrency(financial.propertyValueCents))}`,
    `PORTAL_EXPECTED_FINANCED_VALUE=${quote(formatCurrency(financial.financingValueCents))}`,
    `PORTAL_EXPECTED_TERM=${quote(`${financial.termMonths} meses`)}`,
    `PORTAL_EXPECTED_CURRENT_PHASE=${quote(phase)}`,
    `PORTAL_EXPECTED_INTEREST_TYPE=${quote(interestType)}`,
    "",
  );
  await writeAtomic(massesPath, lines.join("\n"));
  console.log(`Massas publicadas em ${massesPath}.`);
}

if (command === "status") await showStatus();
else if (command === "mark-ready") await markReady();
else if (command === "register-manual") await registerManual();
else if (command === "publish") await publishMasses();
else throw new Error(`Comando desconhecido: ${command}`);
