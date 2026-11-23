import { AUTOMATION_LABELS, formatDate, STATUSES } from "./lib.mjs";
import { buildXlsx, columnLetter } from "./xlsx.mjs";

/**
 * Planilha Excel do documento de casos de teste: Resumo, Cenários (OK e Obs
 * por ambiente), Testes executados (um por linha, com motivo, esperado e
 * encontrado) e Execuções.
 */

const ORIGIN_LABELS = {
  automatico: "Playwright",
  manual: "Manual",
  planilha: "Planilha original",
};

const TAG_LABELS = {
  "pendente-produto": "Hipótese a confirmar com Produto",
  "depende-decisao": "Depende de decisão",
  investigacao: "Em investigação",
  "grava-simulacao": "Grava simulação no SCCI",
  mutation: "Cria dados no SCCI",
  "scci-db": "Confere no banco do SCCI",
};

const STATUS_ORDER = Object.keys(STATUSES);
const SUMMARY_SHEET = "Resumo";
const CASES_SHEET = "Cenários";

function statusCell(status) {
  const meta = STATUSES[status] ?? STATUSES.pendente;
  return { v: meta.label, s: `status-${meta.tone}` };
}

/** Altura aproximada da linha para o texto quebrado caber (Excel não ajusta sozinho). */
function rowHeight(cells, widths) {
  let lines = 1;
  cells.forEach((cell, index) => {
    const text = String((cell && typeof cell === "object" ? cell.v : cell) ?? "");
    if (!text) return;
    const perLine = Math.max(8, Math.floor((widths[index] ?? 12) * 1.15));
    const count = text
      .split("\n")
      .reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / perLine)), 0);
    lines = Math.max(lines, count);
  });
  return Math.min(409, lines * 12.75 + 4);
}

function withHeights(rows, widths, skip = 1) {
  return rows.map((cells, index) =>
    index < skip ? cells : { cells, height: rowHeight(cells, widths) },
  );
}

function caseNotes(testCase) {
  const tags = (testCase.tags ?? []).map((tag) => TAG_LABELS[tag]).filter(Boolean);
  return [
    tags.join(" · "),
    testCase.notaCobertura ? `Cobertura: ${testCase.notaCobertura}` : null,
    testCase.nota ?? null,
  ]
    .filter(Boolean)
    .join("\n");
}

function resultDate(result) {
  if (result.data) return formatDate(result.data);
  return result.origem ? (ORIGIN_LABELS[result.origem] ?? result.origem) : "";
}

