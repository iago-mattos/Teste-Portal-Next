import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  request as apiRequest,
  expect,
  test as setup,
  type Page,
} from "@playwright/test";
import {
  loadPortalAuthConfig,
  portalAuthFingerprint,
  PORTAL_AUTH_METADATA_PATH,
  PORTAL_AUTH_STATE_PATH,
  type PortalAdminAuthConfig,
  type PortalAuthConfig,
} from "../config/auth-config";

interface AuthMetadata {
  fingerprint: string;
}

setup.setTimeout(120_000);

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

async function validateStoredSession(
  config: PortalAuthConfig,
): Promise<boolean> {
  if (!existsSync(PORTAL_AUTH_STATE_PATH)) return false;

  const metadata = await readAuthMetadata();
  if (metadata?.fingerprint !== portalAuthFingerprint(config)) return false;

  const requestContext = await apiRequest.newContext({
    baseURL: config.portalUrl,
    storageState: PORTAL_AUTH_STATE_PATH,
  });

  try {
    const response = await requestContext.get("/api/auth/me", {
      failOnStatusCode: false,
    });
    if (!response.ok()) return false;

    const body = (await response.json()) as { autenticado?: unknown };
    return body.autenticado === true;
  } catch {
    return false;
  } finally {
    await requestContext.dispose();
  }
}

async function generateAccessUrl(
  page: Page,
  admin: PortalAdminAuthConfig,
  portalUrl: string,
): Promise<string> {
  let stage = "abrir login do Admin";

  try {
    await page.goto(`${admin.url}/login`);

    if (new URL(page.url()).pathname === "/admin/login") {
      stage = "autenticar no Admin";
      await page.getByLabel("Usuário", { exact: true }).fill(admin.username);
      await page.getByLabel("Senha", { exact: true }).fill(admin.password);
      await Promise.all([
        page.waitForURL((url) => url.pathname === "/admin"),
        page.getByRole("button", { name: "Entrar", exact: true }).click(),
      ]);
    }

    stage = "abrir gerador de acesso";
    await page.goto(`${admin.url}/pascal`);
    await expect(
      page.getByRole("heading", { name: "Backend", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Gerar link de acesso", level: 4 }),
    ).toBeVisible();

    stage = "preencher CPF do acesso";
    const cpfInput = page.getByLabel("CPF/CNPJ para o link", { exact: true });
    await cpfInput.fill("");
    await cpfInput.pressSequentially(admin.cpf);
    await cpfInput.blur();
    stage = "gerar magic link";
    const generateButton = page.getByRole("button", {
      name: "Gerar link",
      exact: true,
    });
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    stage = "aguardar conclusao da geracao";
    await expect(
      page.getByRole("button", { name: "Copiar link", exact: true }),
    ).toBeVisible({ timeout: 60_000 });

    stage = "localizar magic link gerado na interface";
    const accessField = page.getByLabel("Link de acesso", { exact: true });
    await expect(accessField).toBeVisible();
    const accessUrl = await accessField.inputValue();

    stage = "validar magic link gerado";
    return validateAccessUrl(accessUrl, portalUrl);
  } catch {
    throw new Error(
      `Nao foi possivel gerar um novo acesso pelo Admin configurado na etapa: ${stage}.`,
    );
  }
}

async function consumeAccessUrl(
  page: Page,
  accessUrl: string,
  config: PortalAuthConfig,
): Promise<void> {
  const validatedAccessUrl = validateAccessUrl(accessUrl, config.portalUrl);

  try {
    await page.goto(validatedAccessUrl, { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => {
      return (
        url.origin === new URL(config.portalUrl).origin &&
        url.pathname === config.proposalsPath
      );
    });
    await expect(
      page.getByRole("heading", { name: "Minhas propostas", level: 1 }),
    ).toBeVisible();

    const cookies = await page.context().cookies(config.portalUrl);
    if (!cookies.some((cookie) => cookie.name === "__Host-session")) {
      throw new Error("session cookie missing");
    }
  } catch {
    throw new Error(
      "O magic link nao estabeleceu uma sessao valida no Portal.",
    );
  }
}

async function clearAuthState(): Promise<void> {
  await Promise.all([
    rm(PORTAL_AUTH_STATE_PATH, { force: true }),
    rm(PORTAL_AUTH_METADATA_PATH, { force: true }),
  ]);
}

setup("authenticate Portal session", async ({ browser }) => {
  const config = loadPortalAuthConfig();
  if (await validateStoredSession(config)) return;

  await clearAuthState();
  await mkdir(dirname(PORTAL_AUTH_STATE_PATH), { recursive: true });

  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();

  try {
    const accessUrl = config.admin
      ? await generateAccessUrl(page, config.admin, config.portalUrl)
      : config.accessUrl;

    if (!accessUrl) {
      throw new Error(
        "Configure o Admin completo ou PORTAL_ACCESS_URL para autenticar no Portal.",
      );
    }

    await consumeAccessUrl(page, accessUrl, config);
    await context.storageState({ path: PORTAL_AUTH_STATE_PATH });
    await chmod(PORTAL_AUTH_STATE_PATH, 0o600);
    await writeFile(
      PORTAL_AUTH_METADATA_PATH,
      JSON.stringify({ fingerprint: portalAuthFingerprint(config) }),
      { mode: 0o600 },
    );
  } catch (error) {
    await clearAuthState();
    throw error;
  } finally {
    await context.close();
  }

  if (!(await validateStoredSession(config))) {
    await clearAuthState();
    throw new Error(
      "O estado autenticado foi criado, mas a validacao em /api/auth/me falhou.",
    );
  }
});
