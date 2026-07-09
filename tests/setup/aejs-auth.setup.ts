import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test as setup, type Browser } from "@playwright/test";
import {
  loadAejsRuntimeConfig,
  aejsAuthFingerprint,
  AEJS_AUTH_METADATA_PATH,
  AEJS_AUTH_STATE_PATH,
  type AejsRuntimeConfig,
} from "../config/aejs-config";

interface AuthMetadata {
  fingerprint: string;
}

setup.setTimeout(120_000);

async function readAejsAuthMetadata(): Promise<AuthMetadata | undefined> {
  try {
    const metadata = JSON.parse(
      await readFile(AEJS_AUTH_METADATA_PATH, "utf8"),
    ) as Partial<AuthMetadata>;
    return typeof metadata.fingerprint === "string"
      ? { fingerprint: metadata.fingerprint }
      : undefined;
  } catch {
    return undefined;
  }
}

async function validateStoredSession(
  config: AejsRuntimeConfig,
  browser: Browser,
): Promise<boolean> {
  if (!existsSync(AEJS_AUTH_STATE_PATH)) return false;

  const metadata = await readAejsAuthMetadata();
  if (metadata?.fingerprint !== aejsAuthFingerprint(config)) return false;

  const context = await browser.newContext({
    storageState: AEJS_AUTH_STATE_PATH,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });

    // Se o botao de login "Acesso via Plataforma" estiver visivel, fomos redirecionados (sessao invalida)
    const acessoBtn = page.getByText("Acesso via Plataforma");
    try {
      await acessoBtn.waitFor({ state: "visible", timeout: 5000 });
      return false;
    } catch {
      // Se nao ficou visivel, valida que entramos na area autenticada (presenca de barra/botoes ExtJS)
      const mainIndicator = page.locator("a, button, .x-btn, .x-btn-inner").first();
      await mainIndicator.waitFor({ state: "visible", timeout: 10000 });
      return true;
    }
  } catch {
    return false;
  } finally {
    await context.close();
  }
}

async function clearAejsAuthState(): Promise<void> {
  await Promise.all([
    rm(AEJS_AUTH_STATE_PATH, { force: true }),
    rm(AEJS_AUTH_METADATA_PATH, { force: true }),
  ]);
}

setup("authenticate AEJS session", async ({ browser }) => {
  const config = loadAejsRuntimeConfig();

  // Se nao configurado, erro explicito.
  if (!config.baseUrl || !config.username || !config.password) {
    throw new Error(
      "Execucao bloqueada: configure AEJS_URL, AEJS_USERNAME e AEJS_PASSWORD nas variaveis de ambiente para executar os testes de integracao.",
    );
  }

  if (await validateStoredSession(config, browser)) {
    console.log("Sessao do AEJS ja esta autenticada e valida.");
    return;
  }

  console.log("Sessao expirada, invalida ou inexistente. Iniciando novo login no AEJS...");
  await clearAejsAuthState();
  await mkdir(dirname(AEJS_AUTH_STATE_PATH), { recursive: true });

  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();

  try {
    await page.goto(config.baseUrl);

    // Clica em "Acesso via Plataforma"
    const acessoBtn = page.getByText("Acesso via Plataforma");
    await expect(acessoBtn).toBeVisible({ timeout: 30_000 });
    await acessoBtn.click();

    // Espera os inputs ficarem visiveis.
    const inputs = page.locator("input:visible");
    await expect(inputs.first()).toBeVisible({ timeout: 30_000 });

    // Preenche usuario
    await inputs.first().fill(config.username);

    // Preenche senha
    const passwordInput = page.locator('input[type="password"]:visible');
    await expect(passwordInput).toBeVisible({ timeout: 10_000 });
    await passwordInput.fill(config.password);

    // Se houver 3 ou mais inputs visiveis e config.path estiver preenchido, preenche o terceiro.
    const count = await inputs.count();
    if (count >= 3 && config.path) {
      await inputs.nth(2).fill(config.path);
    }

    // Clica em Login
    const loginBtn = page.locator("button:has-text('Login'), .x-btn:has-text('Login'), input[type='button'][value='Login']").first();
    await loginBtn.click();

    // Aguarda o painel principal do ExtJS carregar
    const mainIndicator = page.locator("a, button, .x-btn, .x-btn-inner").first();
    await expect(mainIndicator).toBeVisible({ timeout: 40_000 });

    // Salva o estado da sessao
    await context.storageState({ path: AEJS_AUTH_STATE_PATH });
    await chmod(AEJS_AUTH_STATE_PATH, 0o600);
    await writeFile(
      AEJS_AUTH_METADATA_PATH,
      JSON.stringify({ fingerprint: aejsAuthFingerprint(config) }),
      { mode: 0o600 },
    );
  } catch (error) {
    await clearAejsAuthState();
    throw error;
  } finally {
    await context.close();
  }

  // Valida explicitamente a sessao recem-criada antes de concluir o setup
  if (!(await validateStoredSession(config, browser))) {
    await clearAejsAuthState();
    throw new Error(
      "Falha na autenticacao do AEJS: O estado de sessao foi salvo, mas a validacao de acesso a area logada falhou.",
    );
  }

  console.log("Autenticacao do AEJS realizada e comprovada com sucesso.");
});
