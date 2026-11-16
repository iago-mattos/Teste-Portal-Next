import { OBSERVED_SIMULATOR_JOURNEYS } from "../test-data/simulator-journeys";
import { scciJourney } from "../test-data/scci-reference";
import { expect, test } from "./simulator.fixture";

/**
 * SIM-DATA-15 / SIM-DATA-16 — consistência entre o que o Simulador oferece e o
 * que o SCCI tem cadastrado. Sem navegador: compara as opções do admin (lidas do
 * HTML público) com a tabela "Faixa LTV por tipo de operação" do SCCI (snapshot).
 */
test(
  "todo sistema de amortização oferecido tem faixa de LTV no SCCI em todas as jornadas",
  {
    // @pendente-produto: exigir faixa de LTV de Price em toda jornada é hipótese;
    // ninguém de Produto confirmou que a Price deve funcionar em todas.
    tag: ["@readonly", "@simulator", "@pendente-produto"],
    annotation: { type: "matriz", description: "SIM-DATA-16" },
  },
  async ({ rules }, testInfo) => {
    const missing: string[] = [];
    for (const system of rules.amortizationSystems) {
      for (const journey of OBSERVED_SIMULATOR_JOURNEYS) {
        const covered = scciJourney(journey.id).ltvBands.some(
          (band) => band.amortizationSystem === system.code && !band.inactive,
        );
        if (!covered) missing.push(`${system.label} (código ${system.code}) :: ${journey.id}`);
      }
    }
    await testInfo.attach("jornadas-sem-faixa-de-ltv", {
      body: missing.join("\n"),
      contentType: "text/plain",
    });

    expect(
      missing,
      `${missing.length} combinação(ões) jornada × sistema sem faixa de LTV no SCCI ` +
        "(Originação > Faixa LTV por tipo de operação). O Simulador oferece o sistema, mas o backend recusa o cálculo.",
    ).toEqual([]);
  },
);
