import { portalTest } from "./portal.fixture";

/**
 * Interface que expõe o mecanismo de registro de limpezas (teardown).
 */
export interface TeardownRegistry {
  /**
   * Adiciona uma função de limpeza assíncrona a ser executada ao final do teste.
   * As funções são chamadas em ordem LIFO (Last-In, First-Out), garantindo
   * que dependências criadas por último sejam desfeitas primeiro.
   *
   * @param cleanupFn Função assíncrona que executa a limpeza do estado persistente ou UI.
   */
  add(cleanupFn: () => Promise<void>): void;
}

export interface ScenarioFixtures {
  /**
   * Fixture para gerenciar o ciclo de vida (setup/teardown) de cenários mutáveis.
   *
   * **Responsabilidade:**
   * Centralizar e garantir a execução de limpezas de dados de testes que fazem
   * alterações persistentes (mutações) na base de dados de QA, mesmo em caso de falha no teste.
   *
   * **Funcionamento:**
   * - O teste ou beforeEach registra ações de limpeza via `teardownRegistry.add(async () => { ... })`.
   * - Ao final da execução do teste, o Playwright executa o bloco de teardown da fixture.
   * - Os callbacks registrados são executados na ordem reversa de seu registro (LIFO).
   * - Cada cleanup é envolvido em try/catch individual para evitar que a falha de um impeça os demais.
   *
   * **Quando UTILIZAR:**
   * - Testes funcionais ou de integração que alteram o banco de dados via API ou UI (tags `@mutation` ou `@integration`).
   * - Fluxos que alteram estados globais da proposta que precisam ser resetados para não contaminar execuções futuras.
   *
   * **Quando NÃO UTILIZAR:**
   * - Testes puramente de leitura (`@readonly`), onde nenhuma gravação ou alteração persistente é realizada.
   * - Ações temporárias de UI que não persistem estado no servidor e não interferem em outros cenários.
   */
  teardownRegistry: TeardownRegistry;
  mutationGate: void;
}

export const scenarioTest = portalTest.extend<ScenarioFixtures>({
  teardownRegistry: async (
    // eslint-disable-next-line no-empty-pattern
    {},
    use,
  ) => {
    const cleanups: (() => Promise<void>)[] = [];

    const registry: TeardownRegistry = {
      add(cleanupFn) {
        cleanups.push(cleanupFn);
      },
    };

    // Fornece o registry ao teste
    await use(registry);

    // Executa os cleanups na ordem LIFO (Last-In, First-Out)
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (err) {
        console.error("[TeardownRegistry] Erro ao executar limpeza do cenario mutavel:", err);
      }
    }
  },

  mutationGate: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, testInfo) => {
      const isMutation = testInfo.tags.includes("@mutation");
      if (isMutation && process.env.ALLOW_TEST_MUTATION !== "true") {
        throw new Error(
          "Execucao bloqueada: defina ALLOW_TEST_MUTATION=true para autorizar alteracoes em propostas de QA.",
        );
      }
      await use();
    },
    { auto: true },
  ],
});
