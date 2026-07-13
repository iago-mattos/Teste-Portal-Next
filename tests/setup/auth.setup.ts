import { existsSync } from "node:fs";
import { test as setup } from "@playwright/test";
import { PORTAL_AUTH_STATE_PATH } from "../config/auth-config";
import { loadPortalRuntimeConfig } from "../config/runtime-config";
import { ensurePortalSession } from "../fixtures/auth.fixture";

setup.setTimeout(120_000);

setup("authenticate Portal session", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: existsSync(PORTAL_AUTH_STATE_PATH)
      ? PORTAL_AUTH_STATE_PATH
      : undefined,
  });

  try {
    await ensurePortalSession(context, loadPortalRuntimeConfig());
  } finally {
    await context.close();
  }
});
