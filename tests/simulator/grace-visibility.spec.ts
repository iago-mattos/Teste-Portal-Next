import { OBSERVED_SIMULATOR_JOURNEYS } from "../test-data/simulator-journeys";
import { scciJourney } from "../test-data/scci-reference";
import { expect, test } from "./simulator.fixture";

/**
 * SIM-DATA-17 / SIM-DATA-18 — o campo "Carencia" da tela Dados só deve aparecer
 * quando o tipo de operação da jornada tem carência cadastrada no SCCI
 * (Manutenção > Tabelas > Originação > Tipo de operação > Carências).
 *
 * Contrato informado por Iago Mattos após conversa com Castilho (Mestre da
 * Originação): digitar/escolher o valor na tela e a lista no admin estão certos;
 * o ERRO é o campo aparecer SEMPRE. Ele deve aparecer em momento específico,
 * controlado por cadastro do SCCI na parte de Originação (tipo de operação ou
 * outra tabela). Fonte adotada aqui: Tipo de operação > Carências (HIPÓTESE do
 * local; confirmar com o Castilho). Nenhum dos 93 tipos lidos no esteira-ht
 * (45 das jornadas e 48 de amostra) tem carência cadastrada.
 *
 * Natureza: backend real, leitura. O teste FALHA enquanto o campo aparecer em
 * jornadas cujo tipo não tem carência cadastrada.
 *
 * Observação (09/11/2026): a carência escolhida é enviada na requisição da tela de
 * Resultado (POST /api/simulacao/planilha, campo prazoCarencia; ausente quando
 * "Selecione"), mas os valores saem iguais com 30, 60, 90 e sem carência, no
 * Simulador e no SCCI (conferência pedida pelo Castilho). Ver
 * tests/integrations/simulator-journeys/grace-values-in-scci.spec.ts.
 */
test(
  "o campo Carência só aparece quando o tipo da jornada tem carência cadastrada no SCCI",
  {
    // @pendente-produto: o local do cadastro da carência é hipótese e o leitor do
    // SCCI não tem controle positivo (nenhum tipo com carência). Fica fora do
    // conjunto validador até o Castilho confirmar o local e existir um tipo com carência.
    tag: ["@readonly", "@simulator", "@pendente-produto"],
    annotation: [
      { type: "matriz", description: "SIM-DATA-17 / SIM-DATA-18" },
      {
        type: "issue",
        description:
          "Defeito do Portal (Castilho, Mestre da Originação): o campo de carência aparece sempre; deveria depender de cadastro do SCCI (local a confirmar).",
      },
    ],
  },
  async ({ page, simulator }, testInfo) => {
    test.setTimeout(10 * 60_000);
    const wrong: string[] = [];
    const report: Array<{ journey: string; cadastrada: boolean; campoVisivel: boolean }> = [];

    for (const journey of OBSERVED_SIMULATOR_JOURNEYS) {
      const configured = scciJourney(journey.id).operationTypes.some(
        (type) => type.graceRules.length > 0,
      );
      await simulator.open();
      await simulator.startNewSimulation();
      await simulator.chooseJourney(journey.selection);
      await expect(simulator.simulationDataHeading).toBeVisible();
      // Espera o formulário terminar de renderizar (campos vizinhos visíveis)
      // antes de decidir que a Carência está oculta.
      await expect(simulator.amortizationSelect).toBeVisible();
      await expect(
        page.getByRole("radio", { name: "120 meses", exact: true }),
      ).toBeVisible();
      const visible = (await simulator.gracePeriodSelect.count()) > 0;
      report.push({ journey: journey.id, cadastrada: configured, campoVisivel: visible });
      if (visible !== configured) {
        wrong.push(
          `${journey.id}: campo ${visible ? "visível" : "oculto"}, carência ${configured ? "cadastrada" : "não cadastrada"} no SCCI`,
        );
      }
    }

    await testInfo.attach("visibilidade-da-carencia", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
    expect(
      wrong,
      `${wrong.length} de ${OBSERVED_SIMULATOR_JOURNEYS.length} jornadas com o campo Carência em desacordo com o cadastro do SCCI.`,
    ).toEqual([]);
  },
);
