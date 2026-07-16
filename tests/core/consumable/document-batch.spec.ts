import { createHash } from "node:crypto";
import type {
  Locator,
  Page,
  Request,
  Response,
  Route,
  TestInfo,
} from "@playwright/test";
import { expect, test } from "../../fixtures/test";
import { evaluateCoreCapabilities } from "../../config/core-capabilities";
import { loadCoreMassProvisioningConfig } from "../../config/core-mass-config";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import type { PortalSession } from "../../fixtures/portal.fixture";
import { ProposalDocumentsPage } from "../../pages/portal/proposal-documents.page";
import { ProposalPage } from "../../pages/portal/proposal.page";
import {
  createCorruptedPdfFile,
  createPngContentNamedAsPdf,
  createValidJpegFile,
  createValidPdfFile,
  createValidPngFile,
  type GeneratedDocumentFile,
  withDocumentIdentity,
} from "../documents/document-test-files";

const slotLabels = [
  "Holerite 1",
  "Holerite 2",
  "Holerite 3",
  "IRPF - Imposto de Renda",
  "IRPF - Recibo de entrega",
] as const;
const acceptedExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
const uploadRoutePattern = "**/api/portal/propostas/*/documentos";
const expectedApplicantNames = {
  A: "PLAYWRIGHT DOC A",
  B: "PLAYWRIGHT DOC B",
} as const;

type MassKey = keyof typeof expectedApplicantNames;
type OperationState =
  | "READY"
  | "RESERVED"
  | "IN_PROGRESS"
  | "PARTIALLY_CONSUMED"
  | "CONSUMED"
  | "QUARANTINED";
type SlotState = "READY" | "IN_PROGRESS" | "CONSUMED" | "QUARANTINED";

interface DocumentMass {
  readonly key: MassKey;
  readonly operation: string;
  readonly expectedApplicantName: string;
}

interface PersistedDocument {
  readonly slot: number;
  readonly label: string;
  readonly name: string;
  readonly digest: string;
  readonly documentId: string;
  readonly personId: string;
}

interface MassLedger {
  readonly key: MassKey;
  readonly operation: string;
  state: OperationState;
  readonly slots: Array<{
    readonly label: string;
    state: SlotState;
    persisted?: PersistedDocument;
  }>;
}

interface BatchLedger {
  readonly profile: "ht";
  readonly startedAt: string;
  finishedAt?: string;
  readonly operations: Record<MassKey, MassLedger>;
  readonly backendObservations: UploadObservation[];
  readonly scenarioResults: Record<string, "PENDING" | "PASSED" | "FAILED">;
}

interface UploadDestination {
  readonly operation: string;
  readonly documentId: string;
  readonly personId: string;
  readonly fileName: string;
}

interface UploadObservation extends UploadDestination {
  readonly scenario: string;
  readonly mass: MassKey;
  readonly slot: number;
  readonly status: number | "ABORTED";
  readonly accepted: boolean;
  readonly responseBody?: string;
}

interface UploadResult {
  readonly response: Response;
  readonly destination: UploadDestination;
  readonly body: unknown;
  readonly accepted: boolean;
}

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function digest(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function uploadPath(operation: string): string {
  return `/api/portal/propostas/${operation}/documentos`;
}

function proposalUrl(
  portalConfig: PortalRuntimeConfig,
  operation: string,
): string {
  return new URL(`/propostas/${operation}`, portalConfig.portalUrl).toString();
}

function isUploadRequest(request: Request, operation?: string): boolean {
  if (request.method() !== "POST") return false;
  const pathname = new URL(request.url()).pathname;
  return operation
    ? pathname === uploadPath(operation)
    : /^\/api\/portal\/propostas\/\d+\/documentos$/.test(pathname);
}

function multipartField(request: Request, field: string): string | undefined {
  const body = request.postDataBuffer()?.toString("latin1") ?? "";
  const match = new RegExp(`name="${field}"\\r?\\n\\r?\\n([^\\r\\n]+)`).exec(
    body,
  );
  return match?.[1];
}

function multipartFileName(request: Request): string | undefined {
  const body = request.postDataBuffer()?.toString("latin1") ?? "";
  const match = /name="arquivo"; filename="([^"]+)"/.exec(body);
  return match?.[1];
}

function destinationOf(
  request: Request,
  expected: UploadDestination,
): UploadDestination {
  const pathname = new URL(request.url()).pathname;
  const operation = /\/propostas\/(\d+)\/documentos$/.exec(pathname)?.[1];
  if (!operation) throw new Error("Operacao ausente na URL do upload.");
  const destination = {
    operation,
    documentId: multipartField(request, "documentoId") ?? expected.documentId,
    personId: multipartField(request, "pessoaId") ?? expected.personId,
    fileName: multipartFileName(request) ?? expected.fileName,
  };
  expect(destination).toEqual(expected);
  return destination;
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return response.text().catch(() => "");
  }
}

function responseAccepted(response: Response, body: unknown): boolean {
  if (!response.ok()) return false;
  if (!body || typeof body !== "object" || Array.isArray(body)) return true;
  const result = body as Record<string, unknown>;
  return result.sucesso !== false && result.success !== false;
}

function printableBody(body: unknown): string {
  if (typeof body === "string") return body.slice(0, 2_000);
  try {
    return JSON.stringify(body).slice(0, 2_000);
  } catch {
    return String(body).slice(0, 2_000);
  }
}

function getMasses(
  portalConfig: PortalRuntimeConfig,
): Record<MassKey, DocumentMass> {
  const config = loadCoreMassProvisioningConfig(portalConfig);
  return {
    A: {
      key: "A",
      operation: config.documentA.operationNumber,
      expectedApplicantName: expectedApplicantNames.A,
    },
    B: {
      key: "B",
      operation: config.documentB.operationNumber,
      expectedApplicantName: expectedApplicantNames.B,
    },
  };
}

