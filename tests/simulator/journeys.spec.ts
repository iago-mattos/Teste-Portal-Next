import {
  OBSERVED_SIMULATOR_JOURNEYS,
  OBSERVED_SIMULATOR_MENU,
} from "../test-data/simulator-journeys";
import { scciJourney } from "../test-data/scci-reference";
import { expect, observedJourney, test } from "./simulator.fixture";

/**
 * SIM-NAV-04..13, 14 e 15 — navegação das jornadas do Simulador, sem envio.
 * Natureza: backend real, leitura. Contrato OBSERVADO em portal-desenv
 * (09/11/2026); a matriz de combinações permitidas aguarda Produto.
 */
const matrix = (id: string) => ({ type: "matriz", description: id });

/**
 * Um contrato por regra: este arquivo congela só a NAVEGAÇÃO observada. A
 * visibilidade do campo Carência é responsabilidade de grace-visibility.spec.ts
 * e a existência de jornadas com grupo suspenso, de suspended-modalities.spec.ts.
 * Os casos que atravessam um grupo suspenso levam a tag @depende-decisao: o
 * verde só descreve o comportamento de hoje e não entra no conjunto validador
 * (`--grep-invert @depende-decisao`). Quando Produto decidir que a modalidade
 * suspensa não deve aparecer, esses casos mudam junto com o produto.
 */
const SUSPENDED_JOURNEY_IDS = new Set(
  OBSERVED_SIMULATOR_JOURNEYS.filter(
    (journey) => scciJourney(journey.id).suspendedGroups.length > 0,
  ).map((journey) => journey.id),
);
/**
 * Prefixos do menu a partir do PRIMEIRO passo suspenso da jornada: só o nó que
 * oferece o grupo suspenso e os nós abaixo dele dependem da decisão. Os menus
 * acima (ex.: Modalidade, Financiamento Imobiliário) não mudam se Produto ocultar
 * a modalidade suspensa e continuam no conjunto validador.
 */
const SUSPENDED_PREFIXES = new Set(
  [...SUSPENDED_JOURNEY_IDS].flatMap((id) => {
    const steps = id.split(" > ");
    const suspendedNames = new Set(
      scciJourney(id).suspendedGroups.map((group) =>
        group.replace(/^\S+\s+/, "").trim(),
      ),
    );
    const first = steps.findIndex((step) => suspendedNames.has(step));
    if (first < 0) return [];
    return steps
      .map((_, index) => steps.slice(0, index + 1).join(" > "))
      .filter((_, index) => index >= first);
  }),
);
const dependsOnSuspendedDecision = {
  type: "dependencia",
  description:
    "Atravessa grupo suspenso no SCCI: descreve o comportamento atual; muda se Produto decidir ocultar a modalidade suspensa.",
};

test.describe("Simulador | menu de jornadas", () => {
  for (const node of OBSERVED_SIMULATOR_MENU) {
    const where = node.path.length > 0 ? node.path.join(" > ") : "Modalidade";
    const touchesSuspended = node.options.some((option) =>
      SUSPENDED_PREFIXES.has([...node.path, option].join(" > ")),
    );
    test(
      `oferece exatamente as opções esperadas em ${where}`,
      {
        tag: touchesSuspended
          ? ["@readonly", "@simulator", "@depende-decisao"]
          : ["@readonly", "@simulator"],
        annotation: touchesSuspended
          ? [matrix("SIM-NAV-04..13"), dependsOnSuspendedDecision]
          : matrix("SIM-NAV-04..13"),
      },
      async ({ simulator }) => {
        await simulator.choosePath(node.path);

        await expect
          .poll(async () => (await simulator.visibleOptions()).sort(), {
            message: `Opções divergentes em ${where}.`,
          })
          .toEqual([...node.options].sort());
      },
    );
  }
});

