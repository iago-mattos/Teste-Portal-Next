/**
 * Espera com limite de tempo por um registro do SCCI. Cada tentativa abre um ssh
 * e uma sessão do sqlplus (1 a 2 s), então o intervalo mínimo é 1 s. Erro da
 * consulta (ORA-xxxxx, ssh) NÃO é engolido nem repetido: só "ainda não existe"
 * (`undefined`) justifica uma nova tentativa.
 */

export interface WaitForOptions {
  /** O que se espera, para a mensagem de erro (ex.: "simulação 10/2 no SCCI"). */
  readonly description: string;
  readonly timeoutMs: number;
  readonly intervalMs: number;
}

export interface WaitForClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const MIN_POLL_INTERVAL_MS = 1_000;

const realClock: WaitForClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export async function waitFor<T>(
  attempt: () => Promise<T | undefined>,
  options: WaitForOptions,
  clock: WaitForClock = realClock,
): Promise<T> {
  if (options.intervalMs < MIN_POLL_INTERVAL_MS) {
    throw new Error(
      `O intervalo de espera deve ser de pelo menos ${MIN_POLL_INTERVAL_MS} ms (cada consulta abre um ssh).`,
    );
  }

  const startedAt = clock.now();
  for (;;) {
    const value = await attempt();
    if (value !== undefined) return value;
    if (clock.now() - startedAt + options.intervalMs > options.timeoutMs) {
      throw new Error(`Esperando ${options.description}: nao apareceu em ${options.timeoutMs} ms.`);
    }
    await clock.sleep(options.intervalMs);
  }
}