function createLedger(masses: Record<MassKey, DocumentMass>): BatchLedger {
  const operationLedger = (mass: DocumentMass): MassLedger => ({
    key: mass.key,
    operation: mass.operation,
    state: "READY",
    slots: slotLabels.map((label) => ({ label, state: "READY" })),
  });
  return {
    profile: "ht",
    startedAt: new Date().toISOString(),
    operations: { A: operationLedger(masses.A), B: operationLedger(masses.B) },
    backendObservations: [],
    scenarioResults: {
      D1: "PENDING",
      D2: "PENDING",
      D3: "PENDING",
      D4: "PENDING",
      D5: "PENDING",
    },
  };
}

function markPersisted(
  ledger: BatchLedger,
  mass: DocumentMass,
  slot: number,
  file: GeneratedDocumentFile,
  destination: UploadDestination,
  persistedName = file.name,
): void {
  const operation = ledger.operations[mass.key];
  operation.state = "PARTIALLY_CONSUMED";
  operation.slots[slot].state = "CONSUMED";
  operation.slots[slot].persisted = {
    slot,
    label: slotLabels[slot],
    name: persistedName,
    digest: digest(file.buffer),
    documentId: destination.documentId,
    personId: destination.personId,
  };
}

function allowedPersistedNames(file: GeneratedDocumentFile): string[] {
  const extensionByMimeType: Readonly<Record<string, readonly string[]>> = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
  };
  const detectedExtensions = file.buffer
    .subarray(0, 4)
    .equals(Buffer.from("%PDF"))
    ? [".pdf"]
    : file.buffer
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ? [".png"]
      : file.buffer[0] === 0xff && file.buffer[1] === 0xd8
        ? [".jpg", ".jpeg"]
        : [];
  const extensions = [
    ...new Set([
      ...(extensionByMimeType[file.mimeType] ?? []),
      ...detectedExtensions,
    ]),
  ];
  return [
    file.name,
    ...extensions
      .filter((extension) => !file.name.toLowerCase().endsWith(extension))
      .map((extension) => `${file.name}${extension}`),
  ];
}

async function uploadedFileName(
  documents: ProposalDocumentsPage,
  slot: number,
): Promise<string> {
  const row = documents.getDocumentRowAt(slot);
  await expect(row.getByText("Documento enviado", { exact: true })).toBeVisible(
    {
      timeout: 60_000,
    },
  );
  const lines = (await row.innerText())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const statusIndex = lines.indexOf("Documento enviado");
  const fileName = statusIndex >= 0 ? lines[statusIndex + 1] : undefined;
  if (!fileName) {
    throw new Error(
      `Nome do arquivo persistido ausente no slot ${slotLabels[slot]}.`,
    );
  }
  return fileName;
}

async function attachLedger(
  testInfo: TestInfo,
  ledger: BatchLedger,
): Promise<void> {
  ledger.finishedAt = new Date().toISOString();
  await testInfo.attach("core-consumable-document-ledger", {
    body: Buffer.from(JSON.stringify(ledger, null, 2)),
    contentType: "application/json",
  });
}

async function expectEmptyRow(row: Locator): Promise<void> {
  await expect(row.getByText("Documento enviado", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    row.getByRole("link", { name: "Ver arquivo", exact: true }),
  ).toHaveCount(0);
  await expect(
    row.getByRole("button", { name: "Enviar novamente", exact: true }),
  ).toHaveCount(0);
  await expect(row.getByText(/Enviando|Carregando|Aguarde/i)).toBeHidden();
  await expect(
    row.getByRole("button", { name: "Escolher arquivo", exact: true }),
  ).toBeEnabled();
}

async function applicantName(page: Page): Promise<string> {
  const proposalPage = new ProposalPage(page);
  const text = (await proposalPage.proponentInfo.textContent()) ?? "";
  const name = /Proponente:\s*(.*?)\s*CPF:/i.exec(text)?.[1]?.trim();
  if (!name)
    throw new Error(
      "Nao foi possivel identificar o proponente da massa documental.",
    );
  return name;
}

async function openDocuments(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  mass: DocumentMass,
): Promise<ProposalDocumentsPage> {
  await portalSession.useOperation(mass.operation);
  const apiResponse = page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === "GET" &&
      new URL(response.url()).pathname ===
        `/api/portal/propostas/${mass.operation}`
    );
  });
  await page.goto(proposalUrl(portalConfig, mass.operation), {
    waitUntil: "domcontentloaded",
  });
  expect((await apiResponse).status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      name: `Proposta #${mass.operation}`,
      level: 1,
      exact: true,
    }),
  ).toBeVisible({ timeout: 30_000 });
  expect((await applicantName(page)).toUpperCase()).toBe(
    mass.expectedApplicantName,
  );

  const documentsPage = new ProposalDocumentsPage(page);
  if (!(await documentsPage.heading.isVisible())) {
    const viewDocumentation = page.getByRole("button", {
      name: "Ver Documentação",
      exact: true,
    });
    await expect(viewDocumentation).toBeVisible();
    await viewDocumentation.click();
  }
  await documentsPage.waitUntilReady();
  return documentsPage;
}

async function preflightMass(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  mass: DocumentMass,
): Promise<void> {
  const documents = await openDocuments(
    page,
    portalConfig,
    portalSession,
    mass,
  );
  expect(await documents.getDocumentCount()).toBe(5);
  for (const [index, label] of slotLabels.entries()) {
    const row = documents.getDocumentRowAt(index);
    await expect(row).toContainText(label);
    const accept = (
      await documents.getFileInputAt(index).getAttribute("accept")
    )
      ?.split(",")
      .map((value) => value.trim());
    expect(accept).toEqual(acceptedExtensions);
    await expectEmptyRow(row);
  }
  await expect(documents.pendingDocuments).toContainText("5");
  await expect(documents.completedDocuments).toContainText("0");
}

