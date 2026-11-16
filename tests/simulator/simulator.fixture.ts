import { expect, test as base } from "@playwright/test";
import {
  readSimulatorRules,
  type SimulatorRules,
} from "./support/simulator-rules";
import { PortalSimulatorPage } from "../pages/portal/portal-simulator.page";
import { OBSERVED_SIMULATOR_JOURNEYS } from "../test-data/simulator-journeys";
import type { ObservedJourney } from "../types/simulator";

/**
 * O Simulador é público e esta suíte é SOMENTE LEITURA. A única escrita HTTP
 * permitida são as consultas de cálculo disparadas por "Avancar" na tela Dados
 * (classificação do tipo de operação e evolução da simulação); elas não
 * persistem proposta, MAS a evolução grava uma linha em SIMULACAO_ORIGINACAO no
 * SCCI (medido em 12/11/2026 com a leitura do banco: nuSimulacao/nuSessao da
 * resposta existem na tabela, com os valores digitados). Qualquer outra escrita (POST/PUT/
 * PATCH/DELETE) é abortada e reprova o teste, de modo que nenhum caso daqui
 * consegue enviar uma proposta, mesmo se um passo futuro avançar demais.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// `/api/simulacao/planilha` (tela de Resultado) NÃO é permitido: leva um
// `nuSimulacao` e pode gravar o registro da simulação no SCCI.
const ALLOWED_WRITE_PATHS = new Set([
  "/api/simulacao/tipo-operacao",
  "/api/simulacao/evolucao",
]);

export interface SimulatorApiActivity {
  /** Escritas permitidas que o front realmente disparou, como "POST /caminho". */
  readonly allowedWrites: string[];
  /** Escritas abortadas pela trava; deve permanecer vazio. */
  readonly blockedWrites: string[];
}

export interface SimulatorFixtures {
  apiActivity: SimulatorApiActivity;
  simulator: PortalSimulatorPage;
  rules: SimulatorRules;
}

export const test = base.extend<SimulatorFixtures>({
  apiActivity: async ({ page }, use) => {
    const activity: SimulatorApiActivity = {
      allowedWrites: [],
      blockedWrites: [],
    };

    await page.route("**/*", async (route) => {
      const request = route.request();
      if (SAFE_METHODS.has(request.method())) {
        await route.fallback();
        return;
      }

      const label = `${request.method()} ${new URL(request.url()).pathname}`;
      if (ALLOWED_WRITE_PATHS.has(new URL(request.url()).pathname)) {
        activity.allowedWrites.push(label);
        await route.fallback();
        return;
      }

      activity.blockedWrites.push(label);
      await route.abort("blockedbyclient");
    });

    await use(activity);

    expect(
      activity.blockedWrites,
      "A suíte somente leitura do Simulador tentou escrever fora da consulta permitida.",
    ).toEqual([]);
  },

  rules: async ({ request }, use) => {
    await use(await readSimulatorRules(request));
  },

  simulator: async ({ page, apiActivity }, use) => {
    void apiActivity; // garante a trava ativa antes de qualquer navegação
    const simulator = new PortalSimulatorPage(page);
    await simulator.open();
    await simulator.startNewSimulation();
    await use(simulator);
  },
});

export { expect };

export function observedJourney(id: string): ObservedJourney {
  const journey = OBSERVED_SIMULATOR_JOURNEYS.find((item) => item.id === id);
  if (!journey) throw new Error(`Jornada observada inexistente: ${id}.`);
  return journey;
}

export const PF_RESIDENTIAL_ESTEIRA_TR =
  "Financiamento Imobiliário > Pessoa Física > Imóvel Residencial > Imóvel da Esteira Digital > Taxa Referencial (TR)";
