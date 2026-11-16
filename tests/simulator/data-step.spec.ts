import {
  expect,
  observedJourney,
  PF_RESIDENTIAL_ESTEIRA_TR,
  test,
} from "./simulator.fixture";

/**
 * SIM-DATA-01, 06, 19, 21, 22, 24, 25, 26 — validações da tela Dados, sem envio.
 * Natureza: backend real, leitura. As mensagens são as observadas em
 * portal-desenv em 09/11/2026; regras numéricas (mínimos, percentuais, idade
 * máxima) continuam pendentes de Produto e NÃO são assertadas aqui.
 */
const matrix = (id: string) => ({ type: "matriz", description: id });
const tags = ["@readonly", "@simulator"];

const EMPTY_SUBMIT_MESSAGES = [
  "Valor do imovel abaixo do minimo permitido.",
  "Informe o valor a financiar.",
  "Informe o prazo.",
  "É necessario ter ao menos 18 anos.",
  "Informe a renda.",
] as const;

const REPRESENTATIVE_JOURNEYS = [
  PF_RESIDENTIAL_ESTEIRA_TR,
  "Financiamento Imobiliário > Pessoa Jurídica > Imóvel Residencial > Holding Familiar",
  "Crédito Garantia de Imóvel > Pessoa Física > Imóvel",
  "Crédito Garantia de Imóvel > Pessoa Jurídica > Imóvel",
] as const;

