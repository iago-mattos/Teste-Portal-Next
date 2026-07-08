import { expect, test } from "../../fixtures/test";

const functionalReadonly = { tag: ["@functional", "@readonly"] };

test(
  "LOGIN-01 | O portal do cadastro tem uma URL única, onde é permitida a entrada do cliente sendo enviada por e-mail a cada simulação que ele fizer e tokenizada",
  functionalReadonly,
  async ({ authenticatedPage, portalConfig, proposalsPage }) => {
    await proposalsPage.open();

    const currentUrl = new URL(authenticatedPage.url());
    expect(currentUrl.origin).toBe(portalConfig.portalUrl);
    expect(currentUrl.pathname).toBe(portalConfig.paths.proposals);
    expect(currentUrl.search, "O token não deve permanecer na URL.").toBe("");

    const cookies = await authenticatedPage
      .context()
      .cookies(portalConfig.portalUrl);
    expect(cookies.some((cookie) => cookie.name === "__Host-session")).toBe(
      true,
    );
  },
);

test(
  "LOGIN-02 | O link será único para todos os clientes e será validado por token enviado por e-mail a cada login",
  functionalReadonly,
  async ({ authenticatedPage, proposalsPage }) => {
    await proposalsPage.open();

    await expect(proposalsPage.heading).toBeVisible();
    await expect(
      authenticatedPage.getByText(/Link de acesso inv[aá]lido ou expirado/i),
    ).toHaveCount(0);
  },
);

test(
  "LOGIN-03 | Em caso de sucesso, direcionar para página de simulações realizadas pelo cliente. Deverá constar todas as simulações, em todos os status.",
  functionalReadonly,
  async ({ portalConfig, proposalsPage }) => {
    await proposalsPage.open();
    await proposalsPage.loadAll();

    const proposalNumber = portalConfig.testData.expectedProposal.visibleNumber;
    expect(
      proposalNumber,
      "Configure testData.expectedProposal.visibleNumber para o ambiente.",
    ).not.toBe("");
    await expect(proposalsPage.getProposalCard(proposalNumber)).toBeVisible();
  },
);

test.describe("Login sem sessão", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    "LOGIN-04 | Ao consultar proposta com CPF/CNPJ inválido, deverá apresentar a mensagem “CPF/CNPJ invalido.” sem enviar a solicitação de login",
    functionalReadonly,
    async ({ page, portalConfig }) => {
      let loginRequests = 0;
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          request.method() === "POST" &&
          url.pathname === "/api/auth/login"
        ) {
          loginRequests += 1;
        }
      });

      await page.goto("/");
      await Promise.all([
        page.waitForURL((url) => url.pathname === portalConfig.paths.login),
        page.getByRole("button", { name: /Consultar proposta/i }).click(),
      ]);

      await page
        .getByRole("textbox", { name: /CPF|CNPJ/i })
        .fill(portalConfig.testData.invalidCpf);
      await page.getByRole("button", { name: "Continuar" }).click();

      await expect(
        page.getByRole("alert").filter({
          hasText: /CPF(?:\/CNPJ)? inv[aá]lido\./i,
        }),
      ).toBeVisible();
      expect(loginRequests, "Requisições de login").toBe(0);
    },
  );
});
