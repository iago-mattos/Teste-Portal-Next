import type { ScciDbConfig } from "../../config/scci-db-config";

/**
 * Partes puras do acesso ao Oracle do SCCI: trava de somente leitura, literais
 * seguros, o script bash enviado por stdin ao `ssh <host> bash -s` e o parser
 * da saída do sqlplus. Sem I/O aqui (testado em tests/unit/scci-db.unit.spec.ts).
 *
 * Camadas de proteção contra escrita:
 *  1. só aceita um único SELECT/WITH, sem `;`, sem palavras de DML/DDL/PL-SQL;
 *  2. a sessão roda `SET TRANSACTION READ ONLY` (o Oracle recusa qualquer DML);
 *  3. termina com ROLLBACK.
 */

export type ScciDbRow<C extends string> = { readonly [K in C]: string | null };

const ROW_MARKER = "@@ROW@@";
/** Impresso pelo script depois do SELECT: sem ele, a saída é incompleta, não "zero linhas". */
export const END_MARKER = "@@END@@";
const FIELD_SEPARATOR = "\u001f";
const SQL_DELIMITER = "SCCI_DB_SQL";

const COLUMN_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/;
const SAFE_PATH_PATTERN = /^\/[A-Za-z0-9_./-]+$/;
const SAFE_TNS_PATTERN = /^[A-Za-z0-9_.-]+$/;
const FORBIDDEN_WORDS =
  /\b(INSERT|UPDATE|DELETE|MERGE|UPSERT|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|RENAME|COMMENT|LOCK|COMMIT|ROLLBACK|SAVEPOINT|BEGIN|DECLARE|EXEC|EXECUTE|CALL|HOST|PRAGMA|NEXTVAL)\b/i;
/**
 * `SET TRANSACTION READ ONLY` não impede uma função chamada no SELECT de gravar
 * por transação autônoma, nem de falar com a rede ou o disco: pacotes do Oracle
 * que fazem isso são recusados aqui.
 */
