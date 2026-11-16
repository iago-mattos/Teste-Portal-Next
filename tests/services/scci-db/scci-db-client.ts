import { execFile } from "node:child_process";
import type { ScciDbConfig } from "../../config/scci-db-config";
import {
  assertNoOracleError,
  buildRemoteScript,
  isTransientSshFailure,
  parseSqlplusRows,
  type ScciDbRow,
} from "./sqlplus-script";

export interface ScciQueryOptions {
  readonly timeoutMs?: number;
}

/** Forma de `queryScci`; os testes unitários injetam um executor falso. */
export type ScciQueryRunner = <C extends string>(
  config: ScciDbConfig,
  sql: string,
  columns: readonly C[],
  options?: ScciQueryOptions,
) => Promise<ScciDbRow<C>[]>;

/** Remove o banner do servidor e corta, para mensagens de erro legíveis. */
function summarizeStderr(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== "Prognum Informatica S.A.")
    .join(" | ")
    .slice(0, 500);
}

class ScciTransportError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
  }
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3_000;

function runSshOnce(
  config: ScciDbConfig,
  script: string,
  options: ScciQueryOptions,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = execFile(
      "ssh",
      ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", config.sshHost, "bash -s"],
      {
        encoding: "latin1",
        timeout: options.timeoutMs ?? 60_000,
        maxBuffer: 16 * 1024 * 1024,
      },
      (error, out, err) => {
        if (!error) {
          resolve(out);
          return;
        }
        // Erro do Oracle sai no stdout (WHENEVER SQLERROR): mostra o ORA-xxxxx.
        try {
          assertNoOracleError(out);
        } catch (oracleError) {
          reject(oracleError);
          return;
        }
        reject(
          new ScciTransportError(
            `Falha ao consultar o SCCI via ssh ${config.sshHost} (codigo ${String(error.code ?? error.signal)}): ${summarizeStderr(err) || error.message}`,
            isTransientSshFailure(error.code, err),
          ),
        );
      },
    );
    child.stdin?.end(Buffer.from(script, "latin1"));
  });
}

/**
 * Executa um SELECT no Oracle do SCCI via `ssh <host> bash -s` + sqlplus.
 * O script vai por stdin em ISO-8859-1 (o NLS_LANG do servidor) e a saída é
 * lida no mesmo encoding. Somente leitura: ver sqlplus-script.ts.
 *
 * Só a falha transitória do ssh (salto pela desenv sem abrir a sessão) é repetida,
 * até 3 tentativas. Como é leitura, repetir não duplica nada. Erro do Oracle e
 * falha de autenticação sobem na hora.
 */
export async function queryScci<C extends string>(
  config: ScciDbConfig,
  sql: string,
  columns: readonly C[],
  options: ScciQueryOptions = {},
): Promise<ScciDbRow<C>[]> {
  const script = buildRemoteScript(config, sql, columns);

  for (let attempt = 1; ; attempt += 1) {
    try {
      return parseSqlplusRows(await runSshOnce(config, script, options), columns);
    } catch (error) {
      const retry = error instanceof ScciTransportError && error.transient && attempt < MAX_ATTEMPTS;
      if (!retry) {
        if (error instanceof ScciTransportError && attempt > 1) {
          throw new Error(`${error.message} (apos ${attempt} tentativas)`);
        }
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}