async function checklistSlotIdentity(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  mass: DocumentMass,
  slot: number,
): Promise<Readonly<{ documentId: string; personId: string }>> {
  const response = await page.request.get(
    new URL(
      `/api/portal/propostas/${mass.operation}/checklist`,
      portalConfig.portalUrl,
    ).toString(),
  );
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    pessoa?: Array<{
      id?: unknown;
      pessoaId?: unknown;
      documentos?: Array<{ id?: unknown; tipo?: unknown }>;
    }>;
  };
  for (const person of body.pessoa ?? []) {
    const document = person.documentos?.find(
      (entry) => String(entry.tipo) === slotLabels[slot],
    );
    if (!document?.id) continue;
    const personId = person.pessoaId ?? person.id;
    if (!personId) continue;
    return { documentId: String(document.id), personId: String(personId) };
  }
  throw new Error(
    `Checklist nao apresentou a identidade do slot ${slotLabels[slot]} em ${mass.key}.`,
  );
}

function isResumeFromAcceptedB0(): boolean {
  return [
    "B0_PNG_ACCEPTED",
    "B0_B4_ACCEPTED",
    "B0_B1_B2_B4_ACCEPTED",
    "B_FULL_A_READY_AFTER_ABORT",
  ].includes(process.env.PORTAL_CORE_CONSUMABLE_RESUME ?? "");
}

function isResumeFromAcceptedB4(): boolean {
  return [
    "B0_B4_ACCEPTED",
    "B0_B1_B2_B4_ACCEPTED",
    "B_FULL_A_READY_AFTER_ABORT",
  ].includes(process.env.PORTAL_CORE_CONSUMABLE_RESUME ?? "");
}

function isResumeFromAcceptedB1B2(): boolean {
  return ["B0_B1_B2_B4_ACCEPTED", "B_FULL_A_READY_AFTER_ABORT"].includes(
    process.env.PORTAL_CORE_CONSUMABLE_RESUME ?? "",
  );
}

function isResumeFromFullBAfterD1Abort(): boolean {
  return (
    process.env.PORTAL_CORE_CONSUMABLE_RESUME === "B_FULL_A_READY_AFTER_ABORT"
  );
}

async function preflightResumeCheckpoint(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  masses: Record<MassKey, DocumentMass>,
): Promise<void> {
  await preflightMass(page, portalConfig, portalSession, masses.A);
  const documentsB = await openDocuments(
    page,
    portalConfig,
    portalSession,
    masses.B,
  );
  expect(await documentsB.getDocumentCount()).toBe(5);
  const persistedName = await expectPersistedContent(
    documentsB,
    0,
    createPngContentNamedAsPdf(),
  );
  expect(persistedName).toBe("core-content-mismatch.pdf.png");
  if (isResumeFromAcceptedB4()) {
    const persistedB4 = await expectPersistedContent(
      documentsB,
      4,
      withDocumentIdentity(
        createValidJpegFile("CORE-JPG-RENAMED"),
        "core-jpg-renamed.pdf",
        "image/jpeg",
      ),
    );
    expect(persistedB4).toBe("core-jpg-renamed.pdf.jpg");
  }
  if (isResumeFromAcceptedB1B2()) {
    expect(
      await expectPersistedContent(
        documentsB,
        1,
        withDocumentIdentity(
          createValidPngFile(),
          "core-mime-mismatch.pdf",
          "image/png",
        ),
      ),
    ).toBe("core-mime-mismatch.pdf.png");
    expect(
      await expectPersistedContent(
        documentsB,
        2,
        withDocumentIdentity(
          createValidPdfFile("CORE-PDF-RENAMED"),
          "core-pdf-renamed.jpg",
          "image/jpeg",
        ),
      ),
    ).toBe("core-pdf-renamed.jpg.pdf");
  }
  if (isResumeFromFullBAfterD1Abort()) {
    expect(
      await expectPersistedContent(documentsB, 3, createCorruptedPdfFile()),
    ).toBe("core-corrupted.pdf");
  }
  const readySlots = isResumeFromFullBAfterD1Abort()
    ? []
    : isResumeFromAcceptedB1B2()
      ? [3]
      : isResumeFromAcceptedB4()
        ? [1, 2, 3]
        : [1, 2, 3, 4];
  for (const slot of readySlots) {
    await expectEmptyRow(documentsB.getDocumentRowAt(slot));
  }
  await expect(documentsB.pendingDocuments).toContainText(
    isResumeFromFullBAfterD1Abort()
      ? "0"
      : isResumeFromAcceptedB1B2()
        ? "1"
        : isResumeFromAcceptedB4()
          ? "3"
          : "4",
  );
  await expect(documentsB.completedDocuments).toContainText(
    isResumeFromFullBAfterD1Abort()
      ? "5"
      : isResumeFromAcceptedB1B2()
        ? "4"
        : isResumeFromAcceptedB4()
          ? "2"
          : "1",
  );
}

async function verifyResumeStructureWithoutDownloading(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  masses: Record<MassKey, DocumentMass>,
): Promise<void> {
  await preflightMass(page, portalConfig, portalSession, masses.A);
  const documentsB = await openDocuments(
    page,
    portalConfig,
    portalSession,
    masses.B,
  );
  expect(await documentsB.getDocumentCount()).toBe(5);
  await documentsB.expectUploadedDocumentAt(0, "core-content-mismatch.pdf.png");
  if (isResumeFromAcceptedB4()) {
    await documentsB.expectUploadedDocumentAt(4, "core-jpg-renamed.pdf.jpg");
  }
  if (isResumeFromAcceptedB1B2()) {
    await documentsB.expectUploadedDocumentAt(1, "core-mime-mismatch.pdf.png");
    await documentsB.expectUploadedDocumentAt(2, "core-pdf-renamed.jpg.pdf");
  }
  if (isResumeFromFullBAfterD1Abort()) {
    await documentsB.expectUploadedDocumentAt(3, "core-corrupted.pdf");
  }
  const readySlots = isResumeFromFullBAfterD1Abort()
    ? []
    : isResumeFromAcceptedB1B2()
      ? [3]
      : isResumeFromAcceptedB4()
        ? [1, 2, 3]
        : [1, 2, 3, 4];
  for (const slot of readySlots) {
    await expectEmptyRow(documentsB.getDocumentRowAt(slot));
  }
  await expect(documentsB.pendingDocuments).toContainText(
    isResumeFromFullBAfterD1Abort()
      ? "0"
      : isResumeFromAcceptedB1B2()
        ? "1"
        : isResumeFromAcceptedB4()
          ? "3"
          : "4",
  );
  await expect(documentsB.completedDocuments).toContainText(
    isResumeFromFullBAfterD1Abort()
      ? "5"
      : isResumeFromAcceptedB1B2()
        ? "4"
        : isResumeFromAcceptedB4()
          ? "2"
          : "1",
  );
}

