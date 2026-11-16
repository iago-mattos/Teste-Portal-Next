import { expect, test } from "@playwright/test";
import { resolveScciDbConfig } from "../config/scci-db-config";
import { waitFor } from "../services/scci-db/poll";
import type { ScciQueryOptions, ScciQueryRunner } from "../services/scci-db/scci-db-client";
import { ScciSimulatorRecords } from "../services/scci-db/simulator-records";
import {
  assertNoOracleError,
  assertReadOnlySelect,
  buildRemoteScript,
  END_MARKER,
  isTransientSshFailure,
  parseSqlplusRows,
  sqlCpfVariants,
  sqlInteger,
  sqlString,
} from "../services/scci-db/sqlplus-script";

/**
 * Testes das partes puras do acesso ao banco do SCCI (sem rede, sem browser).
 * O acesso real fica em tests/scci-db (projeto `scci-db`).
 */

const CONFIG = {
  sshHost: "cef-mip2",
  tnsAlias: "11g",
  dbIniPath: "/home/caixa/dados/db.ini",
  oracleEnvPath: "/home/caixa/dados/oracle_env.sh",
  tnsAdmin: "/usr/lib/oracle/tns",
} as const;

test.describe("scci-db | trava de somente leitura", () => {
  test("aceita SELECT e WITH", () => {
    expect(() => assertReadOnlySelect("SELECT 1 AS UM FROM DUAL")).not.toThrow();
    expect(() =>
      assertReadOnlySelect("WITH X AS (SELECT 1 AS UM FROM DUAL) SELECT UM FROM X"),
    ).not.toThrow();
  });

  for (const sql of [
    "DELETE FROM OPERACAO_CREDITO",
    "UPDATE SIMULACAO_ORIGINACAO SET VA_MIP = 0",
    "SELECT 1 FROM DUAL; DROP TABLE X",
    "SELECT * FROM OPERACAO_CREDITO FOR UPDATE",
    "BEGIN NULL; END",
    "SELECT 1 FROM DUAL\n/\nHOST rm -rf /",
  ]) {
    test(`recusa: ${sql.split("\n")[0]}`, () => {
      expect(() => assertReadOnlySelect(sql)).toThrow(/somente SELECT/);
    });
  }

  test("palavra proibida dentro de literal não bloqueia", () => {
    expect(() =>
      assertReadOnlySelect("SELECT 'UPDATE' AS TXT FROM DUAL"),
    ).not.toThrow();
  });
});

test.describe("scci-db | literais", () => {
  test("sqlString escapa aspas", () => {
    expect(sqlString("D'ÁVILA")).toBe("'D''ÁVILA'");
  });

  test("sqlInteger aceita só inteiros não negativos", () => {
    expect(sqlInteger(123)).toBe("123");
    expect(sqlInteger("456")).toBe("456");
    expect(() => sqlInteger("1 OR 1=1")).toThrow();
    expect(() => sqlInteger(-1)).toThrow();
    expect(() => sqlInteger(1.5)).toThrow();
  });

  test("sqlCpfVariants gera dígitos e formato com máscara", () => {
    expect(sqlCpfVariants("123.456.789-09")).toBe("'12345678909','123.456.789-09'");
    expect(() => sqlCpfVariants("123")).toThrow(/CPF/);
  });
});