function resultObs(testCase, result) {
  return [
    result.obs,
    testCase.automacao === "parcial" && result.origem === "automatico"
      ? "Cobertura parcial: parte da regra não é verificada pelo teste."
      : null,
    result.nota ? `Nota: ${result.nota}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function casesSheet(model) {
  const hasContext = model.sections.some((section) =>
    section.cases.some((testCase) => testCase.contexto),
  );
  const header = [
    "ID",
    "Seção",
    ...(hasContext ? ["Contexto"] : []),
    "Cenário / regra",
    "Automação",
    "Etiquetas e cobertura",
    ...model.environments.flatMap((environment) => [
      `${environment.label} · OK`,
      `${environment.label} · Data`,
      `${environment.label} · Obs`,
    ]),
  ];
  const widths = [
    13,
    24,
    ...(hasContext ? [26] : []),
    52,
    14,
    28,
    ...model.environments.flatMap(() => [15, 16, 60]),
  ];
  const rows = [header.map((title) => ({ v: title, s: "header" }))];
  for (const section of model.sections) {
    for (const testCase of section.cases) {
      rows.push([
        { v: testCase.id, s: "cellBold" },
        section.name,
        ...(hasContext ? [testCase.contexto ?? ""] : []),
        testCase.regra,
        AUTOMATION_LABELS[testCase.automacao] ?? testCase.automacao,
        { v: caseNotes(testCase), s: "cellMuted" },
        ...model.environments.flatMap((environment) => {
          const result = testCase.results[environment.id];
          return [
            statusCell(result.status),
            { v: resultDate(result), s: "cellMuted" },
            resultObs(testCase, result),
          ];
        }),
      ]);
    }
  }
  const firstStatusColumn = header.indexOf(`${model.environments[0]?.label} · OK`);
  return {
    sheet: {
      name: CASES_SHEET,
      columns: widths,
      rows: withHeights(rows, widths),
      freezeRow: 1,
      freezeColumn: 1,
      autoFilterRow: 1,
      printTitleRow: 1,
    },
    statusColumns: model.environments.map((environment, index) =>
      columnLetter(firstStatusColumn + index * 3),
    ),
    sectionColumn: "B",
    lastRow: rows.length,
  };
}

function testsSheet(model) {
  const header = [
    "ID",
    "Ambiente",
    "Resultado",
    "Teste",
    "Arquivo",
    "Projeto",
    "Duração (s)",
    "Motivo",
    "Esperado",
    "Encontrado",
    "Data",
  ];
  const widths = [13, 12, 15, 50, 40, 18, 11, 48, 28, 48, 16];
  const rows = [header.map((title) => ({ v: title, s: "header" }))];
  for (const section of model.sections) {
    for (const testCase of section.cases) {
      for (const environment of model.environments) {
        const result = testCase.results[environment.id];
        for (const test of result.testes ?? []) {
          const failure =
            test.falha ?? (test.erro ? { motivo: test.erro } : null);
          rows.push([
            { v: testCase.id, s: "cellBold" },
            environment.label,
            statusCell(test.status),
            test.titulo,
            { v: `${test.arquivo}:${test.linha}`, s: "cellMuted" },
            { v: test.projeto, s: "cellMuted" },
            {
              v: Math.round((test.duracaoMs ?? 0) / 100) / 10,
              s: "number",
            },
            failure?.motivo ?? test.motivo ?? "",
            failure?.esperado ?? "",
            failure?.encontrado ?? "",
            { v: formatDate(result.data), s: "cellMuted" },
          ]);
        }
      }
    }
  }
  return {
    name: "Testes executados",
    columns: widths,
    rows: withHeights(rows, widths),
    freezeRow: 1,
    freezeColumn: 1,
    autoFilterRow: 1,
    printTitleRow: 1,
  };
}

function runsSheet(model) {
  const header = [
    "Data",
    "Ambiente",
    "Portal",
    "Projetos",
    "Testes",
    "Casos",
    ...STATUS_ORDER.slice(0, 4).map((status) => STATUSES[status].label),
    "Duração",
    "Resultado do Playwright",
    "Máquina",
  ];
  const widths = [16, 12, 28, 40, 9, 9, 9, 9, 12, 12, 12, 14, 10];
  const labels = Object.fromEntries(
    model.environments.map((environment) => [environment.id, environment.label]),
  );
  const rows = [header.map((title) => ({ v: title, s: "header" }))];
  for (const run of model.runs) {
    rows.push([
      formatDate(run.fim),
      labels[run.ambiente] ?? run.ambiente,
      run.portal ?? "",
      (run.projetos ?? []).join(", "),
      { v: run.testes ?? 0, s: "number" },
      { v: run.casos ?? 0, s: "number" },
      ...STATUS_ORDER.slice(0, 4).map((status) => ({
        v: run.totais?.[status] ?? 0,
        s: "number",
      })),
      formatDurationShort(run.duracaoMs),
      run.status === "passed" ? "Sem falhas" : run.status === "failed" ? "Com falhas" : (run.status ?? ""),
      run.maquina ?? "",
    ]);
  }
  return {
    name: "Execuções",
    columns: widths,
    rows: withHeights(rows, widths),
    freezeRow: 1,
    autoFilterRow: 1,
  };
}

function formatDurationShort(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "";
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.round((milliseconds % 60000) / 1000);
  return minutes ? `${minutes} min ${seconds} s` : `${seconds} s`;
}

const quoted = `'${CASES_SHEET}'`;

function summarySheet(model, cases) {
  const rows = [];
  const merges = [];
  const width = 4 + STATUS_ORDER.length;
  const blank = () => Array.from({ length: width }, () => null);
  const push = (cells) => rows.push(cells);

  push([{ v: model.title, s: "title" }]);
  push([
    {
      v: `Gerado em ${formatDate(model.generatedAt)} · ${model.total} cenários. OK e Obs preenchidos a cada execução do Playwright; casos manuais via npm run casos:registrar.`,
      s: "subtitle",
    },
  ]);
  merges.push(`A2:${columnLetter(width - 1)}2`);
  push(blank());

  push([{ v: "Resultado por ambiente", s: "label" }]);
  push(
    [
      "Ambiente",
      "Última execução",
      "Total",
      ...STATUS_ORDER.map((status) => STATUSES[status].label),
      "% OK",
    ].map((title) => ({ v: title, s: "header" })),
  );
  model.environments.forEach((environment, index) => {
    const column = cases.statusColumns[index];
    const range = `${quoted}!$${column}$2:$${column}$${cases.lastRow}`;
    const rowNumber = rows.length + 1;
    const counts = environment.summary.counts;
    push([
      { v: environment.label, s: "cellBold" },
      environment.lastRun ? formatDate(environment.lastRun.fim) : "Sem execução",
      { v: environment.summary.total, f: `COUNTA(${range})`, s: "number" },
      ...STATUS_ORDER.map((status) => ({
        v: counts[status] ?? 0,
        f: `COUNTIF(${range},"${STATUSES[status].label}")`,
        s: "number",
      })),
      {
        v: environment.summary.total ? (counts.ok ?? 0) / environment.summary.total : 0,
        f: `IF(C${rowNumber}=0,0,D${rowNumber}/C${rowNumber})`,
        s: "percent",
      },
    ]);
  });
  push(blank());

  push([{ v: "Resultado por seção", s: "label" }]);
  push(
    [
      "Seção",
      "Cenários",
      ...model.environments.flatMap((environment) => [
        `${environment.label} · OK`,
        `${environment.label} · Falhou`,
      ]),
    ].map((title) => ({ v: title, s: "header" })),
  );
  for (const section of model.sections) {
    const sectionRange = `${quoted}!$${cases.sectionColumn}$2:$${cases.sectionColumn}$${cases.lastRow}`;
    const rowNumber = rows.length + 1;
    const name = section.name.replace(/"/g, '""');
    push([
      { v: section.name, s: "cellBold" },
      { v: section.cases.length, f: `COUNTIF(${sectionRange},A${rowNumber})`, s: "number" },
      ...model.environments.flatMap((environment, index) => {
        const column = cases.statusColumns[index];
        const range = `${quoted}!$${column}$2:$${column}$${cases.lastRow}`;
        const count = (status) =>
          section.cases.filter((testCase) => testCase.results[environment.id].status === status).length;
        return [
          { v: count("ok"), f: `COUNTIFS(${sectionRange},"${name}",${range},"OK")`, s: "number" },
          { v: count("falhou"), f: `COUNTIFS(${sectionRange},"${name}",${range},"Falhou")`, s: "number" },
        ];
      }),
    ]);
  }
  push(blank());

  push([{ v: "Legenda", s: "label" }]);
  const legend = {
    ok: "Passou na última execução (ou marcado OK manualmente).",
    falhou: "Falhou na última execução; a Obs traz motivo, esperado e encontrado.",
    "defeito-conhecido": "Teste marcado como falha esperada (test.fail).",
    "nao-executado": "Pulado: faltou massa, capacidade ou configuração.",
    scci: "Depende de ajuste no SCCI.",
    alterado: "Regra alterada a pedido do cliente.",
    duvida: "Aguardando definição.",
    pendente: "Nunca executado nem registrado.",
  };
  for (const status of STATUS_ORDER) {
    const rowNumber = rows.length + 1;
    push([statusCell(status), { v: legend[status], s: "subtitle" }]);
    merges.push(`B${rowNumber}:${columnLetter(width - 1)}${rowNumber}`);
  }

  return {
    name: SUMMARY_SHEET,
    columns: [30, 18, ...Array.from({ length: width - 2 }, () => 13)],
    rows,
    merges,
  };
}

export function renderWorkbook(model) {
  const cases = casesSheet(model);
  return buildXlsx({
    title: model.title,
    sheets: [
      summarySheet(model, cases),
      cases.sheet,
      testsSheet(model),
      runsSheet(model),
    ],
  });
}
