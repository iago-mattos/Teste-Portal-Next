import type { Page, Request, Response } from "@playwright/test";
import {
  loadCoreMassProvisioningConfig,
  type CoreMassDefinition,
} from "../../config/core-mass-config";
import type { PortalRuntimeConfig } from "../../config/runtime-config";
import { expect, test } from "../../fixtures/test";
import { evaluateCoreCapabilities } from "../../config/core-capabilities";
import type { PortalSession } from "../../fixtures/portal.fixture";
import { ProposalPage } from "../../pages/portal/proposal.page";

const coreReadonly = { tag: ["@core", "@readonly"] };
const coreMutation = { tag: ["@core", "@mutation"] };
const purposeFieldName = "OPERACAO_CREDITO.TE_OBS_MOTIVO_EMPRESTIMO";
const markerA = "CORE CAD A - MARCADOR TEMPORARIO";
const markerB = "CORE CAD B - MARCADOR TEMPORARIO";

interface CadastroMass extends CoreMassDefinition {
  readonly expectedApplicantName: string;
}

interface CadastroMasses {
  readonly a: CadastroMass;
  readonly b: CadastroMass;
}

interface CadastroSnapshot {
  readonly operationNumber: string;
  readonly purposeDescription: string;
}

interface CadastroSnapshots {
  readonly a: CadastroSnapshot;
  readonly b: CadastroSnapshot;
}

interface SaveObservation {
  readonly response: Response;
  readonly relevantFields: Readonly<Record<string, unknown>>;
}

interface RestorableActionContext {
  readonly snapshots: CadastroSnapshots;
  persist(mass: CadastroMass, value: string): Promise<SaveObservation>;
}

function proposalUrl(
  portalConfig: PortalRuntimeConfig,
  operationNumber: string,
): string {
  return new URL(
    `/propostas/${operationNumber}`,
    portalConfig.portalUrl,
  ).toString();
}

function proposalApiPath(operationNumber: string): string {
  return `/api/portal/propostas/${operationNumber}`;
}

function cadastroApiPath(operationNumber: string): string {
  return `${proposalApiPath(operationNumber)}/cadastro`;
}

function isExactRequest(
  request: Request,
  method: "GET" | "PUT",
  pathname: string,
): boolean {
  return request.method() === method
    && new URL(request.url()).pathname === pathname;
}