test.describe("scci-db | script remoto", () => {
  const script = buildRemoteScript(CONFIG, "SELECT NU_SIMULACAO, VA_MIP FROM SIMULACAO_ORIGINACAO", [
    "NU_SIMULACAO",
    "VA_MIP",
  ]);

  test("lê credenciais do db.ini no servidor e não as recebe de fora", () => {
    expect(script).toContain("DBINI='/home/caixa/dados/db.ini'");
    expect(script).toMatch(/DB_PASS=\$\(sed/);
    // a senha vai para o sqlplus pelo stdin (printf builtin), nunca por argv
    expect(script).toContain("| sqlplus -S -L /nolog");
    expect(script).toContain(`printf 'CONNECT %s/"%s"@%s\\n' "$DB_USER" "$DB_PASS" '11g'`);
  });

  test("abre transação somente leitura e desfaz no fim", () => {
    expect(script).toContain("SET TRANSACTION READ ONLY;");
    expect(script).toMatch(/ROLLBACK;\s*EXIT/);
    expect(script).toContain("SET DEFINE OFF");
  });

  test("normaliza números e datas e marca cada linha", () => {
    expect(script).toContain("NLS_NUMERIC_CHARACTERS = '.,'");
    expect(script).toContain("NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS'");
    expect(script).toContain("SELECT '@@ROW@@' ||");
    expect(script).toContain("FROM (SELECT NU_SIMULACAO, VA_MIP FROM SIMULACAO_ORIGINACAO);");
  });

  test("nenhuma linha passa do limite do sqlplus 11 (2499) e literais não são quebrados", () => {
    const columns = Array.from({ length: 80 }, (_, index) => `COLUNA_LONGA_NUMERO_${index}`);
    const literal = `'${"X Y ".repeat(100)}'`;
    const longScript = buildRemoteScript(
      CONFIG,
      `SELECT ${columns.join(", ")} FROM SIMULACAO_ORIGINACAO WHERE A = ${literal}`,
      columns,
    );

    for (const line of longScript.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(1000);
      expect(line.trim()).not.toBe("/");
    }
    expect(longScript).toContain(literal);
  });

  test("recusa coluna com nome inválido", () => {
    expect(() => buildRemoteScript(CONFIG, "SELECT 1 FROM DUAL", ["X; DROP"])).toThrow(
      /coluna/i,
    );
  });

  test("recusa configuração com caractere de shell", () => {
    expect(() =>
      buildRemoteScript({ ...CONFIG, dbIniPath: "/tmp/x'; rm -rf /" }, "SELECT 1 FROM DUAL", [
        "UM",
      ]),
    ).toThrow(/dbIniPath/);
  });
});

test.describe("scci-db | parser da saída do sqlplus", () => {
  test("lê só linhas marcadas e converte vazio em null", () => {
    const stdout = [
      "Prognum Informatica S.A.",
      "",
      "@@ROW@@123\u001f\u001f1600000.5",
      "@@ROW@@124\u001fABC\u001f",
      END_MARKER,
    ].join("\n");

    expect(parseSqlplusRows(stdout, ["NU", "TXT", "VA"])).toEqual([
      { NU: "123", TXT: null, VA: "1600000.5" },
      { NU: "124", TXT: "ABC", VA: null },
    ]);
  });

  test("erro ORA/SP2 vira exceção", () => {
    expect(() => parseSqlplusRows("ORA-00942: table or view does not exist", ["X"])).toThrow(
      /ORA-00942/,
    );
    expect(() => parseSqlplusRows("SP2-0640: Não conectado", ["X"])).toThrow(/SP2-0640/);
  });

  test("linha com número errado de colunas vira exceção", () => {
    expect(() => parseSqlplusRows(`@@ROW@@1\u001f2\n${END_MARKER}`, ["A"])).toThrow(/colunas/);
  });

  test("no caminho de erro do ssh, só o erro do Oracle é procurado (sem exigir o marcador de fim)", () => {
    expect(() => assertNoOracleError("Prognum Informatica S.A.\n")).not.toThrow();
    expect(() => assertNoOracleError("ORA-01017: invalid username/password")).toThrow(/ORA-01017/);
  });

  test("consulta sem linhas, mas concluída, é lista vazia", () => {
    expect(parseSqlplusRows(`Prognum Informatica S.A.\n${END_MARKER}\n`, ["A"])).toEqual([]);
  });

  test("saída sem o marcador de fim NÃO vira lista vazia (evita falso-verde)", () => {
    expect(() => parseSqlplusRows("Prognum Informatica S.A.\n", ["A"])).toThrow(/incompleta/);
    expect(() => parseSqlplusRows("@@ROW@@1", ["A"])).toThrow(/incompleta/);
  });

  test("o script imprime o marcador de fim depois do SELECT e antes do ROLLBACK", () => {
    const script = buildRemoteScript(CONFIG, "SELECT 1 AS UM FROM DUAL", ["UM"]);
    const select = script.indexOf("SELECT '@@ROW@@'");
    const end = script.indexOf(`PROMPT ${END_MARKER}`);
    const rollback = script.indexOf("ROLLBACK;");
    expect(select).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(select);
    expect(rollback).toBeGreaterThan(end);
  });
});

test.describe("scci-db | trava de somente leitura: funções que escrevem ou saem do banco", () => {
  for (const sql of [
    "SELECT DBMS_LOCK.SLEEP(1) FROM DUAL",
    "SELECT UTL_HTTP.REQUEST('http://x') FROM DUAL",
    "SELECT UTL_FILE.FOPEN('A','B','W') FROM DUAL",
    "SELECT SEQ_X.NEXTVAL FROM DUAL",
    "SELECT 1 FROM OPERACAO_CREDITO@LINK_EXTERNO",
    "SELECT q'[x' FROM DUAL; DELETE FROM T WHERE 'x]' FROM DUAL",
    "SELECT 1 FROM DUAL -- comentario",
    "SELECT 1 /* oculto */ FROM DUAL",
    // função do esquema (pode gravar por transação autônoma): só as funções permitidas passam
    "SELECT 1 FROM DUAL WHERE F_GRAVA(1) = 1",
    "SELECT PKG_X.GRAVA(1) FROM DUAL",
    // saída de rede e leitura de outro esquema sem DONO.TABELA
    "SELECT HTTPURITYPE('http://x').GETCLOB() FROM DUAL",
    "SELECT DBURITYPE('/AILOS/PESSOA_PRETENDENTE').GETCLOB() FROM DUAL",
    // objetos fora da lista permitida
    "SELECT USERNAME FROM DBA_USERS",
    "SELECT 1 FROM TABELA_NAO_LISTADA",
    'SELECT "X" FROM "SEGURA"',
    // join por vírgula e subconsulta com tabela de outro esquema
    "SELECT 1 FROM DUAL, AILOS.PESSOA_PRETENDENTE",
    "SELECT 1 FROM SEGURA S, DUAL D, AILOS.X Y WHERE S.CODIGO = 1",
    "SELECT 1 FROM DUAL WHERE EXISTS (SELECT 1 FROM CAIXA.OPERACAO_CREDITO)",
    "SELECT * FROM (SELECT 1 AS UM FROM DUAL) D, AILOS.X",
    // vírgula depois de JOIN ... ON/USING e de CROSS JOIN (parecer da rodada 2, R2-1a)
    "SELECT 1 FROM DUAL A JOIN DUAL B ON 1 = 1, AILOS.PESSOA_PRETENDENTE X",
    "SELECT 1 FROM DUAL A CROSS JOIN DUAL B, AILOS.PESSOA_PRETENDENTE X",
    "SELECT 1 FROM SEGURA A JOIN SEGURA B USING (CODIGO), AILOS.PESSOA_PRETENDENTE X",
    "SELECT 1 FROM DUAL A JOIN DUAL B ON 1 = 1, DBA_USERS U",
    "SELECT 1 FROM DUAL A LEFT JOIN DUAL B ON (A.DUMMY = B.DUMMY AND NVL(A.DUMMY, 'X') = 'X'), CAIXA.X Y",
    // CTE definida DEPOIS não mascara o objeto real usado antes dela (R2-1b)
    "WITH A AS (SELECT USERNAME FROM DBA_USERS), DBA_USERS AS (SELECT 1 AS X FROM DUAL) SELECT * FROM A",
    "WITH A AS (SELECT * FROM B), B AS (SELECT 1 AS UM FROM DUAL) SELECT * FROM A",
    "WITH A AS (SELECT 1 AS UM FROM A) SELECT * FROM A",
  ]) {
    test(`recusa: ${sql}`, () => {
      expect(() => assertReadOnlySelect(sql)).toThrow(/somente SELECT/);
    });
  }

  // O usuário do banco tem a role DBA (SELECT ANY TABLE etc.) e o Oracle hospeda
  // esquemas de outros clientes: o helper só pode ler o esquema da própria sessão.
  for (const sql of [
    "SELECT * FROM AILOS.PESSOA_PRETENDENTE",
    "SELECT 1 FROM DUAL JOIN SICREDI.OPERACAO_CREDITO ON 1 = 1",
    'SELECT * FROM "BANESE"."PESSOA_PRETENDENTE"',
  ]) {
    test(`recusa tabela de outro esquema: ${sql}`, () => {
      expect(() => assertReadOnlySelect(sql)).toThrow(/somente SELECT/);
    });
  }

  test("alias.coluna e tabela do próprio esquema continuam aceitos", () => {
    expect(() =>
      assertReadOnlySelect(
        "SELECT OC.NU_OPERACAO FROM OPERACAO_CREDITO OC WHERE EXISTS (SELECT 1 FROM PESSOA_PRETENDENTE PP WHERE PP.NU_PRETENDENTE = OC.NU_PRETENDENTE)",
      ),
    ).not.toThrow();
  });

  test("falha transitória do ssh (255, banner) é reconhecida; erro do Oracle e permissão, não", () => {
    expect(isTransientSshFailure(255, "Connection timed out during banner exchange")).toBe(true);
    expect(isTransientSshFailure(255, "kex_exchange_identification: Connection closed by remote host")).toBe(true);
    expect(isTransientSshFailure(255, "Permission denied (publickey).")).toBe(false);
    expect(isTransientSshFailure(1, "Connection timed out during banner exchange")).toBe(false);
    expect(isTransientSshFailure("ETIMEDOUT", "")).toBe(false);
  });

  test("só as leituras puras do DBMS_LOB passam (para comparar BLOB); as de escrita não", () => {
    expect(() =>
      assertReadOnlySelect(
        "SELECT DBMS_LOB.SUBSTR(T.B, 2000, 1) AS A, DBMS_LOB.GETLENGTH(T.B) AS L FROM SIMULACAO_ORIGINACAO T",
      ),
    ).not.toThrow();
    for (const call of [
      "DBMS_LOB.WRITE(T.B, 1, 1, 'x')",
      "DBMS_LOB.ERASE(T.B, 1, 1)",
      "DBMS_LOB.TRIM(T.B, 1)",
      "DBMS_LOB.APPEND(T.B, T.B)",
      "DBMS_LOB.CREATETEMPORARY(T.B, TRUE)",
      "DBMS_LOB_X.SUBSTR(T.B)",
    ]) {
      expect(() => assertReadOnlySelect(`SELECT ${call} FROM SIMULACAO_ORIGINACAO T`)).toThrow(/somente SELECT/);
    }
  });

  test("objetos e funções da lista permitida continuam aceitos (join por vírgula, CTE, subconsulta)", () => {
    for (const sql of [
      "SELECT COUNT(*) AS N, MAX(NU_SIMULACAO) AS M FROM SIMULACAO_ORIGINACAO",
      "SELECT STO.CO_SEGURADORA, S.NOME FROM SEGURADORA_TIPO_OPERACAO STO LEFT JOIN SEGURA S ON STO.CO_SEGURADORA = S.CODIGO WHERE STO.CO_TIPO_OPERACAO = '904' ORDER BY STO.NU_SEQ",
      "SELECT S.NOME FROM SEGURA S, SEGURADORA_TIPO_OPERACAO STO WHERE STO.CO_SEGURADORA = S.CODIGO",
      "SELECT T.UM FROM (SELECT 1 AS UM FROM DUAL) T",
      "WITH X AS (SELECT 1 AS UM FROM DUAL), Y AS (SELECT 2 AS UM FROM DUAL) SELECT X.UM FROM X, Y",
      "SELECT NVL(TO_CHAR(NU_SIMULACAO), 'x') AS N FROM SIMULACAO_ORIGINACAO WHERE NU_SIMULACAO IN (1, 2) AND (NU_SESSAO = 3 OR NU_SESSAO = 4)",
      "SELECT PRIVILEGE AS P FROM SESSION_PRIVS ORDER BY 1",
      "SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS S FROM DUAL",
      "SELECT 1 FROM CARENCIA_TIPO_OPERACAO AS C",
      "SELECT 1 FROM SEGURA S JOIN SEGURADORA_TIPO_OPERACAO STO ON STO.CO_SEGURADORA = S.CODIGO, DUAL D",
      "SELECT 1 FROM DUAL A CROSS JOIN DUAL B, SEGURA S WHERE S.CODIGO = 1",
      "WITH A AS (SELECT 1 AS UM FROM DUAL), B AS (SELECT UM FROM A) SELECT * FROM B",
      "WITH SEGURA AS (SELECT 1 AS CODIGO FROM DUAL) SELECT * FROM SEGURA",
    ]) {
      expect(() => assertReadOnlySelect(sql), sql).not.toThrow();
    }
  });

  test("todas as consultas que o helper monta passam pela trava", async () => {
    const { records, sqls } = fakeRecords((sql) =>
      sql.includes("COUNT(*) AS TOTAL") ? [{ TOTAL: "1" }] : [],
    );
    await records.ping();
    await records.latestSimulationNumber();
    await records.getSimulation({ nuSimulacao: 1, nuSessao: 2 });
    await records.findSimulationSessions(1);
    await records.simulationsAfter(1);
    await records.getProposal(1);
    await records.latestProposalWithSimulation();
    await records.latestProposalsByCpf("12345678909");
    await records.countApplicants(1);
    await records.getApplicantsByDocument(1, "12345678909");
    await records.insurerRegistryForType("904");
    expect(sqls.length).toBeGreaterThanOrEqual(11);
    for (const sql of sqls) expect(() => assertReadOnlySelect(sql), sql).not.toThrow();
  });

  test("espaços dentro de literal são preservados; fora dele são normalizados", () => {
    const script = buildRemoteScript(
      CONFIG,
      "SELECT  NO_PESSOA\n FROM   PESSOA_PRETENDENTE WHERE NO_PESSOA = 'ANA  MARIA'",
      ["NO_PESSOA"],
    );
    expect(script).toContain("FROM (SELECT NO_PESSOA FROM PESSOA_PRETENDENTE WHERE NO_PESSOA = 'ANA  MARIA');");
  });

  test("literal com quebra de linha é recusado (o sqlplus o partiria)", () => {
    expect(() => assertReadOnlySelect("SELECT 1 FROM DUAL WHERE 'a\nb' = 'x'")).toThrow(
      /somente SELECT/,
    );
  });

  test("DBMS_, @, comentário e NEXTVAL dentro de literal não bloqueiam", () => {
    expect(() =>
      assertReadOnlySelect("SELECT 'DBMS_X a@b -- /* NEXTVAL' AS TXT FROM DUAL"),
    ).not.toThrow();
  });

  test("consulta ao dicionário de dados continua aceita", () => {
    expect(() =>
      assertReadOnlySelect(
        "SELECT COLUMN_NAME, CHAR_LENGTH FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = 'PESSOA_PRETENDENTE'",
      ),
    ).not.toThrow();
  });
});

// ------------------------------------------------------------ registros (fake)

function fakeRecords(rowsFor: (sql: string) => Record<string, string | null>[]) {
  const sqls: string[] = [];
  const optionsSeen: (ScciQueryOptions | undefined)[] = [];
  const runner: ScciQueryRunner = async (_config, sql, columns, options) => {
    sqls.push(sql);
    optionsSeen.push(options);
    // Colunas que o teste não informou chegam como NULL, como no sqlplus.
    return rowsFor(sql).map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column] ?? null])),
    ) as never;
  };
  return { records: new ScciSimulatorRecords(CONFIG, {}, runner), sqls, optionsSeen };
}

