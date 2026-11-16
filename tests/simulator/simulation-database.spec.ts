import { mergeTests } from "@playwright/test";
import { scciDbTest } from "../fixtures/scci-db.fixture";
import {
  classifyInsurerCards,
  describeUnnamedCards,
  parseEvolutionResponse,
  screenMismatches,
} from "../services/scci-db/insurer-registry";
import { OBSERVED_SIMULATOR_JOURNEYS } from "../test-data/simulator-journeys";
import { uniqueSimulationInput } from "../test-data/simulation-database-input";
import { expect, test as simulatorTest } from "./simulator.fixture";

const test = mergeTests(simulatorTest, scciDbTest);

/**
 * Simulador x banco do SCCI, por jornada (SIM-DB-01 / SIM-DB-02). Natureza:
 * backend real; SOMENTE `SELECT` no banco. ATENÇÃO: o "Avançar" da tela Dados GRAVA
 * uma linha em SIMULACAO_ORIGINACAO no SCCI (medido em 12/11/2026): nenhuma
 * proposta, mas cada execução deste arquivo grava 24 simulações de teste
 * (tag @grava-simulacao). O projeto simulator-readonly só filtra por @readonly.
 *
 * Como rodar (o Simulador está no portal-desenv; o banco, na cef-mip2):
 *   PW_PROFILE=desenv SCCI_DB_SSH_HOST=cef-mip2 npx playwright test \
 *     --project=simulator-readonly tests/simulator/simulation-database.spec.ts
 * Sem SCCI_DB_SSH_HOST o teste é pulado (aparece como pulado, não passa).
 *
 * SIM-DB-01 — o que o usuário digitou fica gravado. Cada execução e jornada digita
 *   valores ÚNICOS (centavos aleatórios no financiamento e na renda; o imóvel fica
 *   fixo em R$ 1.500.000,00, limite acima do qual o Simulador troca o tipo de
 *   operação: ver tests/test-data/simulation-database-input.ts); a linha da simulação (chave nuSimulacao + nuSessao da resposta de /api/simulacao/evolucao)
 *   precisa trazer esses valores exatos, mais o prazo e o nascimento. O esperado vem
 *   dos dados que o teste enviou, não da resposta. Como os valores só existem nesta
 *   execução, achar a linha com eles prova que (a) a linha foi gravada agora, não
 *   é de uma execução ou jornada anterior, e (b) o portal grava no banco consultado.
 * SIM-DB-02 — as seguradoras da tela vêm do cadastro: todo card existe no cadastro
 *   do tipo de operação (SEGURADORA_TIPO_OPERACAO); a tela mostra tantos cards quanto
 *   o BFF enviou, e o card i traz o nome E a descrição da apólice (plano) que o BFF
 *   enviou para o card i (pega troca de ordem entre apólices); e todo card
 *   tem NOME ACESSÍVEL (o que o navegador calcula; o nome pode estar visível e o
 *   card ficar sem nome para leitor de tela). Repetição de card NÃO reprova aqui (é
 *   hipótese de Produto, em insurers.spec.ts): o teste anexa a origem (cadastro
 *   repetido na base x Simulador) e, para cada card sem nome, índice, chave e se a
 *   seguradora já aparecia antes na lista.
 *
 * Limites: o enquadramento usado na simulação não é gravado na avaliação, então
 * "fora do cadastro" compara com TODAS as linhas do tipo (só reprova oferta que não
 * existe em nenhuma) e a origem de uma repetição fica "indeterminado-enquadramento"
 * quando só linhas de enquadramentos diferentes a explicam. A ordem dos cards da
 * tela é comparada com a da resposta do BFF (mesma ordem observada em 24 jornadas).
 */
const tags = ["@readonly", "@simulator", "@scci-db", "@grava-simulacao"];

