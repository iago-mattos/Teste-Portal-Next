import { expect, test, type Locator, type Page } from "@playwright/test";
import type {
  DigitalMortgageSimulationScenario,
  SimulationApplicantInput,
  SimulationFinancialInput,
  SimulationDataScreenExpectation,
  SimulationJourneySelection,
} from "../../types/simulator";

export interface SimulatorInteractions {
  click(locator: Locator): Promise<void>;
  type(
    locator: Locator,
    value: string,
    options?: Readonly<{ clear?: boolean }>,
  ): Promise<void>;
  selectOption(locator: Locator, label: string): Promise<void>;
  setChecked(locator: Locator, checked: boolean): Promise<void>;
}

const defaultInteractions: SimulatorInteractions = {
  click: async (locator) => locator.click(),
  type: async (locator, value, options) => {
    if (options?.clear === false) {
      await locator.pressSequentially(value);
      return;
    }
    await locator.fill(value);
  },
  selectOption: async (locator, label) => {
    await locator.selectOption({ label });
  },
  setChecked: async (locator, checked) => {
    await locator.setChecked(checked);
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class PortalSimulatorPage {
  readonly welcomeHeading: Locator;
  readonly simulationDataHeading: Locator;
  readonly propertyValueInput: Locator;
  readonly financingValueInput: Locator;
  readonly customTermInput: Locator;
  readonly amortizationSelect: Locator;
  readonly gracePeriodSelect: Locator;
  readonly birthDateInput: Locator;
  readonly netIncomeInput: Locator;
  readonly composeIncomeCheckbox: Locator;
  readonly insurerHeading: Locator;
  readonly resultHeading: Locator;
  readonly applicantDataHeading: Locator;
  readonly cpfInput: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly mobileInput: Locator;

  private readonly startSimulationButton: Locator;
  private readonly insurersGroup: Locator;
  private calculation?: Promise<{ status: number; body: string } | undefined>;

  constructor(
    private readonly page: Page,
    private readonly interactions: SimulatorInteractions = defaultInteractions,
    private readonly loadingTimeoutMs = 30_000,
  ) {
    this.welcomeHeading = page.getByRole("heading", {
      name: "Seja bem-vindo!",
      level: 1,
    });
    this.startSimulationButton = page.getByRole("button", {
      name: /Realizar nova simula[cç][aã]o/i,
    });
    this.simulationDataHeading = page.getByRole("heading", {
      name: "Dados da simulacao",
      level: 1,
    });
    this.propertyValueInput = page.getByRole("textbox", {
      name: "Valor do imovel",
      exact: true,
    });
    this.financingValueInput = page.getByRole("textbox", {
      name: "Valor do financiamento",
      exact: true,
    });
    this.customTermInput = page.getByRole("textbox", {
      name: "Prazo (meses)",
      exact: true,
    });
    this.amortizationSelect = page.getByRole("combobox", {
      name: "Sistema de amortizacao",
      exact: true,
    });
    this.gracePeriodSelect = page.getByRole("combobox", {
      name: "Carencia",
      exact: true,
    });
    this.birthDateInput = page.getByRole("textbox", {
      name: "Data de nascimento",
      exact: true,
    });
    this.netIncomeInput = page.getByRole("textbox", {
      name: "Renda liquida",
      exact: true,
    });
    this.composeIncomeCheckbox = page.getByRole("checkbox", {
      name: "Compor renda com co-adquirente",
      exact: true,
    });
    this.insurerHeading = page.getByRole("heading", {
      name: "Escolha sua seguradora",
      level: 1,
    });
    this.insurersGroup = page.getByRole("radiogroup", {
      name: "Seguradoras disponiveis",
      exact: true,
    });
    this.resultHeading = page.getByRole("heading", {
      name: "Resultado da simulacao",
      level: 1,
    });
    this.applicantDataHeading = page.getByRole("heading", {
      name: "Seus dados",
      level: 1,
    });
    this.cpfInput = page.getByRole("textbox", { name: "CPF", exact: true });
    this.nameInput = page.getByRole("textbox", { name: "Nome", exact: true });
    this.emailInput = page.getByRole("textbox", {
      name: "Email",
      exact: true,
    });
    this.mobileInput = page.getByRole("textbox", {
      name: "Celular",
      exact: true,
    });
  }

  async open(): Promise<void> {
    await this.page.goto("/");
    await expect(this.welcomeHeading).toBeVisible();
    await expect(
      this.startSimulationButton,
      "O ambiente configurado em PORTAL_URL não oferece 'Realizar nova simulação'. " +
        "Use um perfil com Simulador público (ex.: PW_PROFILE=desenv).",
    ).toBeVisible();
  }

  async startNewSimulation(): Promise<void> {
    await expect(this.startSimulationButton).toHaveCount(1);
    await this.interactions.click(this.startSimulationButton);
    await expect(
      this.page.getByRole("heading", {
        name: "Simule o tipo de credito desejado",
        level: 1,
      }),
    ).toBeVisible();
    // Overlay que não some = Portal lento/indisponível, não regra de negócio: o erro
    // diz isso, para o vermelho não ser lido como defeito do produto.
    await expect(
      this.page.getByRole("status").filter({
        hasText: "Carregando modalidades...",
      }),
      `AMBIENTE: "Carregando modalidades..." não terminou em ${this.loadingTimeoutMs / 1000} s; o resultado não prova a regra testada.`,
    ).toBeHidden({ timeout: this.loadingTimeoutMs });
  }

  /**
   * Percorre a jornada. A tela Dados é a última: PJ e Crédito Garantia não têm
   * a etapa de indexador, então o último passo da lista aguarda `/dados-simulacao`.
   */
  async chooseJourney(journey: SimulationJourneySelection): Promise<void> {
    const steps = this.journeySteps(journey);
    const lastStep = steps[steps.length - 1];
    if (!lastStep) throw new Error("A jornada do Simulador não possui passos.");

    for (const step of steps.slice(0, -1)) await this.clickUniqueOption(step);
    await Promise.all([
      this.page.waitForURL(/\/dados-simulacao$/),
      this.clickUniqueOption(lastStep),
    ]);
    await expect(this.simulationDataHeading).toBeVisible();
  }

  journeySteps(journey: SimulationJourneySelection): readonly string[] {
    const steps: readonly (string | undefined)[] = [
      journey.modality,
      journey.borrowerType,
      journey.propertyType,
      journey.propertyOrigin,
      journey.indexer,
    ];
    return steps.filter((step): step is string => step !== undefined);
  }

  /** Avança pelas escolhas informadas sem exigir que a jornada termine nos Dados. */
  async choosePath(path: readonly string[]): Promise<void> {
    for (const step of path) await this.clickUniqueOption(step);
  }

  /** Nomes das opções da etapa atual, na ordem exibida. */
  async visibleOptions(): Promise<string[]> {
    const names = await this.page
      .getByRole("main")
      .getByRole("button")
      .evaluateAll((elements) =>
        elements.map((element) =>
          (element.getAttribute("aria-label") ?? element.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim(),
        ),
      );
    return names
      .map((name) =>
        name.replace(/^\d{2}\s*/, "").replace(/\s*(Simular|Continuar)$/, ""),
      )
      .filter(
        (name) =>
          name.length > 0 && !["Voltar", "Sair", "Avancar"].includes(name),
      );
  }

  /** "Voltar" do cabeçalho; na tela Dados existe outro "Voltar" no formulário. */
  async goBackOneStep(): Promise<void> {
    await this.page
      .getByRole("banner")
      .getByRole("button", { name: "Voltar", exact: true })
      .click();
  }

  /** Campo textual da tela Dados pelo rótulo acessível exato. */
  dataField(label: string): Locator {
    return this.page.getByRole("textbox", { name: label, exact: true });
  }

  async expectDataScreen(
    expectation: SimulationDataScreenExpectation,
  ): Promise<void> {
    await expect(this.simulationDataHeading).toBeVisible();
    const eyebrow = this.page
      .getByRole("main")
      .getByText(new RegExp(`^${escapeRegExp(expectation.eyebrow)}$`, "i"));
    await expect(eyebrow).toHaveCount(1);
    await expect(this.dataField(expectation.propertyValueLabel)).toBeVisible();
    await expect(this.dataField(expectation.financingValueLabel)).toBeVisible();
    await expect(this.dataField(expectation.incomeLabel)).toBeVisible();
    await expect(this.dataField("Data de nascimento")).toBeVisible();
  }

  /**
   * Nome ACESSÍVEL de cada card, como o navegador o calcula (aria-labelledby,
   * aria-label, label...), na ordem da tela. Vazio = o card não tem nome para
   * leitor de tela, mesmo que o texto apareça na tela.
   */
  async insurerAccessibleNames(): Promise<string[]> {
    const radios = this.insurersGroup.getByRole("radio");
    const total = await radios.count();
    const names: string[] = [];
    for (let index = 0; index < total; index += 1) {
      const snapshot = await radios.nth(index).ariaSnapshot();
      const match = /^- radio(?: "((?:[^"\\]|\\.)*)")?/.exec(snapshot.trim());
      if (!match) {
        throw new Error(`Snapshot de acessibilidade inesperado para o card ${index}: ${snapshot.slice(0, 80)}`);
      }
      names.push((match[1] ?? "").replace(/\\(.)/g, "$1"));
    }
    return names;
  }

  /**
   * Texto VISÍVEL de cada card, na ordem da tela: sobe do radio até o maior
   * ancestral que contém só ele, SEM sair do radiogroup (com um card só, a busca
   * não pode chegar ao <html>). Serve para conferir o que o usuário lê contra a
   * resposta do BFF.
   */
  async insurerCardTexts(): Promise<string[]> {
    const radios = this.insurersGroup.getByRole("radio");
    const total = await radios.count();
    const texts: string[] = [];
    for (let index = 0; index < total; index += 1) {
      const text = await radios.nth(index).evaluate((radio) => {
        const group = radio.closest('[role="radiogroup"]');
        if (!group) throw new Error("O radio do card esta fora do radiogroup de seguradoras.");
        let card: Element = radio;
        while (
          card.parentElement &&
          card.parentElement !== group &&
          card.parentElement.querySelectorAll('[role="radio"]').length === 1
        ) {
          card = card.parentElement;
        }
        return (card as HTMLElement).innerText;
      });
      texts.push(text.replace(/\s+/g, " ").trim());
    }
    return texts;
  }

  /** Nomes das seguradoras exibidas (primeira linha de cada card), na ordem da tela. */
  async visibleInsurerNames(): Promise<string[]> {
    return this.insurersGroup.getByRole("radio").evaluateAll((radios) =>
      radios.map((radio) => {
        const id = radio.getAttribute("aria-labelledby") ?? "";
        const card = id ? document.getElementById(id) : null;
        return (card?.textContent ?? "").replace(/\s+/g, " ").trim();
      }),
    );
  }

  /**
   * Resultado do cálculo na tela de seguradoras: cards quando o backend aceita,
   * ou o alerta de erro quando recusa. Aguarda um dos dois e devolve também o
   * status HTTP do cálculo (POST /api/simulacao/evolucao) capturado no
   * `submitDataStep`. Resposta 5xx NÃO é recusa de regra: lança um erro de
   * ambiente, para que um 504 não vire "prazo recusado" nem "limite violado".
   */
  async waitForInsurerOutcome(): Promise<
    Readonly<{
      insurerCount: number;
      error?: string;
      status?: number;
      /** Corpo bruto de POST /api/simulacao/evolucao (para conferir contra o banco). */
      responseBody?: string;
    }>
  > {
    await expect(this.insurerHeading).toBeVisible();
    const cards = this.insurersGroup.getByRole("radio");
    const alert = this.page
      .getByRole("main")
      .getByRole("alert")
      .filter({ hasText: /\S/ });
    await expect(cards.first().or(alert.first())).toBeVisible({
      timeout: this.loadingTimeoutMs,
    });

    const calculation = await this.calculation;
    this.calculation = undefined; // não reaproveitar uma resposta velha em outra leitura
    if (!calculation) {
      throw new Error(
        "AMBIENTE/AUTOMAÇÃO: o cálculo (/api/simulacao/evolucao) não respondeu em tempo; o resultado não prova a regra testada.",
      );
    }
    if (calculation.status >= 500) {
      throw new Error(
        `AMBIENTE: o cálculo respondeu HTTP ${calculation.status}; o resultado não prova a regra testada.`,
      );
    }
    const status = calculation.status;
    const insurerCount = await cards.count();
    const responseBody = calculation.body;
    if (insurerCount > 0) return { insurerCount, status, responseBody };
    return {
      insurerCount,
      status,
      responseBody,
      error: (await alert.first().innerText()).trim(),
    };
  }

  /** Clica em Avançar na tela Dados sem esperar navegação (validações e erros). */
  async submitDataStep(): Promise<void> {
    const advanceButton = this.page.getByRole("button", {
      name: "Avancar",
      exact: true,
    });
    await expect(advanceButton).toHaveCount(1);
    // A resposta do cálculo é aguardada ANTES do clique para não perdê-la.
    this.calculation = this.page
      .waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/api/simulacao/evolucao",
        { timeout: this.loadingTimeoutMs },
      )
      .then(async (response) => ({
        status: response.status(),
        body: await response.text().catch(() => ""),
      }))
      .catch(() => undefined);
    await this.interactions.click(advanceButton);
  }

  /** Mensagens de erro de formulário visíveis na etapa atual, sem alertas vazios. */
  dataStepAlerts(): Locator {
    return this.page
      .getByRole("main")
      .getByRole("alert")
      .filter({ hasText: /\S/ });
  }

  /**
   * Preenche a tela Dados. Sem `screen`, usa os rótulos de Pessoa Física; para
   * PJ passe o `dataScreen` da jornada ("Valor do emprestimo", "Faturamento liquido").
   */
  async fillSimulationData(
    data: SimulationFinancialInput,
    screen?: Pick<
      SimulationDataScreenExpectation,
      "financingValueLabel" | "incomeLabel"
    >,
    options: Readonly<{ requireGracePeriod?: boolean }> = {},
  ): Promise<void> {
    const financingValueInput = screen
      ? this.dataField(screen.financingValueLabel)
      : this.financingValueInput;
    const netIncomeInput = screen
      ? this.dataField(screen.incomeLabel)
      : this.netIncomeInput;

    await this.interactions.type(
      this.propertyValueInput,
      data.propertyValueCents,
    );
    await this.interactions.type(financingValueInput, data.financingValueCents);
    await this.interactions.setChecked(
      this.page.getByRole("radio", {
        name: `${data.termMonths} meses`,
        exact: true,
      }),
      true,
    );
    await this.interactions.selectOption(
      this.amortizationSelect,
      data.amortizationSystem,
    );
    // O campo Carência deixou de aparecer em todas as jornadas do portal-desenv
    // (verificado em 11/11/2026; o contrato de visibilidade é de grace-visibility.spec.ts).
    // Só tenta escolher a carência quando o campo existe; se uma carência > 0 foi
    // pedida e o campo não existe, registra na anotação do teste em vez de travar 10 s.
    if ((await this.gracePeriodSelect.count()) > 0) {
      await this.interactions.selectOption(
        this.gracePeriodSelect,
        data.gracePeriodDays === 0 ? "Selecione" : String(data.gracePeriodDays),
      );
    } else if (data.gracePeriodDays > 0 && options.requireGracePeriod) {
      // Cenário cujo propósito é a carência: sem o campo, criar a proposta sem
      // carência e passar seria falso-verde.
      throw new Error(
        `Carência de ${data.gracePeriodDays} dias exigida pelo cenário, mas a tela Dados não exibe o campo Carência; a proposta não será criada sem ela.`,
      );
    } else if (data.gracePeriodDays > 0) {
      test.info().annotations.push({
        type: "carencia-nao-aplicada",
        description: `Carência de ${data.gracePeriodDays} dias pedida, mas a tela Dados não exibe o campo Carência.`,
      });
    }
    await this.interactions.type(this.birthDateInput, data.birthDateDigits);
    await this.interactions.type(netIncomeInput, data.netIncomeCents);
    await this.interactions.setChecked(
      this.composeIncomeCheckbox,
      data.composeIncome,
    );
  }

  async continueToInsurers(): Promise<void> {
    const advanceButton = this.page.getByRole("button", {
      name: "Avancar",
      exact: true,
    });
    await expect(advanceButton).toHaveCount(1);
    await Promise.all([
      this.page.waitForURL(/\/seguradoras$/),
      this.interactions.click(advanceButton),
    ]);
    await expect(this.insurerHeading).toBeVisible();
    await expect(
      this.page.getByRole("status").filter({
        hasText: "Calculando seguradoras...",
      }),
      `AMBIENTE: "Calculando seguradoras..." não terminou em ${this.loadingTimeoutMs / 1000} s; o resultado não prova a regra testada.`,
    ).toBeHidden({ timeout: this.loadingTimeoutMs });
  }

  async selectInsurer(name: string): Promise<void> {
    const insurer = this.insurersGroup.getByRole("radio", {
      name: new RegExp(`^${escapeRegExp(name)}\\b`),
    });
    await expect(insurer).toHaveCount(1);

    const labelledBy = await insurer.getAttribute("aria-labelledby");
    if (!labelledBy) {
      throw new Error(
        `A seguradora ${name} nao informou o card associado via aria-labelledby.`,
      );
    }

    const insurerCard = this.insurersGroup.locator(
      `[id=${JSON.stringify(labelledBy)}]`,
    );
    await expect(insurerCard).toHaveCount(1);
    await this.interactions.click(insurerCard);
    await expect(insurer).toBeChecked();
  }

  async continueToResult(): Promise<void> {
    const advanceButton = this.page.getByRole("button", {
      name: "Avancar",
      exact: true,
    });
    await expect(advanceButton).toHaveCount(1);
    await expect(advanceButton).toBeEnabled();
    await Promise.all([
      this.page.waitForURL(/\/resultado$/),
      this.interactions.click(advanceButton),
    ]);
    await expect(this.resultHeading).toBeVisible();
  }

  async continueToApplicantData(): Promise<void> {
    const advanceButton = this.page.getByRole("button", {
      name: "Avancar",
      exact: true,
    });
    await expect(advanceButton).toHaveCount(1);
    await Promise.all([
      this.page.waitForURL(/\/enviar-proposta$/),
      this.interactions.click(advanceButton),
    ]);
    await expect(this.applicantDataHeading).toBeVisible();
  }

  async fillApplicantData(applicant: SimulationApplicantInput): Promise<void> {
    await this.interactions.type(this.cpfInput, applicant.cpfDigits);
    await this.interactions.type(this.nameInput, applicant.name);
    await this.interactions.type(this.emailInput, applicant.email);
    await this.interactions.type(this.mobileInput, applicant.mobileDigits);
    await expect(this.nameInput).toHaveValue(applicant.name);
  }

  /** Tela de envio da Pessoa Jurídica: CNPJ, nome da empresa, e-mail e telefone. */
  async fillCorporateApplicantData(
    applicant: Readonly<{
      cnpjDigits: string;
      companyName: string;
      email: string;
      phoneDigits: string;
    }>,
    options: Readonly<{ expectExactCompanyName?: boolean }> = {},
  ): Promise<void> {
    await this.interactions.type(
      this.page.getByRole("textbox", { name: "CNPJ", exact: true }),
      applicant.cnpjDigits,
    );
    const companyName = this.page.getByRole("textbox", {
      name: "Nome da empresa",
      exact: true,
    });
    await this.interactions.type(companyName, applicant.companyName);
    await this.interactions.type(
      this.page.getByRole("textbox", { name: "Email", exact: true }),
      applicant.email,
    );
    await this.interactions.type(
      this.page.getByRole("textbox", { name: "Telefone", exact: true }),
      applicant.phoneDigits,
    );
    // Por padrão o nome digitado deve ficar intacto; quem testa limite de
    // tamanho desliga a conferência e verifica o valor final por conta própria.
    if (options.expectExactCompanyName !== false) {
      await expect(companyName).toHaveValue(applicant.companyName);
    }
  }

  async completeSimulation(
    scenario: DigitalMortgageSimulationScenario,
    applicant: SimulationApplicantInput,
    options: Readonly<{ allowExistingCpfNotice?: boolean }> = {},
  ): Promise<string> {
    await this.open();
    await this.startNewSimulation();
    await this.chooseJourney(scenario.journey);
    await this.verifyNumericInputsRejectLetters();
    await this.fillSimulationData(scenario.financial);
    await this.continueToInsurers();
    await this.selectInsurer(scenario.insurer);
    await this.continueToResult();
    await this.continueToApplicantData();
    await this.fillApplicantData(applicant);
    return this.submitProposal(options);
  }

  async submitProposal(
    options: Readonly<{ allowExistingCpfNotice?: boolean }> = {},
  ): Promise<string> {
    const requestSubmissionButton = this.page.getByRole("button", {
      name: "Enviar Proposta",
      exact: true,
    });
    await expect(requestSubmissionButton).toHaveCount(1);
    await this.interactions.click(requestSubmissionButton);

    const confirmationDialog = this.page.getByRole("alertdialog", {
      name: "Confirmar envio",
      exact: true,
    });
    await expect(confirmationDialog).toBeVisible();

    const confirmButton = confirmationDialog.getByRole("button", {
      name: "Enviar",
      exact: true,
    });
    await expect(confirmButton).toHaveCount(1);
    await this.interactions.click(confirmButton);

    const duplicateProposalAlert = this.page.getByRole("alert").filter({
      hasText: "existe uma proposta cadastrada para este mesmo CPF",
    });
    const protocolText = this.page.getByText(/^Protocolo:\s*\d+$/);
    const submissionErrorAlert = this.page
      .getByRole("alert")
      .filter({ hasText: /ORA-\d+|n[aã]o foi poss[ií]vel|erro|falha/i })
      .filter({ hasNotText: "existe uma proposta cadastrada para este mesmo CPF" });

    await expect
      .poll(
        async () =>
          (await duplicateProposalAlert.isVisible()) ||
          (await protocolText.isVisible()) ||
          (await submissionErrorAlert.first().isVisible()),
        {
          message:
            "O Portal deve apresentar o protocolo real, o aviso de CPF existente ou uma mensagem de erro.",
          timeout: 60_000,
        },
      )
      .toBe(true);

    if (await submissionErrorAlert.first().isVisible()) {
      const message = (await submissionErrorAlert.first().innerText()).trim();
      throw new Error(`O Portal recusou o envio da proposta: ${message}`);
    }

    if (await duplicateProposalAlert.isVisible()) {
      const message = (await duplicateProposalAlert.textContent())?.trim();

      if (!options.allowExistingCpfNotice) {
        throw new Error(
          `O Portal recusou a criação da proposta: ${message ?? "CPF com proposta em análise."}`,
        );
      }

      // O CPF compartilhado (ex.: TIMELINE_DOCUMENTS) espera este aviso — ele
      // não é, por si só, uma rejeição. Confirma o diálogo quando o próprio
      // componente oferecer continuidade e aguarda o protocolo real do
      // backend. A mensagem genérica de sucesso NÃO substitui o protocolo:
      // ela pode aparecer antes dele, então não encerra esta espera.
      await this.acknowledgeExistingCpfNotice(duplicateProposalAlert);

      const protocolAppeared = await protocolText
        .waitFor({ state: "visible", timeout: 60_000 })
        .then(() => true)
        .catch(() => false);

      if (!protocolAppeared) {
        throw new Error(
          "O Portal exibiu o aviso de CPF com proposta existente, mas não " +
            "apresentou um protocolo real dentro do tempo esperado após a " +
            "confirmação. Observe ao vivo qual elemento ou resposta de rede " +
            `confirma a criação nesse caso (aviso: "${message ?? "sem texto"}") ` +
            "antes de reativar este fluxo — não presuma um protocolo sequencial ou inventado.",
        );
      }
    }

    await expect(protocolText).toHaveCount(1);
    await expect(protocolText).toBeVisible();

    const value = await protocolText.textContent();
    const protocol = /Protocolo:\s*(\d+)/.exec(value ?? "")?.[1];
    if (!protocol) {
      throw new Error("O Portal concluiu o envio sem apresentar um protocolo válido.");
    }

    return protocol;
  }

  private async acknowledgeExistingCpfNotice(
    duplicateProposalAlert: Locator,
  ): Promise<void> {
    const continueButton = duplicateProposalAlert.getByRole("button", {
      name: /Continuar|Confirmar|Prosseguir|Enviar mesmo assim/i,
    });
    if ((await continueButton.count()) === 0) return;

    await this.interactions.click(continueButton.first());
    await expect(duplicateProposalAlert).toBeHidden({ timeout: 30_000 });
  }

  private async clickUniqueOption(name: string): Promise<void> {
    const option = this.page.getByRole("button", { name, exact: true });
    await expect(option).toHaveCount(1);
    await this.interactions.click(option);
  }

  private async verifyNumericInputsRejectLetters(): Promise<void> {
    const numericInputs = [
      this.propertyValueInput,
      this.financingValueInput,
      this.customTermInput,
      this.birthDateInput,
      this.netIncomeInput,
    ] as const;

    for (const input of numericInputs) {
      await input.clear();
      const valueBeforeLetters = await input.inputValue();
      await this.interactions.type(input, "abc", { clear: false });
      await expect(input).toHaveValue(valueBeforeLetters);
    }
  }
}