const FORBIDDEN_PACKAGES = /\b(?:DBMS_|UTL_)\w*/i;
/** Leituras puras do DBMS_LOB (comparar BLOB). Sem escrita, sem efeito colateral. */
const PURE_LOB_READS = /\bDBMS_LOB\s*\.\s*(?:SUBSTR|GETLENGTH|INSTR|COMPARE)\s*\(/gi;

interface ScannedSql {
  /** SQL em uma linha, com cada literal trocado por `''`. */
  readonly code: string;
  /** SQL em uma linha, com os literais intactos (espaços dentro deles preservados). */
  readonly normalized: string;
  readonly problems: readonly string[];
}

/**
 * Percorre o SQL uma vez: troca os literais por `''` (para os filtros), junta os
 * espaços só FORA de literais e acusa o que o filtro não sabe ler (literal `q'..'`,
 * literal sem fim, literal com quebra de linha). Um literal que o filtro não
 * entende poderia esconder uma palavra proibida, então é recusado.
 */
function scanSql(sql: string): ScannedSql {
  const problems = new Set<string>();
  let code = "";
  let normalized = "";
  let inLiteral = false;
  let pendingSpace = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (!inLiteral) {
      if (/\s/.test(char)) {
        pendingSpace = true;
        continue;
      }
      if (pendingSpace && code.length > 0) {
        code += " ";
        normalized += " ";
      }
      pendingSpace = false;
      if (char === "'") {
        if (/(^|[^\w$#])[nN]?[qQ]$/.test(code)) problems.add("literal q'...' nao e suportado");
        inLiteral = true;
        code += "''";
        normalized += "'";
      } else {
        code += char;
        normalized += char;
      }
    } else {
      if (char === "\n" || char === "\r") problems.add("literal com quebra de linha nao e suportado");
      normalized += char;
      if (char === "'") {
        if (sql[index + 1] === "'") {
          normalized += "'";
          index += 1;
        } else {
          inLiteral = false;
        }
      }
    }
  }
  if (inLiteral) problems.add("literal sem fim");
  return { code, normalized, problems: [...problems] };
}

/**
 * Listas permitidas. O usuario do banco e DBA e o Oracle hospeda esquemas de
 * outros clientes: so passam as tabelas/visoes que o helper le e as funcoes que
 * ele usa. Para ler outro objeto, inclua-o aqui de proposito (e no documento).
 */
const ALLOWED_OBJECTS = new Set([
  "DUAL",
  "ALL_TAB_COLUMNS",
  "SESSION_PRIVS",
  "SESSION_ROLES",
  "SIMULACAO_ORIGINACAO",
  "OPERACAO_CREDITO",
  "PESSOA_PRETENDENTE",
  "PRETENDENTE",
  "IMOVEL_OPERACAO",
  "SEGURADORA_TIPO_OPERACAO",
  "SEGURA",
  "TABAPOLICE",
  "CARENCIA_TIPO_OPERACAO",
]);

const ALLOWED_FUNCTIONS = new Set([
  "COUNT",
  "MAX",
  "MIN",
  "SUM",
  "AVG",
  "TO_CHAR",
  "TO_NUMBER",
  "TO_DATE",
  "REPLACE",
  "CHR",
  "NVL",
  "COALESCE",
  "DECODE",
  "UPPER",
  "LOWER",
  "TRIM",
  "SUBSTR",
  "INSTR",
  "LENGTH",
  "ROUND",
  "TRUNC",
  "ABS",
  "SYS_CONTEXT",
  "DBMS_LOB.SUBSTR",
  "DBMS_LOB.GETLENGTH",
  "DBMS_LOB.INSTR",
  "DBMS_LOB.COMPARE",
]);

/** Palavras que podem vir antes de "(" sem serem chamada de função. */
const KEYWORDS_BEFORE_PAREN = new Set([
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "EXISTS", "AS", "ON", "JOIN", "WITH",
  "UNION", "ALL", "MINUS", "INTERSECT", "ANY", "SOME", "BY", "HAVING", "OVER", "PARTITION",
  "BETWEEN", "LIKE", "THEN", "ELSE", "WHEN", "CASE", "DISTINCT", "USING", "LEFT", "RIGHT",
  "INNER", "OUTER", "FULL", "CROSS", "NATURAL",
]);

/** Palavras que encerram a lista FROM (no mesmo nivel de parenteses). */
const FROM_CLAUSE_END = new Set([
  "WHERE", "GROUP", "ORDER", "HAVING", "UNION", "MINUS", "INTERSECT", "CONNECT", "START",
  "FETCH", "FOR", "MODEL", "WINDOW",
]);

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$#]*(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_$#]*)*/;
const CTE_NAME = /(?:\bWITH|,)\s*([A-Za-z_][A-Za-z0-9_$#]*)\s+AS\s*\(/gi;

function skipSpaces(text: string, from: number): number {
  let position = from;
  while (position < text.length && /\s/.test(text[position])) position += 1;
  return position;
}

function skipParentheses(text: string, from: number): number {
  let depth = 0;
  for (let position = from; position < text.length; position += 1) {
    if (text[position] === "(") depth += 1;
    if (text[position] === ")") {
      depth -= 1;
      if (depth === 0) return position + 1;
    }
  }
  return text.length;
}

interface ObjectReference {
  readonly name: string;
  /** Posição da referência no SQL normalizado. */
  readonly position: number;
}

interface CteDefinition {
  readonly name: string;
  /** Posição logo depois do `)` que fecha a definição: só vale para referências depois dela. */
  readonly definedAt: number;
}

/** Objeto que começa em `from` (nome, possivelmente com DONO.), ou nada se for subconsulta. */
function objectAt(code: string, from: number): ObjectReference | undefined {
  const position = skipSpaces(code, from);
  if (code[position] === "(") return undefined; // subconsulta: seus FROM são achados pela varredura global
  const identifier = IDENTIFIER.exec(code.slice(position));
  return {
    name: identifier ? identifier[0].replace(/\s+/g, "").toUpperCase() : "?",
    position,
  };
}

/**
 * Posições que começam um novo item da lista FROM: depois de cada vírgula fora de
 * parênteses, até a palavra ou o `)` que encerra a lista. Vale também depois de
 * `JOIN ... ON ...` e `JOIN ... USING (...)` (`FROM A JOIN B ON x, DONO.C`).
 */
function commaItemStarts(code: string, from: number): number[] {
  const starts: number[] = [];
  let depth = 0;
  let index = from;
  while (index < code.length) {
    const char = code[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      if (depth === 0) break;
      depth -= 1;
    } else if (char === "," && depth === 0) {
      starts.push(index + 1);
    } else if (depth === 0 && /[A-Za-z_]/.test(char) && !/[\w$#]/.test(code[index - 1] ?? " ")) {
      const word = /^[A-Za-z_][A-Za-z0-9_$#]*/.exec(code.slice(index))?.[0] ?? char;
      if (FROM_CLAUSE_END.has(word.toUpperCase())) break;
      index += word.length;
      continue;
    }
    index += 1;
  }
  return starts;
}

/** Objetos depois de FROM, de JOIN e de cada vírgula da lista FROM. */
function referencedObjects(code: string): ObjectReference[] {
  const references: ObjectReference[] = [];
  const keyword = /\b(FROM|JOIN)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = keyword.exec(code)) !== null) {
    const after = match.index + match[0].length;
    const first = objectAt(code, after);
    if (first) references.push(first);
    if (match[1].toUpperCase() === "FROM") {
      for (const start of commaItemStarts(code, after)) {
        const item = objectAt(code, start);
        if (item) references.push(item);
      }
    }
  }
  return references;
}

function cteDefinitions(code: string): CteDefinition[] {
  return [...code.matchAll(CTE_NAME)].map((match) => ({
    name: match[1].toUpperCase(),
    definedAt: skipParentheses(code, (match.index ?? 0) + match[0].length - 1),
  }));
}

/** Funções chamadas (`NOME(` ou `PACOTE.NOME(`) que não estão na lista permitida. */
function disallowedCalls(code: string): string[] {
  const calls: string[] = [];
  const call = /([A-Za-z_][A-Za-z0-9_$#]*(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_$#]*)*)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = call.exec(code)) !== null) {
    const name = match[1].replace(/\s+/g, "").toUpperCase();
    if (KEYWORDS_BEFORE_PAREN.has(name) || ALLOWED_FUNCTIONS.has(name)) continue;
    calls.push(name);
  }
  return calls;
}

export function assertReadOnlySelect(sql: string): void {
  const { code, problems } = scanSql(sql);
  const reasons: string[] = [...problems];
  if (!/^(SELECT|WITH)\b/i.test(code)) reasons.push("precisa comecar com SELECT ou WITH");
  if (code.includes(";")) reasons.push("nao pode conter ';'");
  if (/(^|\s)\/(\s|$)/.test(code)) reasons.push("nao pode conter '/' isolado");
  if (code.includes("--") || code.includes("/*")) reasons.push("nao pode conter comentario");
  if (code.includes("@")) reasons.push("nao pode conter '@' (database link)");
  if (code.includes('"')) reasons.push("nao pode conter identificador entre aspas");
  const forbidden = FORBIDDEN_WORDS.exec(code);
  if (forbidden) reasons.push(`palavra proibida: ${forbidden[1].toUpperCase()}`);
  const forbiddenPackage = FORBIDDEN_PACKAGES.exec(code.replace(PURE_LOB_READS, "("));
  if (forbiddenPackage) reasons.push(`pacote proibido: ${forbiddenPackage[0].toUpperCase()}`);

  for (const name of new Set(disallowedCalls(code))) {
    reasons.push(`funcao nao permitida: ${name}(`);
  }
  const ctes = cteDefinitions(code);
  const objectReasons = new Set<string>();
  for (const reference of referencedObjects(code)) {
    if (reference.name.includes(".")) {
      objectReasons.add(`nao pode ler tabela de outro esquema (${reference.name})`);
    } else if (
      !ALLOWED_OBJECTS.has(reference.name) &&
      // uma CTE so existe para as referencias que vem DEPOIS do fim da sua definicao
      !ctes.some((cte) => cte.name === reference.name && cte.definedAt <= reference.position)
    ) {
      objectReasons.add(`objeto fora da lista permitida: ${reference.name}`);
    }
  }
  reasons.push(...objectReasons);

  if (reasons.length > 0) {
    throw new Error(`Consulta ao SCCI recusada (somente SELECT): ${reasons.join("; ")}.`);
  }
}

export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function sqlInteger(value: number | string): string {
  const text = String(value).trim();
  if (!/^\d{1,18}$/.test(text)) {
    throw new Error("Valor numerico invalido para a consulta ao SCCI.");
  }
  return text;
}

/** CPF como o SCCI pode ter gravado: só dígitos ou com máscara. */
export function sqlCpfVariants(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) throw new Error("CPF invalido para a consulta ao SCCI.");
  const masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  return `${sqlString(digits)},${sqlString(masked)}`;
}

/** CPF (11 dígitos) ou CNPJ (14), só dígitos ou com máscara, como o SCCI pode ter gravado. */
export function sqlDocumentVariants(document: string): string {
  const digits = document.replace(/\D/g, "");
  if (digits.length === 11) return sqlCpfVariants(digits);
  if (digits.length !== 14) throw new Error("CPF/CNPJ invalido para a consulta ao SCCI.");
  const masked = `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  return `${sqlString(digits)},${sqlString(masked)}`;
}

function assertSafeConfig(config: ScciDbConfig): void {
  for (const key of ["dbIniPath", "oracleEnvPath", "tnsAdmin"] as const) {
    if (!SAFE_PATH_PATTERN.test(config[key])) {
      throw new Error(`Configuracao ${key} invalida: use um caminho absoluto simples.`);
    }
  }
  if (!SAFE_TNS_PATTERN.test(config.tnsAlias)) {
    throw new Error("Configuracao tnsAlias invalida.");
  }
}

/**
 * O sqlplus 11 ignora linhas com mais de 2499 caracteres (SP2-0027). Quebra o
 * comando em espaços FORA de literais, em linhas de até `maxLength`. O SQL já
 * chega sem linhas em branco nem `/` isolado (ver assertReadOnlySelect).
 */
export function wrapSqlLines(sql: string, maxLength = 1000): string {
  const atoms: string[] = [];
  let current = "";
  let inLiteral = false;
  for (const char of sql) {
    if (char === "'") inLiteral = !inLiteral;
    if (char === " " && !inLiteral) {
      if (current) atoms.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) atoms.push(current);

  const lines: string[] = [];
  let line = "";
  for (const atom of atoms) {
    if (line && line.length + 1 + atom.length > maxLength) {
      lines.push(line);
      line = atom;
    } else {
      line = line ? `${line} ${atom}` : atom;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

function columnExpression(column: string): string {
  return `REPLACE(REPLACE(TO_CHAR(${column}), CHR(13), ' '), CHR(10), ' ')`;
}

/**
 * Script bash executado no servidor. A senha sai do db.ini do servidor e chega
 * ao sqlplus pelo stdin (printf é builtin: não aparece em `ps`); nunca trafega
 * para cá nem é impressa.
 */
export function buildRemoteScript(
  config: ScciDbConfig,
  sql: string,
  columns: readonly string[],
): string {
  assertSafeConfig(config);
  assertReadOnlySelect(sql);
  if (columns.length === 0) throw new Error("Informe ao menos uma coluna.");
  for (const column of columns) {
    if (!COLUMN_PATTERN.test(column)) {
      throw new Error(`Nome de coluna invalido: ${column}.`);
    }
  }

  const selectRow = wrapSqlLines(
    `SELECT '${ROW_MARKER}' || ${columns
      .map(columnExpression)
      .join(" || CHR(31) || ")} FROM (${scanSql(sql).normalized});`,
  );

  return [
    "set -eu",
    "set -o pipefail",
    `DBINI='${config.dbIniPath}'`,
    `. '${config.oracleEnvPath}' >/dev/null 2>&1 || true`,
    `export TNS_ADMIN='${config.tnsAdmin}'`,
    `DB_USER=$(sed -n 's/^[[:space:]]*UserName[[:space:]]*=[[:space:]]*//Ip' "$DBINI" | head -n 1 | tr -d '\\r')`,
    `DB_PASS=$(sed -n 's/^[[:space:]]*Password[[:space:]]*=[[:space:]]*//Ip' "$DBINI" | head -n 1 | tr -d '\\r')`,
    `if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ]; then echo "SCCI_DB_ERROR: UserName/Password ausentes em $DBINI" >&2; exit 3; fi`,
    "{",
    `  printf 'WHENEVER SQLERROR EXIT SQL.SQLCODE\\nWHENEVER OSERROR EXIT FAILURE\\n'`,
    `  printf 'CONNECT %s/"%s"@%s\\n' "$DB_USER" "$DB_PASS" '${config.tnsAlias}'`,
    `  cat <<'${SQL_DELIMITER}'`,
    "SET DEFINE OFF",
    "SET HEADING OFF PAGESIZE 0 FEEDBACK OFF VERIFY OFF ECHO OFF TAB OFF",
    "SET LINESIZE 32767 TRIMOUT ON TRIMSPOOL ON",
    "ALTER SESSION SET NLS_NUMERIC_CHARACTERS = '.,';",
    "ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS';",
    "ALTER SESSION SET NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS';",
    "SET TRANSACTION READ ONLY;",
    selectRow,
    `PROMPT ${END_MARKER}`,
    "ROLLBACK;",
    "EXIT",
    SQL_DELIMITER,
    "} | sqlplus -S -L /nolog",
    "",
  ].join("\n");
}

/**
 * Falha de transporte que vale repetir: o ssh (exit 255) não chegou a abrir a
 * sessão. Como a consulta é só leitura, repetir não duplica nada. Recusa de
 * autenticação e erro do Oracle NÃO são transitórios.
 */
export function isTransientSshFailure(code: unknown, stderr: string): boolean {
  if (code !== 255) return false;
  return /banner exchange|kex_exchange_identification|Connection (?:timed out|reset|closed|refused)|Broken pipe|Operation timed out/i.test(
    stderr,
  );
}

/** Lança o erro ORA/SP2/TNS da saída, se houver. Não exige o marcador de fim. */
export function assertNoOracleError(stdout: string): void {
  const error = stdout.split(/\r?\n/).find((line) => /^(ORA|SP2|TNS)-\d+/.test(line.trim()));
  if (error) throw new Error(`Erro do Oracle no SCCI: ${error.trim()}`);
}

export function parseSqlplusRows<C extends string>(
  stdout: string,
  columns: readonly C[],
): ScciDbRow<C>[] {
  assertNoOracleError(stdout);
  const lines = stdout.split(/\r?\n/);
  // Sem o marcador de fim a consulta pode nem ter rodado: "zero linhas" seria falso-verde.
  if (!lines.some((line) => line.trim() === END_MARKER)) {
    throw new Error("Saida do sqlplus incompleta: sem o marcador de fim da consulta.");
  }

  return lines
    .filter((line) => line.startsWith(ROW_MARKER))
    .map((line) => {
      const values = line.slice(ROW_MARKER.length).split(FIELD_SEPARATOR);
      if (values.length !== columns.length) {
        throw new Error(
          `Linha do SCCI com ${values.length} colunas; esperado ${columns.length}.`,
        );
      }
      const row = {} as Record<C, string | null>;
      columns.forEach((column, index) => {
        const value = values[index].trim();
        row[column] = value === "" ? null : value;
      });
      return row;
    });
}