async function initializeResumeCheckpoint(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  ledger: BatchLedger,
  mass: DocumentMass,
): Promise<void> {
  const file = createPngContentNamedAsPdf();
  const identity = await checklistSlotIdentity(page, portalConfig, mass, 0);
  markPersisted(
    ledger,
    mass,
    0,
    file,
    {
      operation: mass.operation,
      documentId: identity.documentId,
      personId: identity.personId,
      fileName: file.name,
    },
    "core-content-mismatch.pdf.png",
  );
  ledger.backendObservations.push({
    scenario: "D2-png-as-pdf-resumed",
    mass: mass.key,
    slot: 0,
    operation: mass.operation,
    documentId: identity.documentId,
    personId: identity.personId,
    fileName: file.name,
    status: 200,
    accepted: true,
    responseBody:
      "Checkpoint comprovado por nova leitura após a execução interrompida.",
  });
  if (isResumeFromAcceptedB4()) {
    const fileB4 = withDocumentIdentity(
      createValidJpegFile("CORE-JPG-RENAMED"),
      "core-jpg-renamed.pdf",
      "image/jpeg",
    );
    const identityB4 = await checklistSlotIdentity(page, portalConfig, mass, 4);
    markPersisted(
      ledger,
      mass,
      4,
      fileB4,
      {
        operation: mass.operation,
        documentId: identityB4.documentId,
        personId: identityB4.personId,
        fileName: fileB4.name,
      },
      "core-jpg-renamed.pdf.jpg",
    );
    ledger.backendObservations.push({
      scenario: "D2-jpg-as-pdf-resumed",
      mass: mass.key,
      slot: 4,
      operation: mass.operation,
      documentId: identityB4.documentId,
      personId: identityB4.personId,
      fileName: fileB4.name,
      status: 200,
      accepted: true,
      responseBody:
        "Checkpoint comprovado por nova leitura após a execução interrompida.",
    });
  }
  if (isResumeFromAcceptedB1B2()) {
    for (const entry of [
      {
        slot: 1,
        file: withDocumentIdentity(
          createValidPngFile(),
          "core-mime-mismatch.pdf",
          "image/png",
        ),
        persistedName: "core-mime-mismatch.pdf.png",
        scenario: "D2-mime-mismatch-resumed",
      },
      {
        slot: 2,
        file: withDocumentIdentity(
          createValidPdfFile("CORE-PDF-RENAMED"),
          "core-pdf-renamed.jpg",
          "image/jpeg",
        ),
        persistedName: "core-pdf-renamed.jpg.pdf",
        scenario: "D2-pdf-as-jpg-resumed",
      },
    ] as const) {
      const entryIdentity = await checklistSlotIdentity(
        page,
        portalConfig,
        mass,
        entry.slot,
      );
      const destination = {
        operation: mass.operation,
        documentId: entryIdentity.documentId,
        personId: entryIdentity.personId,
        fileName: entry.file.name,
      };
      markPersisted(
        ledger,
        mass,
        entry.slot,
        entry.file,
        destination,
        entry.persistedName,
      );
      ledger.backendObservations.push({
        scenario: entry.scenario,
        mass: mass.key,
        slot: entry.slot,
        ...destination,
        status: 200,
        accepted: true,
        responseBody:
          "Checkpoint comprovado por nova leitura após a execução interrompida.",
      });
    }
  }
}

async function initializeFullBAfterD1AbortCheckpoint(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  ledger: BatchLedger,
  masses: Record<MassKey, DocumentMass>,
): Promise<void> {
  if (!isResumeFromFullBAfterD1Abort()) return;
  for (const entry of [
    {
      mass: masses.B,
      slot: 3,
      file: createCorruptedPdfFile(),
      persistedName: "core-corrupted.pdf",
      scenario: "D2-corrupted-pdf-resumed",
    },
  ] as const) {
    const identity = await checklistSlotIdentity(
      page,
      portalConfig,
      entry.mass,
      entry.slot,
    );
    const destination = {
      operation: entry.mass.operation,
      documentId: identity.documentId,
      personId: identity.personId,
      fileName: entry.file.name,
    };
    markPersisted(
      ledger,
      entry.mass,
      entry.slot,
      entry.file,
      destination,
      entry.persistedName,
    );
    ledger.backendObservations.push({
      scenario: entry.scenario,
      mass: entry.mass.key,
      slot: entry.slot,
      ...destination,
      status: 200,
      accepted: true,
      responseBody:
        "Checkpoint comprovado por nova leitura após a execução interrompida.",
    });
  }
}

async function expectedDestinationForSlot(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  mass: DocumentMass,
  slot: number,
  fileName: string,
): Promise<UploadDestination> {
  const identity = await checklistSlotIdentity(page, portalConfig, mass, slot);
  return {
    operation: mass.operation,
    documentId: identity.documentId,
    personId: identity.personId,
    fileName,
  };
}

