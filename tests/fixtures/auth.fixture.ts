import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { BrowserContext } from "@playwright/test";
import {
  loadPortalAuthConfig,
  portalAuthFingerprint,
  PORTAL_AUTH_METADATA_PATH,
  PORTAL_AUTH_STATE_PATH,
  type PortalAuthConfig,
} from "../config/auth-config";
import type { PortalRuntimeConfig } from "../config/runtime-config";
import { AdminAccessPage } from "../pages/portal/admin-access.page";
import { configTest } from "./config.fixture";

interface AuthMetadata {
  fingerprint: string;
}

export interface AuthFixtures {
  authenticatedContext: BrowserContext;
}

export const portalSessionExpiredPattern =
  /Sua sess[aã]o expirou\. Fa[cç]a login novamente\./i;

function validateAccessUrl(accessUrl: string, portalUrl: string): string {
  try {
    const parsed = new URL(accessUrl);
    if (parsed.origin !== new URL(portalUrl).origin || !parsed.search) {
      throw new Error("invalid access URL");
    }
    return parsed.toString();
  } catch {
    throw new Error(
      "O acesso gerado precisa apontar para o Portal configurado e conter um token.",
    );
  }
}

async function readAuthMetadata(): Promise<AuthMetadata | undefined> {
  try {
    const metadata = JSON.parse(
      await readFile(PORTAL_AUTH_METADATA_PATH, "utf8"),
    ) as Partial<AuthMetadata>;
    return typeof metadata.fingerprint === "string"
      ? { fingerprint: metadata.fingerprint }
      : undefined;
  } catch {
    return undefined;
  }
}

async function hasValidPortalSession(
  context: BrowserContext,
  runtime: PortalRuntimeConfig,
  auth: PortalAuthConfig,
): Promise<boolean> {
  if (!existsSync(PORTAL_AUTH_STATE_PATH)) return false;

  const metadata = await readAuthMetadata();
  if (metadata?.fingerprint !== portalAuthFingerprint(auth)) return false;

  try {
    const response = await context.request.get(runtime.paths.authMe, {
      failOnStatusCode: false,
    });
    if (!response.ok()) return false;

    const body = (await response.json()) as { autenticado?: unknown };
    return body.autenticado === true;
  } catch {
    return false;
  }
}

async function persistPortalSession(
  context: BrowserContext,
  auth: PortalAuthConfig,
): Promise<void> {
  await mkdir(dirname(PORTAL_AUTH_STATE_PATH), { recursive: true });
  await context.storageState({ path: PORTAL_AUTH_STATE_PATH });
  await chmod(PORTAL_AUTH_STATE_PATH, 0o600);
  await writeFile(
    PORTAL_AUTH_METADATA_PATH,
    JSON.stringify({ fingerprint: portalAuthFingerprint(auth) }),
    { mode: 0o600 },
  );
}

export async function clearPortalAuthState(): Promise<void> {
  await Promise.all([
    rm(PORTAL_AUTH_STATE_PATH, { force: true }),
    rm(PORTAL_AUTH_METADATA_PATH, { force: true }),
  ]);
}

export async function renewPortalSession(
  context: BrowserContext,
  runtime: PortalRuntimeConfig,
): Promise<void> {
  const auth = loadPortalAuthConfig();
  const page = await context.newPage();
  let stage = "obter acesso do Portal";

  try {
    let accessUrl = auth.accessUrl;

    if (auth.admin) {
      const adminAccessPage = new AdminAccessPage(page, auth.admin.url);

      stage = "abrir login do Admin";
      await adminAccessPage.openLogin();

      if (adminAccessPage.isLoginRequired()) {
        stage = "autenticar no Admin";
        await adminAccessPage.signIn(
          auth.admin.username,
          auth.admin.password,
        );
      }

      stage = "abrir gerador de acesso";
      await adminAccessPage.openAccessGenerator();

      stage = "gerar magic link";
      accessUrl = await adminAccessPage.generateAccessUrl(auth.admin.cpf);
    }

    if (!accessUrl) {
      throw new Error(
        "Configure o Admin completo ou PORTAL_ACCESS_URL para autenticar no Portal.",
      );
    }

    stage = "consumir magic link";
    await page.goto(validateAccessUrl(accessUrl, auth.portalUrl), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForURL((url) => {
      return (
        url.origin === new URL(auth.portalUrl).origin &&
        url.pathname === auth.proposalsPath
      );
    });
    await page
      .getByRole("heading", { name: "Minhas propostas", level: 1 })
      .waitFor({ state: "visible" });

    const cookies = await context.cookies(auth.portalUrl);
    if (!cookies.some((cookie) => cookie.name === "__Host-session")) {
      throw new Error("session cookie missing");
    }

    stage = "persistir sessao renovada";
    await persistPortalSession(context, auth);

    if (!(await hasValidPortalSession(context, runtime, auth))) {
      throw new Error("GET /api/auth/me rejeitou a sessao renovada");
    }
  } catch (error) {
    await clearPortalAuthState();
    throw new Error(
      `Nao foi possivel renovar a sessao do Portal na etapa: ${stage}.`,
      { cause: error },
    );
  } finally {
    await page.close();
  }
}

export async function ensurePortalSession(
  context: BrowserContext,
  runtime: PortalRuntimeConfig,
): Promise<void> {
  const auth = loadPortalAuthConfig();
  if (await hasValidPortalSession(context, runtime, auth)) return;

  await renewPortalSession(context, runtime);
}

export const authTest = configTest.extend<AuthFixtures>({
  authenticatedContext: async ({ context, portalConfig }, use) => {
    await ensurePortalSession(context, portalConfig);
    await use(context);
  },
});