const SIMULATION_ROW = {
  NU_SIMULACAO: "10",
  NU_SESSAO: "2",
  DT_REFERENCIA: "2026-11-12 10:00:00",
  CO_GRUPO_TIPO_OPERACAO: "220",
  CO_TIPO_OPERACAO: "060",
  CO_ENQUADRAMENTO: "1",
  CO_SEGURADORA: "7",
  CO_SEGURADORA_DFI: "7",
  CO_APOLICE: "7200",
  CO_APOLICE_DFI: "7200",
  DT_NASCIMENTO_1: "1990-01-01 00:00:00",
  VA_OPERACAO: "1000",
  VA_FINANCIAMENTO: "900",
  VA_PRECO_IMOVEL: "2000",
  VA_RENDA_FAMILIAR: "10000",
  NU_PRAZO_MESES_OPERACAO: "360",
  CO_SISTEMA_AMORTIZACAO: "1",
  CO_PLANO: "1",
  PE_TX_ANUAL_JUROS: "10",
  NU_CPFCNPJ: "12345678909",
  CO_INDICE: "1",
  VA_MIP: "1",
  VA_DFI: "2",
  VA_TARIFA_ADMINISTRACAO: "25",
  VA_AMAISJ_1A_PRESTACAO: "100",
  IN_TIPO_IMOVEL: "R",
  CO_TIPO_IMOVEL: "1",
  NO_IMOVEL_NOVO: "S",
  VA_AREA_UTIL: "80",
};

