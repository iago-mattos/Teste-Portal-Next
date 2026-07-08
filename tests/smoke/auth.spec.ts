import { expect, test } from "../fixtures/test";

interface AuthResponse {
  autenticado?: unknown;
}

test(
  "mantém a sessão autenticada reutilizável",
  { tag: ["@smoke", "@readonly"] },
  async ({ authenticatedPage, portalConfig }) => {
    const response = await authenticatedPage.request.get(
      portalConfig.paths.authMe,
    );

    expect(
      response.ok(),
      `GET ${portalConfig.paths.authMe} respondeu HTTP ${response.status()}.`,
    ).toBe(true);
    const body = (await response.json()) as AuthResponse;
    expect(body.autenticado).toBe(true);

    const cookies = await authenticatedPage
      .context()
      .cookies(portalConfig.portalUrl);
    expect(cookies.some((cookie) => cookie.name === "__Host-session")).toBe(
      true,
    );
  },
);
