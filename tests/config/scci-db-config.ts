/**
 * Acesso SOMENTE LEITURA ao Oracle do SCCI para conferir o que o Simulador
 * gravou. A consulta roda no servidor da aplicação (`ssh <host>` + `sqlplus`),
 * que lê usuário e senha do próprio `db.ini` de lá: nenhuma credencial do banco
 * fica neste repositório nem em `.env`.
 *
 * Desligado enquanto SCCI_DB_SSH_HOST não estiver no perfil (`.env.<perfil>.local`).
 * O host precisa entrar sem senha (chave SSH; ver README, "Banco do SCCI").
 */
export interface ScciDbConfig {
  /** Host do ~/.ssh/config (ex.: cef-mip2, que salta pela desenv). */
  readonly sshHost: string;
  /** Alias do tnsnames.ora no servidor (o mesmo `Database=` do db.ini). */
  readonly tnsAlias: string;
  /** db.ini do SCCI no servidor: fonte de UserName/Password. */
  readonly dbIniPath: string;
  /** Script que exporta ORACLE_HOME/NLS_LANG no servidor. */
  readonly oracleEnvPath: string;
  /** Diretório do tnsnames.ora no servidor. */
  readonly tnsAdmin: string;
}

type Env = Readonly<Record<string, string | undefined>>;

const DEFAULTS = {
  tnsAlias: "11g",
  dbIniPath: "/home/caixa/dados/db.ini",
  oracleEnvPath: "/home/caixa/dados/oracle_env.sh",
  tnsAdmin: "/usr/lib/oracle/tns",
} as const;

const SSH_HOST_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.@-]*$/;

function read(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function resolveScciDbConfig(env: Env = process.env): ScciDbConfig | undefined {
  const sshHost = read(env, "SCCI_DB_SSH_HOST");
  if (!sshHost) return undefined;
  if (!SSH_HOST_PATTERN.test(sshHost)) {
    throw new Error(
      "SCCI_DB_SSH_HOST invalido: use o nome de um Host do ~/.ssh/config (letras, numeros, . _ - @).",
    );
  }

  return Object.freeze({
    sshHost,
    tnsAlias: read(env, "SCCI_DB_TNS_ALIAS") ?? DEFAULTS.tnsAlias,
    dbIniPath: read(env, "SCCI_DB_INI_PATH") ?? DEFAULTS.dbIniPath,
    oracleEnvPath: read(env, "SCCI_DB_ORACLE_ENV_PATH") ?? DEFAULTS.oracleEnvPath,
    tnsAdmin: read(env, "SCCI_DB_TNS_ADMIN") ?? DEFAULTS.tnsAdmin,
  });
}
