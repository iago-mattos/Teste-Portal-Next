import { expect, observedJourney, PF_RESIDENTIAL_ESTEIRA_TR, test } from "./simulator.fixture";

/**
 * SIM-DATA-04, 11, 12, 13, 17 — regras do admin (Simulador > Limites e Regras)
 * refletidas na tela Dados. Natureza: backend real, leitura. Os limites vêm da
 * configuração do admin lida em tempo de execução. Fronteiras que ficam
 * bloqueadas pelo próprio formulário não chamam o backend (usam financiamento
 * maior que o imóvel como trava).
 */
const matrix = (id: string) => ({ type: "matriz", description: id });
const tags = ["@readonly", "@simulator"];

const GUARD_MESSAGE = "Valor financiado superior ao valor do imovel.";
const MIN_PROPERTY_MESSAGE = "Valor do imovel abaixo do minimo permitido.";

function cents(reais: number, extraCents = 0): string {
  return String(Math.round(reais * 100) + extraCents);
}

test.describe("Simulador | admin | valor mínimo do imóvel", () => {
  const cases = [
    { name: "um centavo abaixo do mínimo é recusado", delta: -1, blocked: true },
    { name: "exatamente o mínimo é aceito", delta: 0, blocked: false },
    { name: "um centavo acima do mínimo é aceito", delta: 1, blocked: false },
  ] as const;

  for (const item of cases) {
    test(
      item.name,
      { tag: tags, annotation: matrix("SIM-DATA-04") },
      async ({ page, simulator, rules, apiActivity }) => {
        await simulator.chooseJourney(
          observedJourney(PF_RESIDENTIAL_ESTEIRA_TR).selection,
        );
        await simulator.fillSimulationData({
          propertyValueCents: cents(rules.valorMinImovel, item.delta),
          // Financiamento maior que o imóvel: o formulário nunca avança.
          financingValueCents: cents(rules.valorMinImovel + 10_000),
          termMonths: 120,
          amortizationSystem: "SAC - Sistema de amortizacao constante",
          gracePeriodDays: 30,
          birthDateDigits: "01012001",
          netIncomeCents: "5000000",
          composeIncome: false,
        });

        await simulator.submitDataStep();

        await expect(
          simulator.dataStepAlerts().filter({ hasText: GUARD_MESSAGE }),
        ).toHaveCount(1);
        await expect(
          simulator.dataStepAlerts().filter({ hasText: MIN_PROPERTY_MESSAGE }),
        ).toHaveCount(item.blocked ? 1 : 0);
        await expect(page).toHaveURL(/\/dados-simulacao$/);
        expect(apiActivity.allowedWrites).toEqual([]);
      },
    );
  }
});

test.describe("Simulador | admin | prazo customizado", () => {
  const cases = (min: number, max: number) =>
    [
      { term: min - 1, message: `Prazo mínimo: ${min} meses.` },
      { term: min, message: undefined },
      { term: max, message: undefined },
      { term: max + 1, message: `Prazo máximo: ${max} meses.` },
    ] as const;

  for (const position of [0, 1, 2, 3] as const) {
    test(
      `limites do admin — caso ${["abaixo do mínimo", "no mínimo", "no máximo", "acima do máximo"][position]}`,
      { tag: tags, annotation: matrix("SIM-DATA-13") },
      async ({ page, simulator, rules, apiActivity }) => {
        const item = cases(rules.prazoMinimo, rules.prazoMaximo)[position];
        await simulator.chooseJourney(
          observedJourney(PF_RESIDENTIAL_ESTEIRA_TR).selection,
        );
        await simulator.fillSimulationData({
          propertyValueCents: "10000000",
          financingValueCents: "20000000", // trava: financiamento > imóvel
          termMonths: 120,
          amortizationSystem: "SAC - Sistema de amortizacao constante",
          gracePeriodDays: 30,
          birthDateDigits: "01012001",
          netIncomeCents: "5000000",
          composeIncome: false,
        });
        await simulator.customTermInput.fill(String(item.term));

        await simulator.submitDataStep();

        const termAlert = simulator
          .dataStepAlerts()
          .filter({ hasText: /^Prazo (mínimo|máximo):/ });
        if (item.message) {
          // Prazo fora dos limites: o formulário mostra só o erro do prazo.
          await expect(termAlert).toHaveText([item.message]);
        } else {
          // Prazo válido: a validação seguiu e parou na trava de valores.
          await expect(
            simulator.dataStepAlerts().filter({ hasText: GUARD_MESSAGE }),
          ).toHaveCount(1);
          await expect(termAlert).toHaveCount(0);
        }
        await expect(page).toHaveURL(/\/dados-simulacao$/);
        expect(apiActivity.allowedWrites).toEqual([]);
      },
    );
  }
});

test.describe("Simulador | admin | opções de prazo e carência", () => {
  test(
    "os botões de prazo (e a lista de carência, quando exibida) coincidem com o admin",
    { tag: tags, annotation: matrix("SIM-DATA-11 / SIM-DATA-17") },
    async ({ page, simulator, rules }) => {
      await simulator.chooseJourney(
        observedJourney(PF_RESIDENTIAL_ESTEIRA_TR).selection,
      );

      await expect(page.getByRole("radio")).toHaveCount(
        rules.valoresPrazo.length,
      );
      for (const months of rules.valoresPrazo) {
        await expect(
          page.getByRole("radio", { name: `${months} meses`, exact: true }),
        ).toBeVisible();
      }

      // A visibilidade do campo Carência é contrato de grace-visibility.spec.ts.
      // Quando o campo é exibido, as opções devem coincidir com o admin; o valor 0
      // aparece como o item "Selecione" (carência opcional).
      if ((await simulator.gracePeriodSelect.count()) === 0) {
        test.info().annotations.push({
          type: "carencia-ausente",
          description:
            "A tela Dados não exibe o campo Carência nesta jornada; a lista do admin não foi comparada.",
        });
        return;
      }
      const graceOptions = await simulator.gracePeriodSelect
        .locator("option")
        .allInnerTexts();
      expect(graceOptions.map((text) => text.trim())).toEqual(
        rules.valoresCampoCarencia.map((days) =>
          days === 0 ? "Selecione" : String(days),
        ),
      );
    },
  );
});