async function performRealUpload(
  page: Page,
  documents: ProposalDocumentsPage,
  mass: DocumentMass,
  slot: number,
  file: GeneratedDocumentFile,
  expectedDestination: UploadDestination,
): Promise<UploadResult> {
  const responsePromise = page.waitForResponse((response) =>
    isUploadRequest(response.request(), mass.operation),
  );
  await documents.chooseFilePayloadAt(slot, file);
  const response = await responsePromise;
  const body = await responseBody(response);
  const destination = destinationOf(response.request(), expectedDestination);
  expect(destination.operation).toBe(mass.operation);
  expect(destination.fileName).toBe(file.name);
  return {
    response,
    destination,
    body,
    accepted: responseAccepted(response, body),
  };
}

async function expectPersistedContent(
  documents: ProposalDocumentsPage,
  slot: number,
  file: GeneratedDocumentFile,
): Promise<string> {
  const persistedName = await uploadedFileName(documents, slot);
  expect(allowedPersistedNames(file)).toContain(persistedName);
  await documents.expectUploadedDocumentAt(slot, persistedName);
  const response = await documents.readUploadedDocumentAt(slot);
  expect(response.ok()).toBe(true);
  expect(digest(await response.body())).toBe(digest(file.buffer));
  return persistedName;
}

async function recordRealUpload(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  ledger: BatchLedger,
  mass: DocumentMass,
  slot: number,
  file: GeneratedDocumentFile,
  scenario: string,
): Promise<UploadResult> {
  ledger.operations[mass.key].state = "IN_PROGRESS";
  ledger.operations[mass.key].slots[slot].state = "IN_PROGRESS";
  const expectedDestination = await expectedDestinationForSlot(
    page,
    portalConfig,
    mass,
    slot,
    file.name,
  );
  const documents = await openDocuments(
    page,
    portalConfig,
    portalSession,
    mass,
  );
  await expectEmptyRow(documents.getDocumentRowAt(slot));
  const result = await performRealUpload(
    page,
    documents,
    mass,
    slot,
    file,
    expectedDestination,
  );
  ledger.backendObservations.push({
    scenario,
    mass: mass.key,
    slot,
    ...result.destination,
    status: result.response.status(),
    accepted: result.accepted,
    responseBody: printableBody(result.body),
  });

  if (result.accepted) {
    const persistedName = await expectPersistedContent(documents, slot, file);
    markPersisted(ledger, mass, slot, file, result.destination, persistedName);
  } else {
    const reopened = await openDocuments(
      page,
      portalConfig,
      portalSession,
      mass,
    );
    await expectEmptyRow(reopened.getDocumentRowAt(slot));
    ledger.operations[mass.key].slots[slot].state = "READY";
    if (
      !ledger.operations[mass.key].slots.some(
        (entry) => entry.state === "CONSUMED",
      )
    ) {
      ledger.operations[mass.key].state = "RESERVED";
    }
  }
  return result;
}

async function verifyKnownDocuments(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  ledger: BatchLedger,
  mass: DocumentMass,
  otherMass: DocumentMass,
): Promise<void> {
  const documents = await openDocuments(
    page,
    portalConfig,
    portalSession,
    mass,
  );
  const known = ledger.operations[mass.key].slots
    .map((slot) => slot.persisted)
    .filter((value): value is PersistedDocument => Boolean(value));
  for (const entry of known) {
    const file: GeneratedDocumentFile = {
      name: entry.name,
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(0),
    };
    await documents.expectUploadedDocumentAt(entry.slot, entry.name);
    const response = await documents.readUploadedDocumentAt(entry.slot);
    expect(response.ok()).toBe(true);
    expect(digest(await response.body())).toBe(entry.digest);
    expect(file.name).toBe(entry.name);
  }

  const forbiddenNames = ledger.operations[otherMass.key].slots
    .map((slot) => slot.persisted?.name)
    .filter((value): value is string => Boolean(value));
  for (const forbiddenName of forbiddenNames) {
    await expect(page.getByText(forbiddenName, { exact: true })).toHaveCount(0);
  }
}

test.use({ skipPortalSessionBootstrap: true });