/** Data DDMMAAAA relativa a hoje, em anos e dias de deslocamento. */
function birthDigits(yearsAgo: number, extraDays = 0): string {
  const today = new Date();
  const date = new Date(
    today.getFullYear() - yearsAgo,
    today.getMonth(),
    today.getDate() + extraDays,
  );
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}${month}${date.getFullYear()}`;
}

test.describe("Simulador | Dados | envio vazio", () => {
  for (const id of REPRESENTATIVE_JOURNEYS) {
    test(
      `mostra todas as validações obrigatórias e não calcula: ${id}`,
      { tag: tags, annotation: matrix("SIM-DATA-01") },
      async ({ page, simulator, apiActivity }) => {
        await simulator.chooseJourney(observedJourney(id).selection);

        await simulator.submitDataStep();

        await expect(simulator.dataStepAlerts()).toHaveText([
          ...EMPTY_SUBMIT_MESSAGES,
        ]);
        await expect(page).toHaveURL(/\/dados-simulacao$/);
        expect(apiActivity.allowedWrites).toEqual([]);
      },
    );
  }
});

test.describe("Simulador | Dados | regras com mensagem explícita", () => {
  test(
    "bloqueia financiamento superior ao valor do imóvel",
    { tag: tags, annotation: matrix("SIM-DATA-06") },
    async ({ page, simulator, apiActivity }) => {
      await simulator.chooseJourney(
        observedJourney(PF_RESIDENTIAL_ESTEIRA_TR).selection,
      );
      await simulator.fillSimulationData({
        propertyValueCents: "10000000",
        financingValueCents: "20000000",
        termMonths: 120,
        amortizationSystem: "SAC - Sistema de amortizacao constante",
        gracePeriodDays: 30,
        birthDateDigits: birthDigits(30),
        netIncomeCents: "5000000",
        composeIncome: false,
      });

      await simulator.submitDataStep();

      await expect(simulator.dataStepAlerts()).toHaveText([
        "Valor financiado superior ao valor do imovel.",
      ]);
      await expect(page).toHaveURL(/\/dados-simulacao$/);
      expect(apiActivity.allowedWrites).toEqual([]);
    },
  );

  // Valores monetários inconsistentes de propósito (financiamento > imóvel)
  // mantêm o formulário bloqueado, o que permite observar só a regra de idade
  // sem chamar o backend de cálculo.
  const ageCases = [
    { name: "menor de idade (17 anos e 364 dias)", digits: birthDigits(18, 1), blocked: true },
    { name: "data de nascimento futura", digits: birthDigits(-5), blocked: true },
    { name: "maior de idade (19 anos)", digits: birthDigits(19), blocked: false },
  ] as const;

  for (const ageCase of ageCases) {
    test(
      `idade mínima — ${ageCase.name} ${ageCase.blocked ? "é recusada" : "não é recusada pela regra de idade"}`,
      { tag: tags, annotation: matrix("SIM-DATA-19 / SIM-DATA-22") },
      async ({ page, simulator, apiActivity }) => {
        await simulator.chooseJourney(
          observedJourney(PF_RESIDENTIAL_ESTEIRA_TR).selection,
        );
        await simulator.fillSimulationData({
          propertyValueCents: "10000000",
          financingValueCents: "20000000",
          termMonths: 120,
          amortizationSystem: "SAC - Sistema de amortizacao constante",
          gracePeriodDays: 30,
          birthDateDigits: ageCase.digits,
          netIncomeCents: "5000000",
          composeIncome: false,
        });

        await simulator.submitDataStep();

        // Pré-condição: a validação rodou (o bloqueio de valores sempre aparece).
        await expect(simulator.dataStepAlerts().filter({
          hasText: "Valor financiado superior ao valor do imovel.",
        })).toHaveCount(1);
        const ageAlert = simulator.dataStepAlerts().filter({
          hasText: "É necessario ter ao menos 18 anos.",
        });
        await expect(ageAlert).toHaveCount(ageCase.blocked ? 1 : 0);
        await expect(page).toHaveURL(/\/dados-simulacao$/);
        expect(apiActivity.allowedWrites).toEqual([]);
      },
    );
  }

  test(
    "data de nascimento incompleta é recusada sem chamar o cálculo",
    { tag: tags, annotation: matrix("SIM-DATA-21") },
    async ({ page, simulator, apiActivity }) => {
      await simulator.chooseJourney(
        observedJourney(PF_RESIDENTIAL_ESTEIRA_TR).selection,
      );
      await simulator.fillSimulationData({
        propertyValueCents: "150000000",
        financingValueCents: "50000000",
        termMonths: 120,
        amortizationSystem: "SAC - Sistema de amortizacao constante",
        gracePeriodDays: 30,
        birthDateDigits: "3102200",
        netIncomeCents: "5000000",
        composeIncome: false,
      });

      await simulator.submitDataStep();

      await expect(simulator.dataStepAlerts()).toHaveCount(1);
      await expect(page).toHaveURL(/\/dados-simulacao$/);
      expect(apiActivity.allowedWrites).toEqual([]);
    },
  );
});

test.describe("Simulador | Dados | data inexistente (31/02/2001)", () => {
  const impossibleDate = async (
    simulator: Parameters<Parameters<typeof test>[2]>[0]["simulator"],
  ): Promise<void> => {
    await simulator.chooseJourney(
      observedJourney(PF_RESIDENTIAL_ESTEIRA_TR).selection,
    );
    await simulator.fillSimulationData({
      propertyValueCents: "150000000",
      financingValueCents: "50000000",
      termMonths: 120,
      amortizationSystem: "SAC - Sistema de amortizacao constante",
      gracePeriodDays: 30,
      birthDateDigits: "31022001",
      netIncomeCents: "5000000",
      composeIncome: false,
    });
    await simulator.submitDataStep();
  };

  test(
    "não avança e o usuário vê um erro",
    { tag: tags, annotation: matrix("SIM-DATA-21") },
    async ({ page, simulator }) => {
      await impossibleDate(simulator);

      await expect(simulator.dataStepAlerts()).toHaveCount(1);
      await expect(page).toHaveURL(/\/dados-simulacao$/);
      await expect(simulator.dataField("Data de nascimento")).toHaveValue(
        "31/02/2001",
      );
    },
  );

  test(
    "é recusada no formulário, sem enviar a data inexistente ao backend",
    {
      tag: tags,
      annotation: [
        matrix("SIM-DATA-21"),
        {
          type: "issue",
          description:
            "Defeito observado em portal-desenv (09/11/2026): o front aceita 31/02/2001, envia " +
            '"dataNascimento":"2001-02-31" para POST /api/simulacao/tipo-operacao e o backend ' +
            'responde 400 "Failed to read request"; o usuário vê só "Nao foi possivel ' +
            'identificar o tipo de operacao. Tente novamente.". Este teste FALHA enquanto o defeito existir.',
        },
      ],
    },
    async ({ simulator, apiActivity }) => {
      await impossibleDate(simulator);

      await expect(simulator.dataStepAlerts()).toHaveCount(1);
      expect(apiActivity.allowedWrites).toEqual([]);
    },
  );
});

test.describe("Simulador | Dados | composição de renda", () => {
  test(
    "co-adquirente exige data e renda e some ao desmarcar",
    { tag: tags, annotation: matrix("SIM-DATA-24 / 25 / 26") },
    async ({ page, simulator, apiActivity }) => {
      await simulator.chooseJourney(
        observedJourney(PF_RESIDENTIAL_ESTEIRA_TR).selection,
      );
      const coBirth = simulator.dataField("Data de nascimento (co-adquirente)");
      const coIncome = simulator.dataField("Renda do co-adquirente");

      await expect(simulator.composeIncomeCheckbox).not.toBeChecked();
      await expect(coBirth).toHaveCount(0);
      await expect(coIncome).toHaveCount(0);

      await simulator.composeIncomeCheckbox.check();
      await expect(coBirth).toBeVisible();
      await expect(coIncome).toBeVisible();

      await simulator.fillSimulationData({
        propertyValueCents: "150000000",
        financingValueCents: "50000000",
        termMonths: 120,
        amortizationSystem: "SAC - Sistema de amortizacao constante",
        gracePeriodDays: 30,
        birthDateDigits: birthDigits(30),
        netIncomeCents: "5000000",
        composeIncome: true,
      });
      await simulator.submitDataStep();

      await expect(simulator.dataStepAlerts()).toHaveText([
        "Data de nascimento do co-adquirente invalida.",
        "Informe a renda do co-adquirente.",
      ]);
      await expect(page).toHaveURL(/\/dados-simulacao$/);
      expect(apiActivity.allowedWrites).toEqual([]);

      await simulator.composeIncomeCheckbox.uncheck();
      await expect(coBirth).toHaveCount(0);
      await expect(coIncome).toHaveCount(0);
      await expect(simulator.dataStepAlerts()).toHaveCount(0);
    },
  );
});