test.describe("Simulador | chegada à tela Dados por jornada", () => {
  for (const journey of OBSERVED_SIMULATOR_JOURNEYS) {
    const suspended = SUSPENDED_JOURNEY_IDS.has(journey.id);
    test(
      `leva aos Dados com os rótulos da jornada: ${journey.id}`,
      {
        tag: suspended
          ? ["@readonly", "@simulator", "@depende-decisao"]
          : ["@readonly", "@simulator"],
        annotation: suspended
          ? [matrix("SIM-NAV-04..13, SIM-DATA-28"), dependsOnSuspendedDecision]
          : matrix("SIM-NAV-04..13, SIM-DATA-28"),
      },
      async ({ page, simulator }) => {
        await simulator.chooseJourney(journey.selection);

        await expect(page).toHaveURL(/\/dados-simulacao$/);
        await simulator.expectDataScreen(journey.dataScreen);

        if (journey.selection.borrowerType === "Pessoa Jurídica") {
          await expect(
            simulator.dataField("Valor do financiamento"),
          ).toHaveCount(0);
          await expect(simulator.dataField("Renda liquida")).toHaveCount(0);
        } else {
          await expect(simulator.dataField("Valor do emprestimo")).toHaveCount(0);
          await expect(simulator.dataField("Faturamento liquido")).toHaveCount(0);
        }

        for (const months of [120, 180, 240, 300, 360, 420]) {
          await expect(
            page.getByRole("radio", { name: `${months} meses`, exact: true }),
          ).toBeVisible();
        }
        await expect(simulator.amortizationSelect).toBeVisible();
        // Carência: visibilidade é contrato de grace-visibility.spec.ts.
      },
    );
  }
});

test.describe("Simulador | voltar e trocar escolhas", () => {
  test(
    "Voltar retorna uma etapa por vez até a modalidade, preservando as opções de cada etapa",
    { tag: ["@readonly", "@simulator"], annotation: matrix("SIM-NAV-14") },
    async ({ page, simulator }) => {
      const journey = observedJourney(
        "Financiamento Imobiliário > Pessoa Física > Imóvel Residencial > Imóvel Particular > Taxa Referencial (TR)",
      );
      const steps = simulator.journeySteps(journey.selection);
      await simulator.choosePath(steps.slice(0, -1));

      // Etapa atual: indexador. Cada Voltar mostra as opções do passo anterior.
      for (let depth = steps.length - 1; depth >= 1; depth -= 1) {
        await simulator.goBackOneStep();
        const expected = OBSERVED_SIMULATOR_MENU.find(
          (node) => node.path.join("|") === steps.slice(0, depth - 1).join("|"),
        );
        if (!expected) throw new Error(`Menu observado ausente para a etapa ${depth}.`);
        await expect
          .poll(async () => (await simulator.visibleOptions()).sort())
          .toEqual([...expected.options].sort());
      }

      await expect(page).toHaveURL(/\/menu-simulacao$/);
      await expect(
        page
          .getByRole("banner")
          .getByRole("button", { name: "Voltar", exact: true }),
      ).toHaveCount(0);
    },
  );

  test(
    "trocar PF por PJ depois de voltar não carrega rótulos nem escolhas da jornada anterior",
    { tag: ["@readonly", "@simulator"], annotation: matrix("SIM-NAV-15") },
    async ({ page, simulator }) => {
      const first = observedJourney(
        "Financiamento Imobiliário > Pessoa Física > Imóvel Comercial > Imóvel Particular > Índice de Preços ao Consumidor Amplo (IPCA)",
      );
      const second = observedJourney(
        "Financiamento Imobiliário > Pessoa Jurídica > Imóvel Residencial > Holding Familiar",
      );

      const firstSteps = simulator.journeySteps(first.selection);
      await simulator.choosePath(firstSteps.slice(0, -1));
      // Volta quatro etapas (indexador → origem → imóvel → comprador → modalidade).
      for (let step = 0; step < 4; step += 1) await simulator.goBackOneStep();
      await expect(page).toHaveURL(/\/menu-simulacao$/);
      await expect
        .poll(async () => (await simulator.visibleOptions()).sort())
        .toEqual(["Crédito Garantia de Imóvel", "Financiamento Imobiliário"]);

      await simulator.chooseJourney(second.selection);

      await expect(page).toHaveURL(/\/dados-simulacao$/);
      await simulator.expectDataScreen(second.dataScreen);
      await expect(
        page.getByRole("main").getByText(/Índice de Preços ao Consumidor Amplo/i),
      ).toHaveCount(0);
      await expect(simulator.dataField("Valor do financiamento")).toHaveCount(0);
    },
  );
});