test.describe("Simulador | simulação gravada e seguradoras x banco do SCCI", () => {
  test.setTimeout(120_000);

  for (const journey of OBSERVED_SIMULATOR_JOURNEYS) {
    test(
      `grava a simulação digitada e exibe as seguradoras do cadastro: ${journey.id}`,
      {
        tag: tags,
        annotation: { type: "matriz", description: "SIM-DB-01 / SIM-DB-02" },
      },
      async ({ simulator, scciDb }, testInfo) => {
        const { input, expected } = uniqueSimulationInput(journey.selection.borrowerType);
        await simulator.chooseJourney(journey.selection);
        await simulator.fillSimulationData(input, journey.dataScreen);
        await simulator.submitDataStep();
        const outcome = await simulator.waitForInsurerOutcome();
        expect(
          outcome.error,
          "O cálculo deve ser aceito para valores válidos da jornada.",
        ).toBeUndefined();
        const evolution = parseEvolutionResponse(outcome.responseBody ?? "");
        const key = { nuSimulacao: evolution.nuSimulacao, nuSessao: evolution.nuSessao };

        // SIM-DB-01: a simulação desta execução foi gravada com o que foi digitado.
        const saved = await scciDb
          .waitForSimulation(key, { timeoutMs: 30_000, intervalMs: 3_000, queryTimeoutMs: 20_000 })
          .catch((error: unknown) => {
            // "AMBIENTE" só para o estouro da espera; erro de contrato, Oracle etc. sobem como são.
            if (!String(error).includes("nao apareceu em")) throw error;
            throw new Error(
              `AMBIENTE/PRÉ-CONDIÇÃO: a simulação ${evolution.nuSimulacao}/${evolution.nuSessao} devolvida pelo portal não apareceu no banco consultado (ssh ${process.env.SCCI_DB_SSH_HOST ?? "?"}). Banco diferente do portal ou gravação não ocorreu. ${String(error)}`,
            );
          });
        expect
          .soft(saved.vaPrecoImovel, "Valor do imóvel gravado")
          .toBe(expected.property);
        expect
          .soft(saved.vaFinanciamento, "Valor do financiamento gravado (único desta execução)")
          .toBe(expected.financing);
        expect
          .soft(saved.vaRendaFamiliar, "Renda/faturamento gravado (único desta execução)")
          .toBe(expected.income);
        expect.soft(saved.nuPrazoMesesOperacao, "Prazo gravado").toBe(input.termMonths);
        expect
          .soft(saved.dtNascimento1?.slice(0, 10), "Data de nascimento gravada")
          .toBe("2001-01-01");

        // SIM-DB-02: os cards vêm do cadastro do tipo de operação.
        const registry = await scciDb.insurerRegistryForType(evolution.codigoTipoOperacao);
        expect(
          registry.length,
          `O SCCI não tem seguradora cadastrada para o tipo ${evolution.codigoTipoOperacao}.`,
        ).toBeGreaterThan(0);
        const classification = classifyInsurerCards(evolution.cards, registry);

        const accessibleNames = await simulator.insurerAccessibleNames();
        const cardTexts = await simulator.insurerCardTexts();
        expect(
          accessibleNames.length,
          "A tela deve mostrar os mesmos cards que o BFF enviou (quantidade).",
        ).toBe(evolution.cards.length);
        expect(cardTexts.length).toBe(evolution.cards.length);

        const mismatches = screenMismatches(evolution.cards, cardTexts);
        const unnamed = describeUnnamedCards(evolution.cards, accessibleNames);
        // O BFF mandou o nome e a tela não o expõe: defeito da tela.
        const lostOnScreen = unnamed.filter((card) => !card.bffSemNome);
        // O próprio BFF mandou o card sem nome: a origem é o cadastro (SEGURA sem NOME) ou o Simulador.
        const unnamedFromBff = unnamed
          .filter((card) => card.bffSemNome)
          .map((card) => ({
            ...card,
            origem: classification.unnamed.find((item) => item.key === card.key)?.origin ?? "base",
          }));

        await testInfo.attach("seguradoras-x-cadastro", {
          body: JSON.stringify(
            {
              tipoOperacao: evolution.codigoTipoOperacao,
              cardsDaResposta: evolution.cards.length,
              cardsNaTela: accessibleNames.length,
              linhasNoCadastro: registry.length,
              semNomeAcessivelNaTela: lostOnScreen,
              semNomeJaNoBff: unnamedFromBff,
              textoDiferenteDaResposta: mismatches,
              ...classification,
            },
            null,
            2,
          ),
          contentType: "application/json",
        });
        for (const item of classification.repeated) {
          testInfo.annotations.push({
            type: "base-vs-simulador",
            description: `Oferta ${item.key}: ${item.cards} card(s) para ${item.registryRows} linha(s) no cadastro, enquadramentos ${JSON.stringify(item.enquadramentos)} (${item.origin}).`,
          });
        }
        for (const item of unnamed) {
          testInfo.annotations.push({
            type: "sem-nome-acessivel",
            description: `Card ${item.index} (${item.key}): BFF já mandou sem nome: ${item.bffSemNome ? "sim" : "não"}; seguradora já listada antes: ${item.seguradoraJaListada ? "sim" : "não"}; oferta repetida: ${item.ofertaRepetida ? "sim" : "não"}.`,
          });
        }

        expect
          .soft(
            classification.outsideRegistry,
            `Card(s) de seguradora/apólice fora do cadastro do tipo ${evolution.codigoTipoOperacao} do SCCI.`,
          )
          .toEqual([]);
        expect
          .soft(
            mismatches,
            "O texto visível do card i deve trazer o nome que o BFF enviou para o card i.",
          )
          .toEqual([]);
        expect
          .soft(
            lostOnScreen,
            "O BFF enviou o nome, mas há card sem nome acessível na tela (nome visível, sem nome para leitor de tela).",
          )
          .toEqual([]);
        expect
          .soft(
            unnamedFromBff,
            "O BFF enviou card sem nome (origem: base se SEGURA não tem NOME para a seguradora; Simulador se tem).",
          )
          .toEqual([]);
      },
    );
  }
});
