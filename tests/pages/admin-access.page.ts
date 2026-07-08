import { expect, type Locator, type Page } from "@playwright/test";

export class AdminAccessPage {
  readonly backendHeading: Locator;
  readonly accessGeneratorHeading: Locator;

  constructor(
    private readonly page: Page,
    private readonly adminUrl: string,
  ) {
    this.backendHeading = page.getByRole("heading", {
      name: "Backend",
      level: 1,
    });
    this.accessGeneratorHeading = page.getByRole("heading", {
      name: "Gerar link de acesso",
      level: 4,
    });
  }

  async openLogin(): Promise<void> {
    await this.page.goto(`${this.adminUrl}/login`);
  }

  isLoginRequired(): boolean {
    return new URL(this.page.url()).pathname === "/admin/login";
  }

  async signIn(username: string, password: string): Promise<void> {
    await this.page.getByLabel("Usuário", { exact: true }).fill(username);
    await this.page.getByLabel("Senha", { exact: true }).fill(password);
    await Promise.all([
      this.page.waitForURL((url) => url.pathname === "/admin"),
      this.page.getByRole("button", { name: "Entrar", exact: true }).click(),
    ]);
  }

  async openAccessGenerator(): Promise<void> {
    await this.page.goto(`${this.adminUrl}/pascal`);
    await expect(this.backendHeading).toBeVisible();
    await expect(this.accessGeneratorHeading).toBeVisible();
  }

  async generateAccessUrl(cpf: string): Promise<string> {
    const cpfInput = this.page.getByLabel("CPF/CNPJ para o link", {
      exact: true,
    });
    await cpfInput.fill("");
    await cpfInput.pressSequentially(cpf);
    await cpfInput.blur();

    const generateButton = this.page.getByRole("button", {
      name: "Gerar link",
      exact: true,
    });
    await expect(generateButton).toBeEnabled();
    await generateButton.click();
    await expect(
      this.page.getByRole("button", { name: "Copiar link", exact: true }),
    ).toBeVisible({ timeout: 60_000 });

    const accessField = this.page.getByLabel("Link de acesso", { exact: true });
    await expect(accessField).toBeVisible();
    return accessField.inputValue();
  }
}