function requestFields(request: Request): Record<string, unknown> | undefined {
  try {
    const payload = request.postDataJSON() as {
      campos?: unknown;
    } | null;
    return payload?.campos
      && typeof payload.campos === "object"
      && !Array.isArray(payload.campos)
      ? payload.campos as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function getCadastroMasses(portalConfig: PortalRuntimeConfig): CadastroMasses {
  const { cadastroA, cadastroB } = loadCoreMassProvisioningConfig(portalConfig);
  if (!cadastroA.expectedApplicantName || !cadastroB.expectedApplicantName) {
    throw new Error("Configure os nomes esperados das massas CAD A e CAD B.");
  }

  return {
    a: cadastroA as CadastroMass,
    b: cadastroB as CadastroMass,
  };
}

async function expectProposalIdentity(
  page: Page,
  proposalPage: ProposalPage,
  mass: CadastroMass,
): Promise<void> {
  await expect(proposalPage.heading).toHaveText(
    `Proposta #${mass.operationNumber}`,
  );
  await expect(
    page.getByRole("heading", { name: "Cadastro da Proposta", level: 2 }),
  ).toBeVisible();

  const proponentText = (await proposalPage.proponentInfo.textContent()) ?? "";
  const applicantName = /Proponente:\s*(.*?)\s*CPF:/i
    .exec(proponentText)?.[1]
    ?.trim();
  expect(applicantName).toBe(mass.expectedApplicantName);
}

async function openDirectly(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  mass: CadastroMass,
): Promise<{ proposalPage: ProposalPage; response: Response }> {
  await portalSession.useOperation(mass.operationNumber);
  const responsePromise = page.waitForResponse((response) =>
    isExactRequest(
      response.request(),
      "GET",
      proposalApiPath(mass.operationNumber),
    ),
  );
  await page.goto(proposalUrl(portalConfig, mass.operationNumber), {
    waitUntil: "domcontentloaded",
  });
  const response = await responsePromise;
  expect(response.status()).toBe(200);

  const proposalPage = new ProposalPage(page);
  await proposalPage.waitUntilReady();
  await expectProposalIdentity(page, proposalPage, mass);
  return { proposalPage, response };
}

async function readSnapshot(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  mass: CadastroMass,
): Promise<CadastroSnapshot> {
  const { proposalPage } = await openDirectly(
    page,
    portalConfig,
    portalSession,
    mass,
  );
  await proposalPage.tabs.select("Motivo da Contratação");
  await page.waitForLoadState("networkidle");
  return {
    operationNumber: mass.operationNumber,
    purposeDescription: await proposalPage
      .getVisibleFieldByName(purposeFieldName)
      .inputValue(),
  };
}

async function savePurposeDescription(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  mass: CadastroMass,
  value: string,
): Promise<SaveObservation> {
  const { proposalPage } = await openDirectly(
    page,
    portalConfig,
    portalSession,
    mass,
  );
  await proposalPage.tabs.select("Motivo da Contratação");
  await page.waitForLoadState("networkidle");

  const field = proposalPage.getVisibleFieldByName(purposeFieldName);
  await expect(field).toBeVisible();
  await field.fill(value);
  await field.blur();

  const responsePromise = page.waitForResponse((response) => {
    if (!isExactRequest(
      response.request(),
      "PUT",
      cadastroApiPath(mass.operationNumber),
    )) {
      return false;
    }
    return requestFields(response.request())?.[purposeFieldName] === value;
  });
  await proposalPage.tabs.select("Imóvel");
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await page.waitForLoadState("networkidle");

  const fields = requestFields(response.request());
  if (!fields) {
    throw new Error(
      `PUT de ${mass.operationNumber} nao apresentou campos serializados.`,
    );
  }
  return {
    response,
    relevantFields: Object.freeze({
      [purposeFieldName]: fields[purposeFieldName],
    }),
  };
}

async function expectSnapshot(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  mass: CadastroMass,
  snapshot: CadastroSnapshot,
): Promise<void> {
  const current = await readSnapshot(page, portalConfig, portalSession, mass);
  expect(current).toEqual(snapshot);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function runWithMandatoryRestoration(
  page: Page,
  portalConfig: PortalRuntimeConfig,
  portalSession: PortalSession,
  masses: CadastroMasses,
  action: (context: RestorableActionContext) => Promise<void>,
): Promise<void> {
  const snapshots: CadastroSnapshots = {
    a: await readSnapshot(page, portalConfig, portalSession, masses.a),
    b: await readSnapshot(page, portalConfig, portalSession, masses.b),
  };
  const dirtyOperations = new Set<string>();
  let bodyError: Error | undefined;

  try {
    await action({
      snapshots,
      async persist(mass, value) {
        dirtyOperations.add(mass.operationNumber);
        return savePurposeDescription(
          page,
          portalConfig,
          portalSession,
          mass,
          value,
        );
      },
    });
  } catch (error) {
    bodyError = asError(error);
  }

  const restorationErrors: Error[] = [];
  for (const [mass, snapshot] of [
    [masses.b, snapshots.b],
    [masses.a, snapshots.a],
  ] as const) {
    if (!dirtyOperations.has(mass.operationNumber)) continue;
    try {
      await savePurposeDescription(
        page,
        portalConfig,
        portalSession,
        mass,
        snapshot.purposeDescription,
      );
    } catch (error) {
      restorationErrors.push(
        new Error(`Falha ao restaurar ${mass.purpose}.`, {
          cause: asError(error),
        }),
      );
    }
  }

  for (const [mass, snapshot] of [
    [masses.a, snapshots.a],
    [masses.b, snapshots.b],
  ] as const) {
    try {
      await expectSnapshot(
        page,
        portalConfig,
        portalSession,
        mass,
        snapshot,
      );
    } catch (error) {
      restorationErrors.push(
        new Error(`Nova leitura nao comprovou a restauracao de ${mass.purpose}.`, {
          cause: asError(error),
        }),
      );
    }
  }

  const failures = [
    ...(bodyError ? [bodyError] : []),
    ...restorationErrors,
  ];
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      "O cenario ou a restauracao obrigatoria das massas CAD A/B falhou.",
    );
  }
}

async function expectDomWithoutMarker(
  page: Page,
  forbiddenMarker: string,
): Promise<void> {
  const values = await page.locator("input, textarea, select").evaluateAll(
    (elements) => elements.map((element) =>
      (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)
        .value,
    ),
  );
  expect(values).not.toContain(forbiddenMarker);
}

test.use({ skipPortalSessionBootstrap: true });

test.describe("Portal Core: Cadastro A/B restaurável", () => {
  test.beforeEach(() => {
    const capability = evaluateCoreCapabilities([
      "restorable-registration-pair",
    ]);
    test.skip(!capability.enabled, capability.reason);
  });

  test(
    "CORE Cadastro | abre deep link autenticado e preserva a proposta no reload",
    coreReadonly,
    async ({ page, portalConfig, portalSession }) => {
      const { a } = getCadastroMasses(portalConfig);
      const firstOpen = await openDirectly(
        page,
        portalConfig,
        portalSession,
        a,
      );
      expect(new URL(firstOpen.response.url()).pathname).toBe(
        proposalApiPath(a.operationNumber),
      );

      const reloadResponsePromise = page.waitForResponse((response) =>
        isExactRequest(
          response.request(),
          "GET",
          proposalApiPath(a.operationNumber),
        ),
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      const reloadResponse = await reloadResponsePromise;
      expect(reloadResponse.status()).toBe(200);
      await firstOpen.proposalPage.waitUntilReady();
      await expectProposalIdentity(page, firstOpen.proposalPage, a);
      await expect(page).toHaveURL(proposalUrl(portalConfig, a.operationNumber));
    },
  );

  test(
    "CORE Cadastro | isola os payloads reais enviados por A e B",
    coreMutation,
    async ({ page, portalConfig, portalSession }) => {
      const masses = getCadastroMasses(portalConfig);
      await runWithMandatoryRestoration(
        page,
        portalConfig,
        portalSession,
        masses,
        async ({ persist }) => {
          const observationA = await persist(masses.a, markerA);
          const observationB = await persist(masses.b, markerB);

          expect(new URL(observationA.response.url()).pathname).toBe(
            cadastroApiPath(masses.a.operationNumber),
          );
          expect(new URL(observationB.response.url()).pathname).toBe(
            cadastroApiPath(masses.b.operationNumber),
          );
          expect(observationA.relevantFields).toEqual({
            [purposeFieldName]: markerA,
          });
          expect(observationB.relevantFields).toEqual({
            [purposeFieldName]: markerB,
          });
          expect(JSON.stringify(observationA.relevantFields)).not.toContain(
            markerB,
          );
          expect(JSON.stringify(observationB.relevantFields)).not.toContain(
            markerA,
          );
        },
      );
    },
  );

  test(
    "CORE Cadastro | mantém a seção ativa isolada entre duas propostas",
    coreReadonly,
    async ({ page, portalConfig, portalSession }) => {
      const masses = getCadastroMasses(portalConfig);
      const snapshotA = await readSnapshot(
        page,
        portalConfig,
        portalSession,
        masses.a,
      );
      const proposalPageA = new ProposalPage(page);
      await expect(
        proposalPageA.tabs.getTabButton("Motivo da Contratação"),
      ).toHaveAttribute("aria-selected", "true");

      const pageB = await page.context().newPage();
      try {
        const { proposalPage: proposalPageB } = await openDirectly(
          pageB,
          portalConfig,
          portalSession,
          masses.b,
        );
        await proposalPageB.tabs.select("Motivo da Contratação");
        const snapshotB: CadastroSnapshot = {
          operationNumber: masses.b.operationNumber,
          purposeDescription: await proposalPageB
            .getVisibleFieldByName(purposeFieldName)
            .inputValue(),
        };
        await proposalPageB.tabs.select("Imóvel");

        await page.bringToFront();
        await expect(
          proposalPageA.tabs.getTabButton("Motivo da Contratação"),
        ).toHaveAttribute("aria-selected", "true");
        await expect(
          proposalPageA.getVisibleFieldByName(purposeFieldName),
        ).toHaveValue(snapshotA.purposeDescription);
        await expectDomWithoutMarker(page, markerB);

        await pageB.bringToFront();
        await expect(
          proposalPageB.tabs.getTabButton("Imóvel"),
        ).toHaveAttribute("aria-selected", "true");
        await proposalPageB.tabs.select("Motivo da Contratação");
        await expect(
          proposalPageB.getVisibleFieldByName(purposeFieldName),
        ).toHaveValue(snapshotB.purposeDescription);
        await expectDomWithoutMarker(pageB, markerA);
      } finally {
        await pageB.close();
      }
    },
  );

  test(
    "CORE Cadastro | persiste marcadores exclusivos e restaura A/B",
    coreMutation,
    async ({ page, portalConfig, portalSession }) => {
      const masses = getCadastroMasses(portalConfig);
      await runWithMandatoryRestoration(
        page,
        portalConfig,
        portalSession,
        masses,
        async ({ persist }) => {
          await persist(masses.a, markerA);
          await persist(masses.b, markerB);

          for (const [mass, expected, forbidden] of [
            [masses.a, markerA, markerB],
            [masses.b, markerB, markerA],
            [masses.a, markerA, markerB],
            [masses.b, markerB, markerA],
          ] as const) {
            const current = await readSnapshot(
              page,
              portalConfig,
              portalSession,
              mass,
            );
            expect(current.purposeDescription).toBe(expected);
            await expectDomWithoutMarker(page, forbidden);
          }
        },
      );
    },
  );
});