test.describe("scci-db | simulação pela chave completa", () => {
  test("getSimulation filtra por NU_SIMULACAO e NU_SESSAO", async () => {
    const { records, sqls } = fakeRecords(() => [SIMULATION_ROW]);
    const simulation = await records.getSimulation({ nuSimulacao: 10, nuSessao: 2 });
    expect(simulation?.nuSessao).toBe(2);
    expect(sqls[0]).toMatch(/WHERE NU_SIMULACAO = 10 AND NU_SESSAO = 2$/);
  });

  test("getSimulation recusa chave sem sessão ou não numérica", async () => {
    const { records } = fakeRecords(() => []);
    await expect(
      records.getSimulation({ nuSimulacao: 10 } as unknown as { nuSimulacao: number; nuSessao: number }),
    ).rejects.toThrow(/numerico/);
    await expect(
      records.getSimulation({ nuSimulacao: "10 OR 1=1", nuSessao: 2 }),
    ).rejects.toThrow(/numerico/);
  });

  test("getSimulation falha alto se a chave completa devolver mais de uma linha", async () => {
    const { records } = fakeRecords(() => [SIMULATION_ROW, SIMULATION_ROW]);
    await expect(records.getSimulation({ nuSimulacao: 10, nuSessao: 2 })).rejects.toThrow(
      /mais de uma/,
    );
  });

  test("findSimulationSessions devolve todas as sessões da simulação, ordenadas", async () => {
    const { records, sqls } = fakeRecords(() => [
      SIMULATION_ROW,
      { ...SIMULATION_ROW, NU_SESSAO: "3" },
    ]);
    const sessions = await records.findSimulationSessions(10);
    expect(sessions.map((simulation) => simulation.nuSessao)).toEqual([2, 3]);
    expect(sqls[0]).toMatch(/WHERE NU_SIMULACAO = 10 ORDER BY NU_SESSAO$/);
  });

  test("lê os campos de imóvel da simulação", async () => {
    const { records, sqls } = fakeRecords(() => [SIMULATION_ROW]);
    const simulation = await records.getSimulation({ nuSimulacao: 10, nuSessao: 2 });
    expect(sqls[0]).toContain("IN_TIPO_IMOVEL");
    expect(simulation).toMatchObject({
      inTipoImovel: "R",
      coTipoImovel: 1,
      noImovelNovo: "S",
      vaAreaUtil: 80,
    });
  });
});

