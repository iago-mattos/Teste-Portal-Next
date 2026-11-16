import { OBSERVED_SIMULATOR_JOURNEYS } from "../test-data/simulator-journeys";
import { scciJourney } from "../test-data/scci-reference";
import { expect, test } from "./simulator.fixture";

/**
 * Modalidade suspensa — um grupo marcado como "Modalidade suspensa" no SCCI
 * (Tabelas > Originação > Grupos de tipos de operação) não deve aparecer no
 * Simulador. Expectativa informada por Iago Mattos ("não deve aparecer no
 * simulador, né?"); confirmação final de Produto pendente. Natureza: backend real,
 * leitura (só navegação pelo menu, sem cálculo).
 *
 * O teste FALHA enquanto uma jornada com grupo suspenso na cadeia puder ser
 * percorrida até a tela Dados.
 */
test(
  "jornadas com grupo suspenso no SCCI não podem ser percorridas no Simulador",
  {
    // @pendente-produto: o significado de "Modalidade suspensa" não foi confirmado.
    tag: ["@readonly", "@simulator", "@pendente-produto"],
    annotation: [
      { type: "matriz", description: "Modalidade suspensa" },
      {
        type: "issue",
        description:
          "Grupos 005 e 023 (Imóvel Residencial) e 115 (Holding Familiar) estão suspensos no SCCI e continuam disponíveis no Simulador.",
      },
    ],
  },
  async ({ simulator, page }, testInfo) => {
    test.setTimeout(12 * 60_000);

    /** Percorre o menu até a tela Dados; `false` se alguma etapa não for oferecida. */
    async function canReach(journey: (typeof OBSERVED_SIMULATOR_JOURNEYS)[number]): Promise<boolean> {
      await simulator.open();
      await simulator.startNewSimulation();
      for (const step of simulator.journeySteps(journey.selection)) {
        const option = page.getByRole("button", { name: step, exact: true });
        const offered = await expect(option)
          .toHaveCount(1, { timeout: 5_000 })
          .then(() => true)
          .catch(() => false);
        if (!offered) return false;
        await option.click();
      }
      return page
        .waitForURL(/\/dados-simulacao$/, { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
    }

    // Controle positivo: uma jornada SEM grupo suspenso deve ser detectada como acessível.
    const control = OBSERVED_SIMULATOR_JOURNEYS.find(
      (journey) => scciJourney(journey.id).suspendedGroups.length === 0,
    );
    if (!control) throw new Error("Sem jornada de controle sem grupo suspenso.");
    expect(
      await canReach(control),
      `Controle positivo: a jornada ${control.id} deve ser acessível; senão o detector está quebrado.`,
    ).toBe(true);

    const suspended = OBSERVED_SIMULATOR_JOURNEYS.filter(
      (journey) => scciJourney(journey.id).suspendedGroups.length > 0,
    );
    expect(suspended.length, "O snapshot deve ter jornadas com grupo suspenso.").toBeGreaterThan(0);

    const reachable: string[] = [];
    for (const journey of suspended) {
      if (await canReach(journey)) {
        reachable.push(
          `${journey.id}  [suspensos: ${scciJourney(journey.id).suspendedGroups.join(", ")}]`,
        );
      }
    }

    await testInfo.attach("jornadas-suspensas-acessiveis", {
      body: reachable.join("\n"),
      contentType: "text/plain",
    });
    expect(
      reachable,
      `${reachable.length} de ${suspended.length} jornadas com grupo suspenso no SCCI podem ser percorridas no Simulador.`,
    ).toEqual([]);
  },
);
