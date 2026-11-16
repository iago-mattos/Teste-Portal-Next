/**
 * Gate de mutação no próprio teste. O opt-in também existe no script npm
 * (`scripts/require-mutation-opt-in.mjs`), mas `playwright test` direto ou
 * `npm run pw:test` não passam por ele; por isso o teste que cria proposta
 * confere a variável antes de qualquer navegação ou reserva de registro.
 * Mesmo contrato e mensagem de `tests/fixtures/scenario.fixture.ts`.
 */
export function assertMutationOptIn(): void {
  if (process.env.ALLOW_TEST_MUTATION !== "true") {
    throw new Error(
      "Execucao bloqueada: defina ALLOW_TEST_MUTATION=true para autorizar alteracoes em propostas de QA.",
    );
  }
}