test.describe("scci-db | consultas só com chaves (sem dados de terceiros)", () => {
  test("findSimulationSessionKeys não lê CPF, nascimento nem renda", async () => {
    const { records, sqls } = fakeRecords(() => [
      { NU_SIMULACAO: "10", NU_SESSAO: "2" },
      { NU_SIMULACAO: "10", NU_SESSAO: "3" },
    ]);
    expect(await records.findSimulationSessionKeys(10)).toEqual([
      { nuSimulacao: 10, nuSessao: 2 },
      { nuSimulacao: 10, nuSessao: 3 },
    ]);
    expect(sqls[0]).toMatch(/^SELECT NU_SIMULACAO, NU_SESSAO FROM SIMULACAO_ORIGINACAO WHERE NU_SIMULACAO = 10 ORDER BY NU_SESSAO$/);
    expect(sqls[0]).not.toMatch(/NU_CPFCNPJ|DT_NASCIMENTO|VA_RENDA/);
  });

  test("latestLinkedProposalKeys devolve só as chaves da proposta", async () => {
    const { records, sqls } = fakeRecords(() => [
      { NU_OPERACAO: "5", NU_PRETENDENTE: "7", NU_SIMULACAO: "10" },
    ]);
    expect(await records.latestLinkedProposalKeys()).toEqual({
      nuOperacao: 5,
      nuPretendente: 7,
      nuSimulacao: 10,
    });
    expect(sqls[0]).not.toMatch(/VA_RENDA|VA_FINANCIAMENTO|NU_CPFCNPJ/);
  });
});