test.describe.serial("Portal Core: batch documental consumível", () => {
  test.beforeEach(() => {
    const capability = evaluateCoreCapabilities([
      "consumable-document-pair",
    ]);
    test.skip(!capability.enabled, capability.reason);
  });

  test(
    "CORE consumível | preflight read-only de DOC A/B @consumable",
    { tag: ["@core", "@readonly", "@consumable"] },
    async ({ page, portalConfig, portalSession }) => {
      const masses = getMasses(portalConfig);
      if (isResumeFromAcceptedB0()) {
        await preflightResumeCheckpoint(
          page,
          portalConfig,
          portalSession,
          masses,
        );
      } else {
        await preflightMass(page, portalConfig, portalSession, masses.A);
        await preflightMass(page, portalConfig, portalSession, masses.B);
      }
    },
  );

  test(
    "CORE consumível | executa D1-D5 com ledger de consumo @consumable",
    { tag: ["@core", "@mutation", "@consumable"] },
    async ({ page, portalConfig, portalSession }, testInfo) => {
      test.setTimeout(20 * 60_000);
      const masses = getMasses(portalConfig);
      const ledger = createLedger(masses);
      ledger.operations.A.state = "RESERVED";
      ledger.operations.B.state = "RESERVED";

      try {
        await test.step("proteção pré-consumo", async () => {
          if (isResumeFromAcceptedB0()) {
            await verifyResumeStructureWithoutDownloading(
              page,
              portalConfig,
              portalSession,
              masses,
            );
            await initializeResumeCheckpoint(
              page,
              portalConfig,
              ledger,
              masses.B,
            );
            await initializeFullBAfterD1AbortCheckpoint(
              page,
              portalConfig,
              ledger,
              masses,
            );
          } else {
            await preflightMass(page, portalConfig, portalSession, masses.A);
            await preflightMass(page, portalConfig, portalSession, masses.B);
          }
        });

        await test.step("D2 | consulta o backend real para cinco incompatibilidades", async () => {
          ledger.operations.B.state = "IN_PROGRESS";
          const pngAsPdf = createPngContentNamedAsPdf();
          const first = isResumeFromAcceptedB0()
            ? { accepted: true }
            : await recordRealUpload(
                page,
                portalConfig,
                portalSession,
                ledger,
                masses.B,
                0,
                pngAsPdf,
                "D2-png-as-pdf",
              );
          const jpgAsPdf = withDocumentIdentity(
            createValidJpegFile("CORE-JPG-RENAMED"),
            "core-jpg-renamed.pdf",
            "image/jpeg",
          );
          const secondSlot = first.accepted ? 4 : 0;
          if (!isResumeFromAcceptedB4()) {
            await recordRealUpload(
              page,
              portalConfig,
              portalSession,
              ledger,
              masses.B,
              secondSlot,
              jpgAsPdf,
              "D2-jpg-as-pdf",
            );
          }
          if (!isResumeFromAcceptedB1B2()) {
            await recordRealUpload(
              page,
              portalConfig,
              portalSession,
              ledger,
              masses.B,
              1,
              withDocumentIdentity(
                createValidPngFile(),
                "core-mime-mismatch.pdf",
                "image/png",
              ),
              "D2-mime-mismatch",
            );
            await recordRealUpload(
              page,
              portalConfig,
              portalSession,
              ledger,
              masses.B,
              2,
              withDocumentIdentity(
                createValidPdfFile("CORE-PDF-RENAMED"),
                "core-pdf-renamed.jpg",
                "image/jpeg",
              ),
              "D2-pdf-as-jpg",
            );
          }
          if (!isResumeFromFullBAfterD1Abort()) {
            await recordRealUpload(
              page,
              portalConfig,
              portalSession,
              ledger,
              masses.B,
              3,
              createCorruptedPdfFile(),
              "D2-corrupted-pdf",
            );
          }
          ledger.scenarioResults.D2 = "PASSED";
        });

        await test.step("D3 | HTTP 500 exato mantém A2 vazio e desbloqueado", async () => {
          const documents = await openDocuments(
            page,
            portalConfig,
            portalSession,
            masses.A,
          );
          const file = createValidPdfFile("CORE-RETRY", "core-retry.pdf");
          const expectedDestination = await expectedDestinationForSlot(
            page,
            portalConfig,
            masses.A,
            2,
            file.name,
          );
          let routedRequest: Request | undefined;
          await page.route(uploadRoutePattern, async (route) => {
            if (!isUploadRequest(route.request(), masses.A.operation)) {
              await route.fallback();
              return;
            }
            routedRequest = route.request();
            await route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({
                sucesso: false,
                mensagem: "Falha controlada CORE consumivel.",
              }),
            });
          });
          try {
            const responsePromise = page.waitForResponse((response) =>
              isUploadRequest(response.request(), masses.A.operation),
            );
            await documents.chooseFilePayloadAt(2, file);
            const response = await responsePromise;
            expect(response.status()).toBe(500);
            expect(routedRequest).toBeDefined();
            const destination = destinationOf(
              routedRequest as Request,
              expectedDestination,
            );
            ledger.backendObservations.push({
              scenario: "D3-controlled-500",
              mass: "A",
              slot: 2,
              ...destination,
              status: 500,
              accepted: false,
            });
            await expect(
              documents
                .getDocumentRowAt(2)
                .getByText(/Enviando|Carregando|Aguarde/i),
            ).toBeHidden();
            await expectEmptyRow(documents.getDocumentRowAt(2));
          } finally {
            await page.unroute(uploadRoutePattern);
          }
          const reopened = await openDocuments(
            page,
            portalConfig,
            portalSession,
            masses.A,
          );
          await expectEmptyRow(reopened.getDocumentRowAt(2));
        });

        await test.step("D1 | seleção pendente de A nunca alcança B", async () => {
          if (isResumeFromFullBAfterD1Abort()) {
            const documentsA = await openDocuments(
              page,
              portalConfig,
              portalSession,
              masses.A,
            );
            await expectEmptyRow(documentsA.getDocumentRowAt(4));
            await openDocuments(page, portalConfig, portalSession, masses.B);
            await expect(
              page.getByText("core-pending-a.pdf", { exact: true }),
            ).toHaveCount(0);
            ledger.scenarioResults.D1 = "PASSED";
            return;
          }
          const documentsA = await openDocuments(
            page,
            portalConfig,
            portalSession,
            masses.A,
          );
          const pendingFile = createValidPdfFile(
            "CORE-PENDING-A",
            "core-pending-a.pdf",
          );
          const expectedDestination = await expectedDestinationForSlot(
            page,
            portalConfig,
            masses.A,
            4,
            pendingFile.name,
          );
          const started = deferred();
          const release = deferred();
          const finished = deferred();
          let destination: UploadDestination | undefined;
          let requestsToB = 0;
          await page.route(uploadRoutePattern, async (route: Route) => {
            if (isUploadRequest(route.request(), masses.B.operation)) {
              requestsToB += 1;
              await route.abort("failed");
              return;
            }
            if (!isUploadRequest(route.request(), masses.A.operation)) {
              await route.fallback();
              return;
            }
            destination = destinationOf(route.request(), expectedDestination);
            started.resolve();
            await release.promise;
            try {
              await route.abort("failed");
            } finally {
              finished.resolve();
            }
          });
          try {
            await documentsA.chooseFilePayloadAt(4, pendingFile);
            await started.promise;
            const documentsB = await openDocuments(
              page,
              portalConfig,
              portalSession,
              masses.B,
            );
            expect(requestsToB).toBe(0);
            await expect(
              page.getByText("core-pending-a.pdf", { exact: true }),
            ).toHaveCount(0);
            await expectEmptyRow(documentsB.getDocumentRowAt(4));
            release.resolve();
            await finished.promise;
          } finally {
            release.resolve();
            await page.unroute(uploadRoutePattern);
          }
          expect(destination?.operation).toBe(masses.A.operation);
          ledger.backendObservations.push({
            scenario: "D1-pending-destination",
            mass: "A",
            slot: 4,
            ...(destination as UploadDestination),
            status: "ABORTED",
            accepted: false,
          });
          const reopenedA = await openDocuments(
            page,
            portalConfig,
            portalSession,
            masses.A,
          );
          await expectEmptyRow(reopenedA.getDocumentRowAt(4));
          const reopenedB = await openDocuments(
            page,
            portalConfig,
            portalSession,
            masses.B,
          );
          await expect(
            page.getByText("core-pending-a.pdf", { exact: true }),
          ).toHaveCount(0);
          expect(await reopenedB.getDocumentCount()).toBe(5);
          ledger.scenarioResults.D1 = "PASSED";
        });

        await test.step("D4 | abort antes do backend não cria documento fantasma", async () => {
          const documents = await openDocuments(
            page,
            portalConfig,
            portalSession,
            masses.A,
          );
          const abortedFile = createValidPdfFile(
            "CORE-REFRESH-ABORT",
            "core-refresh.pdf",
          );
          const expectedDestination = await expectedDestinationForSlot(
            page,
            portalConfig,
            masses.A,
            3,
            abortedFile.name,
          );
          const started = deferred();
          const release = deferred();
          const finished = deferred();
          let destination: UploadDestination | undefined;
          await page.route(uploadRoutePattern, async (route) => {
            if (!isUploadRequest(route.request(), masses.A.operation)) {
              await route.fallback();
              return;
            }
            destination = destinationOf(route.request(), expectedDestination);
            started.resolve();
            await release.promise;
            try {
              await route.abort("failed");
            } finally {
              finished.resolve();
            }
          });
          try {
            await documents.chooseFilePayloadAt(3, abortedFile);
            await started.promise;
            const reload = page.reload({ waitUntil: "domcontentloaded" });
            release.resolve();
            await Promise.all([reload, finished.promise]);
          } finally {
            release.resolve();
            await page.unroute(uploadRoutePattern);
          }
          ledger.backendObservations.push({
            scenario: "D4-abort-before-backend",
            mass: "A",
            slot: 3,
            ...(destination as UploadDestination),
            status: "ABORTED",
            accepted: false,
          });
          const reopened = await openDocuments(
            page,
            portalConfig,
            portalSession,
            masses.A,
          );
          await expectEmptyRow(reopened.getDocumentRowAt(3));
        });

        await test.step("D3 | retry, formatos aceitos, colisão e fila serial", async () => {
          const documents = await openDocuments(
            page,
            portalConfig,
            portalSession,
            masses.A,
          );
          const png = createValidPngFile("core-allowed.png");
          const retryPdf = createValidPdfFile("CORE-RETRY", "core-retry.pdf");
          const expectedDestinations = [
            await expectedDestinationForSlot(
              page,
              portalConfig,
              masses.A,
              1,
              png.name,
            ),
            await expectedDestinationForSlot(
              page,
              portalConfig,
              masses.A,
              2,
              retryPdf.name,
            ),
          ];
          const firstStarted = deferred();
          const releaseFirst = deferred();
          const destinations: UploadDestination[] = [];
          const responses: Response[] = [];
          const responseListener = (response: Response): void => {
            if (isUploadRequest(response.request(), masses.A.operation))
              responses.push(response);
          };
          page.on("response", responseListener);
          await page.route(uploadRoutePattern, async (route) => {
            if (!isUploadRequest(route.request(), masses.A.operation)) {
              await route.fallback();
              return;
            }
            const expected = expectedDestinations[destinations.length];
            if (!expected)
              throw new Error("Upload adicional inesperado na fila serial.");
            destinations.push(destinationOf(route.request(), expected));
            if (destinations.length === 1) {
              firstStarted.resolve();
              await releaseFirst.promise;
            }
            await route.fallback();
          });
          try {
            await documents.chooseFilePayloadAt(1, png);
            await firstStarted.promise;
            await documents.chooseFilePayloadAt(2, retryPdf);
            expect(destinations).toHaveLength(1);
            releaseFirst.resolve();
            await expect
              .poll(() => responses.length, { timeout: 60_000 })
              .toBe(2);
            await expect.poll(() => destinations.length).toBe(2);
          } finally {
            releaseFirst.resolve();
            page.off("response", responseListener);
            await page.unroute(uploadRoutePattern);
          }
          for (const [index, entry] of [
            { slot: 1, file: png },
            { slot: 2, file: retryPdf },
          ].entries()) {
            const body = await responseBody(responses[index]);
            expect(responseAccepted(responses[index], body)).toBe(true);
            expect(destinations[index].operation).toBe(masses.A.operation);
            const persistedName = await expectPersistedContent(
              documents,
              entry.slot,
              entry.file,
            );
            markPersisted(
              ledger,
              masses.A,
              entry.slot,
              entry.file,
              destinations[index],
              persistedName,
            );
            ledger.backendObservations.push({
              scenario: "D3-concurrent-queue",
              mass: "A",
              slot: entry.slot,
              ...destinations[index],
              status: responses[index].status(),
              accepted: true,
              responseBody: printableBody(body),
            });
          }
          expect(destinations[0].documentId).not.toBe(
            destinations[1].documentId,
          );

          const jpegV1 = createValidJpegFile(
            "CORE-JPEG-V1",
            "core-collision.jpg",
          );
          const firstJpeg = await recordRealUpload(
            page,
            portalConfig,
            portalSession,
            ledger,
            masses.A,
            0,
            jpegV1,
            "D3-jpeg-v1",
          );
          expect(firstJpeg.accepted).toBe(true);
          ledger.scenarioResults.D3 = "PASSED";
        });

        await test.step("D4 | backend aceito antes do refresh persiste exatamente uma vez", async () => {
          const documents = await openDocuments(
            page,
            portalConfig,
            portalSession,
            masses.A,
          );
          const file = createValidPdfFile(
            "CORE-REFRESH-PERSISTED",
            "core-refresh.pdf",
          );
          const expectedDestination = await expectedDestinationForSlot(
            page,
            portalConfig,
            masses.A,
            3,
            file.name,
          );
          const backendAccepted = deferred();
          const releaseResponse = deferred();
          let destination: UploadDestination | undefined;
          let status = 0;
          let body = "";
          await page.route(uploadRoutePattern, async (route) => {
            if (!isUploadRequest(route.request(), masses.A.operation)) {
              await route.fallback();
              return;
            }
            destination = destinationOf(route.request(), expectedDestination);
            const backendResponse = await route.fetch();
            status = backendResponse.status();
            body = await backendResponse.text();
            backendAccepted.resolve();
            await releaseResponse.promise;
            await route.fulfill({
              status,
              headers: backendResponse.headers(),
              body,
            });
          });
          try {
            await documents.chooseFilePayloadAt(3, file);
            await backendAccepted.promise;
            expect(status).toBeGreaterThanOrEqual(200);
            expect(status).toBeLessThan(300);
            const reload = page.reload({ waitUntil: "domcontentloaded" });
            releaseResponse.resolve();
            await reload;
          } finally {
            releaseResponse.resolve();
            await page.unroute(uploadRoutePattern);
          }
          const reopened = await openDocuments(
            page,
            portalConfig,
            portalSession,
            masses.A,
          );
          const persistedName = await expectPersistedContent(reopened, 3, file);
          markPersisted(
            ledger,
            masses.A,
            3,
            file,
            destination as UploadDestination,
            persistedName,
          );
          ledger.backendObservations.push({
            scenario: "D4-accepted-before-refresh",
            mass: "A",
            slot: 3,
            ...(destination as UploadDestination),
            status,
            accepted: true,
            responseBody: body.slice(0, 2_000),
          });
          ledger.scenarioResults.D4 = "PASSED";
        });

        await test.step("D3 | reenvio e substituição preservam um slot lógico", async () => {
          const jpegV1 = createValidJpegFile(
            "CORE-JPEG-V1",
            "core-collision.jpg",
          );
          const jpegV2 = createValidJpegFile(
            "CORE-JPEG-V2",
            "core-collision.jpg",
          );
          const before = ledger.operations.A.slots[0].persisted;
          expect(before).toBeDefined();

          for (const [scenario, file] of [
            ["D3-resend-same-content", jpegV1],
            ["D3-replace-same-name", jpegV2],
          ] as const) {
            const documents = await openDocuments(
              page,
              portalConfig,
              portalSession,
              masses.A,
            );
            await documents.expectUploadedDocumentAt(0, "core-collision.jpg");
            const responsePromise = page.waitForResponse((response) =>
              isUploadRequest(response.request(), masses.A.operation),
            );
            await documents.chooseFilePayloadAt(0, file);
            const response = await responsePromise;
            const resultBody = await responseBody(response);
            expect(responseAccepted(response, resultBody)).toBe(true);
            const destination = destinationOf(response.request(), {
              operation: masses.A.operation,
              documentId: before?.documentId ?? "",
              personId: before?.personId ?? "",
              fileName: file.name,
            });
            expect(destination.documentId).toBe(before?.documentId);
            const persistedName = await expectPersistedContent(
              documents,
              0,
              file,
            );
            markPersisted(
              ledger,
              masses.A,
              0,
              file,
              destination,
              persistedName,
            );
            ledger.backendObservations.push({
              scenario,
              mass: "A",
              slot: 0,
              ...destination,
              status: response.status(),
              accepted: true,
              responseBody: printableBody(resultBody),
            });
          }
          expect(ledger.operations.A.slots[0].persisted?.digest).toBe(
            digest(jpegV2.buffer),
          );
        });

        await test.step("D5 | isolamento A/B persiste após refresh e nova sessão", async () => {
          const b4 = ledger.operations.B.slots[4].persisted;
          if (!b4) {
            const file = createValidPdfFile(
              "CORE-B-ISOLATION",
              "core-b-isolation.pdf",
            );
            const upload = await recordRealUpload(
              page,
              portalConfig,
              portalSession,
              ledger,
              masses.B,
              4,
              file,
              "D5-b-persisted",
            );
            expect(upload.accepted).toBe(true);
          }

          await verifyKnownDocuments(
            page,
            portalConfig,
            portalSession,
            ledger,
            masses.A,
            masses.B,
          );
          await verifyKnownDocuments(
            page,
            portalConfig,
            portalSession,
            ledger,
            masses.B,
            masses.A,
          );

          await page.context().clearCookies({ name: "__Host-session" });
          await portalSession.renewCurrent();
          await verifyKnownDocuments(
            page,
            portalConfig,
            portalSession,
            ledger,
            masses.A,
            masses.B,
          );
          await verifyKnownDocuments(
            page,
            portalConfig,
            portalSession,
            ledger,
            masses.B,
            masses.A,
          );

          ledger.operations.A.state = "CONSUMED";
          ledger.operations.B.state = "CONSUMED";
          ledger.scenarioResults.D5 = "PASSED";
        });
      } catch (error) {
        for (const mass of [ledger.operations.A, ledger.operations.B]) {
          if (
            mass.state === "IN_PROGRESS" ||
            mass.state === "PARTIALLY_CONSUMED"
          ) {
            mass.state = "QUARANTINED";
          }
        }
        for (const [scenario, state] of Object.entries(
          ledger.scenarioResults,
        )) {
          if (state === "PENDING") {
            ledger.scenarioResults[scenario] = "FAILED";
            break;
          }
        }
        throw error;
      } finally {
        await attachLedger(testInfo, ledger);
      }
    },
  );
});