test.describe("scci-db | pretendentes sem expor dados pessoais", () => {
  test("countApplicants não seleciona nome, e-mail, telefone nem CPF", async () => {
    const { records, sqls } = fakeRecords(() => [{ TOTAL: "2" }]);
    expect(await records.countApplicants(7)).toBe(2);
    expect(sqls[0]).toMatch(/SELECT COUNT\(\*\) AS TOTAL FROM PESSOA_PRETENDENTE WHERE NU_PRETENDENTE = 7$/);
    expect(sqls[0]).not.toMatch(/NO_PESSOA|NO_EMAIL|NU_CELULAR|NU_CPFCNPJ|NU_TEL/);
  });

  test("getApplicantsByDocument só lê o pretendente cujo CPF é o do teste", async () => {
    const { records, sqls } = fakeRecords(() => []);
    await records.getApplicantsByDocument(7, "123.456.789-09");
    expect(sqls[0]).toContain("NU_PRETENDENTE = 7");
    expect(sqls[0]).toContain("NU_CPFCNPJ IN ('12345678909','123.456.789-09')");
  });

  test("getApplicantsByDocument aceita CNPJ (PJ) com e sem máscara", async () => {
    const { records, sqls } = fakeRecords(() => []);
    await records.getApplicantsByDocument(7, "11222333000181");
    expect(sqls[0]).toContain("NU_CPFCNPJ IN ('11222333000181','11.222.333/0001-81')");
    await expect(records.getApplicantsByDocument(7, "123")).rejects.toThrow(/CPF\/CNPJ/);
  });

  test("não existe leitura de pretendentes sem filtro de CPF", () => {
    const { records } = fakeRecords(() => []);
    expect((records as unknown as Record<string, unknown>).getApplicants).toBeUndefined();
  });

  test("contato da PJ e nome completo entram na leitura do pretendente", async () => {
    const { sqls, records } = fakeRecords(() => []);
    await records.getApplicantsByDocument(7, "12345678909");
    for (const column of [
      "NO_PESSOA_COMPLETO",
      "NU_DDD_TEL_CONTATO_PJ",
      "NU_TEL_CONTATO_PJ",
      "NO_PESSOA_CONTATO_PJ",
    ]) {
      expect(sqls[0]).toContain(column);
    }
  });
});

test.describe("scci-db | cadastro de seguradoras do tipo de operação", () => {
  test("lê as linhas do tipo, com o nome da seguradora, na ordem de NU_SEQ", async () => {
    const { records, sqls } = fakeRecords(() => [
      { CO_SEGURADORA: "5", CO_APOLICE: "5200", CO_ENQUADRAMENTO: null, NU_SEQ: "571", NOME: "SOMPO SEGUROS" },
      { CO_SEGURADORA: "4", CO_APOLICE: "4300", CO_ENQUADRAMENTO: "1", NU_SEQ: "2204", NOME: null },
    ]);
    const registry = await records.insurerRegistryForType("904");
    expect(sqls[0]).toContain("FROM SEGURADORA_TIPO_OPERACAO STO LEFT JOIN SEGURA S ON STO.CO_SEGURADORA = S.CODIGO");
    expect(sqls[0]).toContain("WHERE STO.CO_TIPO_OPERACAO = '904'");
    expect(sqls[0]).toMatch(/ORDER BY STO\.NU_SEQ$/);
    expect(registry).toEqual([
      { coSeguradora: 5, coApolice: "5200", coEnquadramento: null, nuSeq: 571, nome: "SOMPO SEGUROS" },
      { coSeguradora: 4, coApolice: "4300", coEnquadramento: 1, nuSeq: 2204, nome: null },
    ]);
  });

  test("recusa tipo de operação que não tenha 3 dígitos", async () => {
    const { records } = fakeRecords(() => []);
    await expect(records.insurerRegistryForType("904' OR '1'='1")).rejects.toThrow(/tipo de operacao/);
    await expect(records.insurerRegistryForType("90")).rejects.toThrow(/tipo de operacao/);
  });
});

test.describe("scci-db | carência na proposta", () => {
  test("getProposal lê os campos de carência gravados no envio", async () => {
    const { records, sqls } = fakeRecords(() => [
      {
        NU_OPERACAO: "1",
        IN_CARENCIA_AMORTIZACAO: "N",
        IN_TIPO_JUROS_CARENCIA: null,
        NU_PRAZO_CARENCIA_AMAISJ: "0",
        VA_AMAISJ_1A_PREST_POSCAR: null,
      },
    ]);
    const proposal = await records.getProposal(1);
    for (const column of [
      "IN_CARENCIA_AMORTIZACAO",
      "IN_TIPO_JUROS_CARENCIA",
      "NU_PRAZO_CARENCIA_AMAISJ",
      "VA_AMAISJ_1A_PREST_POSCAR",
    ]) {
      expect(sqls[0]).toContain(column);
    }
    expect(proposal).toMatchObject({
      inCarenciaAmortizacao: "N",
      inTipoJurosCarencia: null,
      nuPrazoCarenciaAmaisj: 0,
    });
  });
});

test.describe("scci-db | espera com limite", () => {
  function clock() {
    let now = 0;
    const sleeps: number[] = [];
    return {
      sleeps,
      now: () => now,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        now += ms;
      },
    };
  }

  test("devolve assim que o valor aparece, sem dormir depois", async () => {
    const time = clock();
    let calls = 0;
    const value = await waitFor(
      async () => (++calls === 3 ? "achou" : undefined),
      { description: "simulação", timeoutMs: 30_000, intervalMs: 2_000 },
      time,
    );
    expect(value).toBe("achou");
    expect(calls).toBe(3);
    expect(time.sleeps).toEqual([2_000, 2_000]);
  });

  test("estoura o limite com mensagem que diz o que se esperava", async () => {
    const time = clock();
    await expect(
      waitFor(
        async () => undefined,
        { description: "simulação 10/2", timeoutMs: 5_000, intervalMs: 2_000 },
        time,
      ),
    ).rejects.toThrow(/simulação 10\/2.*5000/);
  });

  test("erro da consulta não é engolido nem repetido", async () => {
    const time = clock();
    let calls = 0;
    await expect(
      waitFor(
        async () => {
          calls += 1;
          throw new Error("ORA-00942");
        },
        { description: "x", timeoutMs: 30_000, intervalMs: 2_000 },
        time,
      ),
    ).rejects.toThrow(/ORA-00942/);
    expect(calls).toBe(1);
  });

  test("recusa intervalo menor que 1 s (cada consulta abre um ssh)", async () => {
    await expect(
      waitFor(async () => undefined, { description: "x", timeoutMs: 5_000, intervalMs: 100 }, clock()),
    ).rejects.toThrow(/intervalo/);
  });

  test("cada tentativa tem o seu limite (20 s por padrão) e ele pode ser trocado", async () => {
    const first = fakeRecords(() => [SIMULATION_ROW]);
    await first.records.waitForSimulation({ nuSimulacao: 10, nuSessao: 2 });
    expect(first.optionsSeen[0]?.timeoutMs).toBe(20_000);

    const second = fakeRecords(() => [SIMULATION_ROW]);
    await second.records.waitForSimulation(
      { nuSimulacao: 10, nuSessao: 2 },
      { queryTimeoutMs: 8_000 },
    );
    expect(second.optionsSeen[0]?.timeoutMs).toBe(8_000);
  });

  test("waitForSimulation consulta a chave completa até a linha existir", async () => {
    let calls = 0;
    const { records, sqls } = fakeRecords(() => (++calls < 2 ? [] : [SIMULATION_ROW]));
    const simulation = await records.waitForSimulation(
      { nuSimulacao: 10, nuSessao: 2 },
      { timeoutMs: 20_000, intervalMs: 1_000 },
      { now: () => 0, sleep: async () => undefined },
    );
    expect(simulation.nuSessao).toBe(2);
    expect(sqls).toHaveLength(2);
  });
});

test.describe("scci-db | configuração", () => {
  test("sem SCCI_DB_SSH_HOST o acesso fica desligado", () => {
    expect(resolveScciDbConfig({})).toBeUndefined();
  });

  test("aplica defaults da cef-mip2", () => {
    expect(resolveScciDbConfig({ SCCI_DB_SSH_HOST: "cef-mip2" })).toEqual(CONFIG);
  });

  test("valores do ambiente sobrescrevem defaults", () => {
    expect(
      resolveScciDbConfig({ SCCI_DB_SSH_HOST: "outra", SCCI_DB_TNS_ALIAS: "SCCI2" }),
    ).toMatchObject({ sshHost: "outra", tnsAlias: "SCCI2" });
  });

  test("recusa host que pareça opção do ssh", () => {
    expect(() => resolveScciDbConfig({ SCCI_DB_SSH_HOST: "-oProxyCommand=x" })).toThrow(
      /SCCI_DB_SSH_HOST/,
    );
  });
});
