import {
  AUTOMATION_LABELS,
  effectiveResult,
  environmentLabel,
  formatDate,
  formatDuration,
  DOCS_DIR,
  documentPaths,
  STATUSES,
  summarize,
  visibleEnvironments,
  writeFileAtomic,
} from "./lib.mjs";

const ORIGIN_LABELS = {
  automatico: "Playwright",
  manual: "Manual",
  planilha: "Planilha original",
};

export function renderDocuments(documentId, catalog, results) {
  const paths = documentPaths(documentId);
  const model = buildModel(catalog, results);
  model.files = {
    catalog: relativeDocPath(paths.catalog),
    results: relativeDocPath(paths.results),
    html: paths.htmlName,
    markdown: paths.markdownName,
    csv: `${paths.htmlName.replace(/\.html$/, "").toLowerCase().replace(/_/g, "-")}.csv`,
  };
  writeFileAtomic(paths.html, renderHtml(model));
  writeFileAtomic(paths.markdown, renderMarkdown(model));
  return { html: paths.html, markdown: paths.markdown };
}

function relativeDocPath(path) {
  return `Docs/CasosDeTeste/${path.slice(DOCS_DIR.length + 1)}`;
}

/** Rótulos das tags dos testes que ajudam a ler o caso (as genéricas ficam de fora). */
const TAG_LABELS = {
  "pendente-produto": "Hipótese a confirmar com Produto",
  "depende-decisao": "Depende de decisão",
  investigacao: "Em investigação",
  "grava-simulacao": "Grava simulação no SCCI",
  mutation: "Cria dados no SCCI",
  "scci-db": "Confere no banco do SCCI",
  "external-state": "Depende de estado externo",
  consumable: "Consome massa",
};

function caseTags(testCase) {
  return (testCase.tags ?? [])
    .filter((tag) => TAG_LABELS[tag])
    .map((tag) => ({ tag, label: TAG_LABELS[tag] }));
}

function buildModel(catalog, results) {
  const environments = visibleEnvironments(catalog, results).map((id) => ({
    id,
    label: environmentLabel(catalog, id),
    summary: summarize(catalog, results, id),
    lastRun: (results.execucoes ?? []).find((run) => run.ambiente === id) ?? null,
  }));

  const sections = [];
  for (const testCase of catalog.casos) {
    let section = sections.find((item) => item.name === testCase.secao);
    if (!section) {
      section = { name: testCase.secao, cases: [] };
      sections.push(section);
    }
    section.cases.push({
      ...testCase,
      results: Object.fromEntries(
        environments.map((environment) => [
          environment.id,
          effectiveResult(testCase, results, environment.id),
        ]),
      ),
    });
  }

  const automation = { automatizado: 0, parcial: 0, manual: 0 };
  for (const testCase of catalog.casos) automation[testCase.automacao] += 1;

  return {
    title: catalog.titulo ?? "Casos de teste",
    generatedAt: new Date().toISOString(),
    environments,
    sections,
    automation,
    total: catalog.casos.length,
    runs: results.execucoes ?? [],
    unmatched: results.semCaso ?? {},
  };
}

function automationSentence(model) {
  const { automatizado, parcial, manual } = model.automation;
  if (!parcial && !manual) return `${model.total} casos, todos automatizados.`;
  return `${model.total} casos — ${automatizado} automatizados, ${parcial} com automação parcial e ${manual} manuais.`;
}

/* ----------------------------------------------------------------- HTML -- */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function multiline(value) {
  return escapeHtml(value)
    .replace(/(^|\n)(Esperado|Encontrado|Elemento):/g, '$1<strong class="lbl">$2:</strong>')
    .replace(/\n/g, "<br>");
}

function failureBlock(test) {
  if (!test.falha && !test.erro) return "";
  if (!test.falha) return `<br><span class="err">${escapeHtml(test.erro)}</span>`;
  const rows = [
    ["Motivo", test.falha.motivo],
    ["Esperado", test.falha.esperado],
    ["Encontrado", test.falha.encontrado],
    ["Elemento", test.falha.elemento],
  ].filter(([, value]) => value);
  return `<dl class="failure">${rows.map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>`;
}

function statusBadge(status) {
  const meta = STATUSES[status] ?? STATUSES.pendente;
  return `<span class="badge tone-${meta.tone}"><span class="dot" aria-hidden="true"></span>${escapeHtml(meta.label)}</span>`;
}

function resultMeta(result) {
  const parts = [];
  if (result.origem) parts.push(ORIGIN_LABELS[result.origem] ?? result.origem);
  if (result.data) parts.push(formatDate(result.data));
  if (result.por) parts.push(result.por);
  return parts.join(" · ");
}

function historyStrip(history) {
  if (!history?.length) return "";
  const cells = history
    .map((item) => {
      const meta = STATUSES[item.status] ?? STATUSES.pendente;
      const label = `${meta.label} — ${formatDate(item.data)}${item.origem === "manual" ? " (manual)" : ""}`;
      return `<span class="hist tone-${meta.tone}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></span>`;
    })
    .join("");
  return `<span class="hist-strip" role="img" aria-label="Histórico, mais recente à esquerda">${cells}</span>`;
}

function renderCaseDetails(testCase, environments) {
  const links = (testCase.vinculos ?? [])
    .map(
      (link) =>
        `<li><code>${escapeHtml(link.arquivo ?? "qualquer spec")}</code>${link.titulo ? ` — ${escapeHtml(link.titulo)}` : " — todos os testes do arquivo"}</li>`,
    )
    .join("");

  const perEnvironment = environments
    .map((environment) => {
      const result = testCase.results[environment.id];
      const sheet = testCase.planilha?.[environment.id];
      const tests = (result.testes ?? [])
        .map((test) => {
          const meta = STATUSES[test.status] ?? STATUSES.pendente;
          return `<li><span class="mini tone-${meta.tone}">${escapeHtml(meta.label)}</span> <code>${escapeHtml(test.arquivo)}:${escapeHtml(test.linha)}</code> <span class="muted">[${escapeHtml(test.projeto)}] ${escapeHtml(formatDuration(test.duracaoMs))}</span><br>${escapeHtml(test.titulo)}${failureBlock(test)}${test.motivo ? `<br><span class="muted">${escapeHtml(test.motivo)}</span>` : ""}</li>`;
        })
        .join("");
      const history = (result.historico ?? [])
        .slice(0, 5)
        .map(
          (item) =>
            `<li>${statusBadge(item.status)} <span class="muted">${escapeHtml(formatDate(item.data))} · ${escapeHtml(ORIGIN_LABELS[item.origem] ?? item.origem ?? "")}</span>${item.obs ? `<br>${escapeHtml(item.obs)}` : ""}</li>`,
        )
        .join("");
      return `<div class="env-detail">
  <h4>${escapeHtml(environment.label)}</h4>
  ${tests ? `<p class="label">Testes da última execução</p><ul class="plain">${tests}</ul>` : ""}
  ${history ? `<p class="label">Histórico recente ${historyStrip(result.historico)}</p><ul class="plain">${history}</ul>` : ""}
  ${sheet?.status ? `<p class="label">Planilha original</p><p>${statusBadge(sheet.status)} ${escapeHtml(sheet.obs ?? "")}</p>` : ""}
</div>`;
    })
    .join("");

  return `<details class="case-details">
  <summary>Detalhes</summary>
  <div class="details-body">
    ${testCase.notaCobertura ? `<p class="coverage-note"><strong>Cobertura:</strong> ${escapeHtml(testCase.notaCobertura)}</p>` : ""}
    ${testCase.nota ? `<p class="coverage-note">${escapeHtml(testCase.nota)}</p>` : ""}
    ${links ? `<p class="label">Testes vinculados</p><ul class="plain">${links}</ul>` : `<p class="muted">Sem automação: preencha com <code>npm run casos:registrar</code>.</p>`}
    <div class="env-details">${perEnvironment}</div>
  </div>
</details>`;
}

function renderCaseRow(testCase, environments) {
  const searchText = [
    testCase.id,
    testCase.contexto ?? "",
    testCase.regra,
    testCase.secao,
    ...caseTags(testCase).map((item) => item.label),
    ...environments.map((environment) => testCase.results[environment.id].obs ?? ""),
  ]
    .join(" ")
    .toLowerCase();
  const statusAttributes = environments
    .map(
      (environment) =>
        `data-status-${environment.id}="${escapeHtml(testCase.results[environment.id].status)}"`,
    )
    .join(" ");

  const environmentCells = environments
    .map((environment) => {
      const result = testCase.results[environment.id];
      const meta = resultMeta(result);
      const partial =
        testCase.automacao === "parcial" && result.origem === "automatico"
          ? `<span class="note">Cobertura parcial: parte da regra não é verificada pelo teste (ver Detalhes).</span>`
          : "";
      return `<td class="env-ok" data-env="${escapeHtml(environment.id)}" data-label="${escapeHtml(environment.label)} · OK">${statusBadge(result.status)}${meta ? `<span class="meta">${escapeHtml(meta)}</span>` : ""}${historyStrip(result.historico)}</td>
<td class="env-obs" data-env="${escapeHtml(environment.id)}" data-label="${escapeHtml(environment.label)} · Obs">${result.obs ? `<span>${multiline(result.obs)}</span>` : `<span class="muted">—</span>`}${partial}${result.nota ? `<span class="note">📌 ${escapeHtml(result.nota)}</span>` : ""}</td>`;
    })
    .join("\n");

  return `<tr id="${escapeHtml(testCase.id)}" data-search="${escapeHtml(searchText)}" data-auto="${escapeHtml(testCase.automacao)}" ${statusAttributes}>
<td class="case-id" data-label="ID"><a href="#${escapeHtml(testCase.id)}">${escapeHtml(testCase.id)}</a></td>
<td class="rule" data-label="Regra">${testCase.contexto ? `<span class="context">${escapeHtml(testCase.contexto)}</span>` : ""}<p>${multiline(testCase.regra)}</p>${caseTags(testCase).length ? `<p class="tags">${caseTags(testCase).map((item) => `<span class="tag tag-${escapeHtml(item.tag)}">${escapeHtml(item.label)}</span>`).join("")}</p>` : ""}${renderCaseDetails(testCase, environments)}</td>
<td class="auto" data-label="Automação"><span class="pill auto-${escapeHtml(testCase.automacao)}">${escapeHtml(AUTOMATION_LABELS[testCase.automacao])}</span></td>
${environmentCells}
</tr>`;
}

function renderSection(section, environments, index) {
  const sectionId = `secao-${index + 1}`;
  const headerEnvironments = environments
    .map(
      (environment) =>
        `<th colspan="2" class="env-head" data-env="${escapeHtml(environment.id)}" scope="colgroup">${escapeHtml(environment.label)}</th>`,
    )
    .join("");
  const subHeader = environments
    .map(
      (environment) =>
        `<th class="env-ok" data-env="${escapeHtml(environment.id)}" scope="col">OK</th><th class="env-obs" data-env="${escapeHtml(environment.id)}" scope="col">Obs</th>`,
    )
    .join("");

  return `<section class="group" data-section="${escapeHtml(section.name)}" aria-labelledby="${sectionId}">
  <h2 id="${sectionId}">${escapeHtml(section.name)} <span class="count" data-count>${section.cases.length} casos</span></h2>
  <div class="table-wrap">
  <table>
    <thead>
      <tr><th rowspan="2" scope="col" class="col-id">ID</th><th rowspan="2" scope="col" class="col-rule">Regra</th><th rowspan="2" scope="col" class="col-auto">Automação</th>${headerEnvironments}</tr>
      <tr>${subHeader}</tr>
    </thead>
    <tbody>
${section.cases.map((testCase) => renderCaseRow(testCase, environments)).join("\n")}
    </tbody>
  </table>
  </div>
</section>`;
}

function renderSummaryCard(environment) {
  const { counts, total, fromSheet } = environment.summary;
  const order = [
    "ok",
    "falhou",
    "defeito-conhecido",
    "nao-executado",
    "scci",
    "alterado",
    "duvida",
    "pendente",
  ];
  const segments = order
    .filter((status) => counts[status])
    .map((status) => {
      const meta = STATUSES[status];
      const width = ((counts[status] / total) * 100).toFixed(2);
      return `<span class="seg tone-${meta.tone}" style="width:${width}%" title="${escapeHtml(`${meta.label}: ${counts[status]}`)}"></span>`;
    })
    .join("");
  const legend = order
    .filter((status) => counts[status])
    .map(
      (status) =>
        `<li><button type="button" class="chip" data-filter-status="${status}" data-filter-env="${escapeHtml(environment.id)}">${statusBadge(status)}<strong>${counts[status]}</strong></button></li>`,
    )
    .join("");
  const run = environment.lastRun;
  const runText = run
    ? `Última execução ${escapeHtml(formatDate(run.fim))} · ${escapeHtml(run.casos)} casos · ${escapeHtml(run.status === "passed" ? "sem falhas" : run.status)}`
    : "Ainda sem execução registrada";

  return `<article class="card">
  <header>
    <h3>${escapeHtml(environment.label)}</h3>
    ${run?.portal ? `<span class="muted host">${escapeHtml(run.portal)}</span>` : ""}
  </header>
  <p class="big"><span>${counts.ok ?? 0}</span><small>/ ${total} OK</small></p>
  <div class="bar" role="img" aria-label="${escapeHtml(order.filter((status) => counts[status]).map((status) => `${STATUSES[status].label} ${counts[status]}`).join(", "))}">${segments}</div>
  <ul class="legend">${legend}</ul>
  <p class="muted small">${runText}${fromSheet ? ` · ${fromSheet} casos ainda com o status da planilha original` : ""}</p>
</article>`;
}

function renderRuns(runs, environmentsById) {
  if (!runs.length) return "";
  const rows = runs
    .slice(0, 15)
    .map((run) => {
      const totals = Object.entries(run.totais ?? {})
        .map(([status, count]) => `${count} ${(STATUSES[status]?.label ?? status).toLowerCase()}`)
        .join(", ");
      return `<tr><td data-label="Data">${escapeHtml(formatDate(run.fim))}</td><td data-label="Ambiente">${escapeHtml(environmentsById[run.ambiente] ?? run.ambiente)}</td><td data-label="Projetos">${escapeHtml((run.projetos ?? []).join(", "))}</td><td data-label="Casos" class="num">${escapeHtml(run.casos ?? "")}</td><td data-label="Resultado">${escapeHtml(totals)}</td><td data-label="Duração">${escapeHtml(formatDuration(run.duracaoMs))}</td><td data-label="Origem">${escapeHtml(run.origem === "manual" ? "Manual" : run.maquina ?? "")}</td></tr>`;
    })
    .join("");
  return `<section class="group" aria-labelledby="execucoes">
  <h2 id="execucoes">Últimas execuções</h2>
  <div class="table-wrap"><table class="compact">
    <thead><tr><th scope="col">Data</th><th scope="col">Ambiente</th><th scope="col">Projetos</th><th scope="col">Casos</th><th scope="col">Resultado</th><th scope="col">Duração</th><th scope="col">Origem</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
</section>`;
}

function renderUnmatched(unmatched, environmentsById) {
  const entries = Object.entries(unmatched).filter(([, tests]) => tests.length);
  if (!entries.length) return "";
  const blocks = entries
    .map(
      ([environment, tests]) =>
        `<h3>${escapeHtml(environmentsById[environment] ?? environment)} <span class="count">${tests.length}</span></h3><ul class="plain">${tests
          .map(
            (test) =>
              `<li><span class="mini tone-${STATUSES[test.status]?.tone ?? "muted"}">${escapeHtml(STATUSES[test.status]?.label ?? test.status)}</span> <code>${escapeHtml(test.arquivo)}:${escapeHtml(test.linha)}</code> <span class="muted">[${escapeHtml(test.projeto)}]</span> ${escapeHtml(test.titulo)}</li>`,
          )
          .join("")}</ul>`,
    )
    .join("");
  return `<section class="group" aria-labelledby="sem-caso">
  <h2 id="sem-caso">Testes executados sem caso no catálogo</h2>
  <p class="muted">Rodaram na última execução de cada ambiente, mas nenhum caso de <code>catalogo.json</code> aponta para eles. Vincule-os a um caso existente ou crie um caso novo.</p>
  ${blocks}
</section>`;
}

function renderHtml(model) {
  const environmentsById = Object.fromEntries(
    model.environments.map((environment) => [environment.id, environment.label]),
  );
  const csvData = model.sections.flatMap((section) =>
    section.cases.map((testCase) => ({
      id: testCase.id,
      secao: section.name,
      regra: testCase.regra,
      automacao: AUTOMATION_LABELS[testCase.automacao],
      ambientes: Object.fromEntries(
        model.environments.map((environment) => {
          const result = testCase.results[environment.id];
          return [
            environment.id,
            {
              status: STATUSES[result.status]?.label ?? result.status,
              obs: [result.obs, result.nota].filter(Boolean).join(" | "),
              data: formatDate(result.data),
            },
          ];
        }),
      ),
    })),
  );

  const statusOptions = Object.keys(STATUSES)
    .map(
      (status) =>
        `<label class="toggle"><input type="checkbox" name="status" value="${status}"> ${statusBadge(status)}</label>`,
    )
    .join("");
  const environmentOptions = model.environments
    .map(
      (environment) =>
        `<option value="${escapeHtml(environment.id)}">${escapeHtml(environment.label)}</option>`,
    )
    .join("");
  const sectionOptions = model.sections
    .map(
      (section) =>
        `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(model.title)}</title>
<meta name="description" content="Casos de teste do Portal Next com o resultado (OK) e a observação de cada execução, por ambiente.">
<style>
:root {
  color-scheme: light;
  --bg: #f5f6f8;
  --surface: #ffffff;
  --surface-2: #f9fafb;
  --text: #15171c;
  --muted: #5d6472;
  --border: #e2e5ea;
  --accent: oklch(0.52 0.19 257);
  --ok: #17733a; --ok-bg: #e5f4ea;
  --fail: #b42318; --fail-bg: #fdecea;
  --warn: #8a5a00; --warn-bg: #fff3d6;
  --info: #3346a8; --info-bg: #e9edfc;
  --muted-tone: #5d6472; --muted-bg: #eef0f3;
  --shadow: 0 1px 2px rgb(16 24 40 / 6%), 0 1px 3px rgb(16 24 40 / 8%);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0e1015; --surface: #161920; --surface-2: #1b1f27; --text: #e8eaef; --muted: #9aa3b2; --border: #2a2f3a;
    --accent: oklch(0.72 0.14 257);
    --ok: #5fd08a; --ok-bg: rgb(95 208 138 / 14%);
    --fail: #ff8a80; --fail-bg: rgb(255 138 128 / 14%);
    --warn: #f2c14e; --warn-bg: rgb(242 193 78 / 14%);
    --info: #9db0ff; --info-bg: rgb(157 176 255 / 14%);
    --muted-tone: #9aa3b2; --muted-bg: rgb(154 163 178 / 14%);
    --shadow: none;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0e1015; --surface: #161920; --surface-2: #1b1f27; --text: #e8eaef; --muted: #9aa3b2; --border: #2a2f3a;
  --accent: oklch(0.72 0.14 257);
  --ok: #5fd08a; --ok-bg: rgb(95 208 138 / 14%);
  --fail: #ff8a80; --fail-bg: rgb(255 138 128 / 14%);
  --warn: #f2c14e; --warn-bg: rgb(242 193 78 / 14%);
  --info: #9db0ff; --info-bg: rgb(157 176 255 / 14%);
  --muted-tone: #9aa3b2; --muted-bg: rgb(154 163 178 / 14%);
  --shadow: none;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
code { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; padding: 0 4px; }
a { color: var(--accent); }
.page { max-width: 1680px; margin: 0 auto; padding: 32px 24px 64px; }
.page-header h1 { margin: 4px 0 6px; font-size: 26px; letter-spacing: -0.02em; }
.eyebrow { color: var(--accent); font-weight: 600; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
.lede { margin: 0; color: var(--muted); max-width: 900px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin: 24px 0; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; box-shadow: var(--shadow); }
.card header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.card h3 { margin: 0; font-size: 16px; }
.host { font-size: 12px; }
.big { margin: 8px 0; font-variant-numeric: tabular-nums; }
.big span { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
.big small { color: var(--muted); margin-left: 4px; }
.bar { display: flex; height: 10px; border-radius: 99px; overflow: hidden; background: var(--muted-bg); gap: 2px; }
.seg { display: block; height: 100%; }
.seg.tone-ok { background: var(--ok); } .seg.tone-fail { background: var(--fail); } .seg.tone-warn { background: var(--warn); } .seg.tone-info { background: var(--info); } .seg.tone-muted { background: var(--muted-tone); opacity: .45; }
.legend { list-style: none; margin: 12px 0 8px; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.chip { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px 2px 2px; border-radius: 99px; border: 1px solid var(--border); font-variant-numeric: tabular-nums; }
.chip:hover, .chip:focus-visible { border-color: var(--accent); outline: none; }
.chip[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 99px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.badge .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.tone-ok { color: var(--ok); background: var(--ok-bg); } .tone-fail { color: var(--fail); background: var(--fail-bg); } .tone-warn { color: var(--warn); background: var(--warn-bg); } .tone-info { color: var(--info); background: var(--info-bg); } .tone-muted { color: var(--muted-tone); background: var(--muted-bg); }
.mini { font-size: 11px; font-weight: 600; padding: 0 6px; border-radius: 4px; }
.muted { color: var(--muted); } .small { font-size: 12px; } .err { color: var(--fail); }
.toolbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; padding: 12px 14px; margin: 0 0 20px; background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(8px); border: 1px solid var(--border); border-radius: 12px; }
.toolbar input[type="search"], .toolbar select { font: inherit; color: inherit; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; min-height: 34px; }
.toolbar input[type="search"] { flex: 1 1 260px; }
.toolbar label.field { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
.toolbar .statuses { display: flex; flex-wrap: wrap; gap: 4px; }
.toggle { display: inline-flex; align-items: center; gap: 2px; cursor: pointer; }
.toggle input { accent-color: var(--accent); }
.toolbar button.action { font: inherit; font-size: 13px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; cursor: pointer; min-height: 34px; }
.toolbar button.action:hover { border-color: var(--accent); }
.result-count { color: var(--muted); font-size: 12px; margin-left: auto; font-variant-numeric: tabular-nums; }
.group { margin: 0 0 28px; }
.group h2 { font-size: 17px; margin: 0 0 10px; display: flex; align-items: baseline; gap: 10px; }
.group h3 { font-size: 14px; margin: 16px 0 6px; }
.count { color: var(--muted); font-size: 12px; font-weight: 500; }
.table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
thead th { background: var(--surface-2); color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
thead th.env-head { text-align: center; color: var(--text); border-left: 1px solid var(--border); }
th.env-ok, td.env-ok { border-left: 1px solid var(--border); }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:target { background: color-mix(in srgb, var(--accent) 8%, transparent); }
tbody tr { scroll-margin-top: 150px; }
.col-id { width: 108px; } .col-auto { width: 120px; }
td.case-id a { font-weight: 700; text-decoration: none; white-space: nowrap; font-size: 13px; }
td.rule { min-width: 320px; max-width: 560px; }
td.rule p { margin: 0 0 4px; }
.context { display: block; color: var(--muted); font-size: 12px; margin-bottom: 2px; }
.tags { display: flex; flex-wrap: wrap; gap: 4px; }
.tag { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 6px; border: 1px solid var(--border); color: var(--muted); }
.tag-pendente-produto, .tag-depende-decisao, .tag-investigacao { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 40%, transparent); }
td.env-ok { width: 150px; white-space: nowrap; }
td.env-obs { min-width: 220px; max-width: 380px; font-size: 13px; }
.meta { display: block; color: var(--muted); font-size: 11px; margin-top: 4px; }
.note { display: block; margin-top: 6px; font-size: 12px; color: var(--warn); }
.pill { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--border); white-space: nowrap; }
.auto-automatizado { color: var(--ok); } .auto-parcial { color: var(--warn); } .auto-manual { color: var(--muted); }
.hist-strip { display: inline-flex; gap: 2px; margin-top: 6px; vertical-align: middle; }
.hist { display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: currentColor; }
details.case-details summary { cursor: pointer; color: var(--accent); font-size: 12px; width: max-content; }
.details-body { margin-top: 8px; padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; font-size: 13px; }
.details-body .label { margin: 10px 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 600; }
.env-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.env-detail h4 { margin: 8px 0 0; font-size: 13px; }
ul.plain { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.coverage-note { margin: 0 0 6px; color: var(--warn); }
.lbl { font-weight: 600; }
td.env-obs .lbl { color: var(--muted); }
dl.failure { display: grid; grid-template-columns: max-content 1fr; gap: 2px 10px; margin: 6px 0 0; padding: 8px 10px; border-left: 3px solid var(--fail); background: var(--fail-bg); border-radius: 6px; }
dl.failure dt { font-weight: 600; color: var(--muted); font-size: 12px; }
dl.failure dd { margin: 0; overflow-wrap: anywhere; }
table.compact td { font-size: 13px; }
.num { font-variant-numeric: tabular-nums; }
.legend-text { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 6px 18px; margin: 0; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; font-size: 13px; }
.legend-text div { display: flex; gap: 8px; align-items: baseline; }
.hidden { display: none !important; }
footer { color: var(--muted); font-size: 12px; margin-top: 32px; }
@media (max-width: 860px) {
  .page { padding: 20px 16px 48px; }
  .toolbar { position: static; }
  .result-count { margin-left: 0; }
  code { overflow-wrap: anywhere; }
  table, thead, tbody, tr, th, td { display: block; }
  thead { display: none; }
  .table-wrap { overflow: visible; }
  tbody tr { padding: 10px 12px; border-bottom: 1px solid var(--border); }
  tbody td { border: 0 !important; padding: 4px 0; max-width: none; min-width: 0; width: auto; white-space: normal; }
  tbody td::before { content: attr(data-label); display: block; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
  td.case-id::before { display: none; }
}
@media print {
  .toolbar, details.case-details, .chip { display: none !important; }
  body { background: #fff; }
  .table-wrap, .card { box-shadow: none; }
}
</style>
</head>
<body>
<div class="page">
<header class="page-header">
  <div class="eyebrow">Portal Next · Playwright</div>
  <h1>${escapeHtml(model.title)}</h1>
  <p class="lede">${escapeHtml(automationSentence(model))} As colunas <strong>OK</strong> e <strong>Obs</strong> são preenchidas a cada execução do Playwright; casos manuais são registrados com <code>npm run casos:registrar</code>. Gerado em ${escapeHtml(formatDate(model.generatedAt))}.</p>
</header>

<section class="cards" aria-label="Resumo por ambiente">
${model.environments.map(renderSummaryCard).join("\n")}
</section>

<form class="toolbar" role="search" onsubmit="return false">
  <input type="search" id="q" placeholder="Buscar por ID, regra ou observação…" aria-label="Buscar casos">
  <label class="field">Seção <select id="section"><option value="">Todas</option>${sectionOptions}</select></label>
  <label class="field">Ambiente <select id="env"><option value="">Todos</option>${environmentOptions}</select></label>
  <label class="field">Automação <select id="auto"><option value="">Todas</option><option value="automatizado">Automatizado</option><option value="parcial">Parcial</option><option value="manual">Manual</option></select></label>
  <div class="statuses" role="group" aria-label="Filtrar por status">${statusOptions}</div>
  <button type="button" class="action" id="clear">Limpar filtros</button>
  <button type="button" class="action" id="csv">Exportar CSV</button>
  <span class="result-count" id="result-count" aria-live="polite"></span>
</form>

<main>
${model.sections.map((section, index) => renderSection(section, model.environments, index)).join("\n")}

${renderRuns(model.runs, environmentsById)}
${renderUnmatched(model.unmatched, environmentsById)}

<section class="group" aria-labelledby="legenda">
  <h2 id="legenda">Legenda</h2>
  <div class="legend-text">
    <div>${statusBadge("ok")}<span>Passou na última execução (ou marcado OK manualmente).</span></div>
    <div>${statusBadge("falhou")}<span>Falhou na última execução; a Obs traz o motivo.</span></div>
    <div>${statusBadge("defeito-conhecido")}<span>Teste marcado como falha esperada (<code>test.fail</code>).</span></div>
    <div>${statusBadge("nao-executado")}<span>Pulado: faltou massa, capacidade ou configuração.</span></div>
    <div>${statusBadge("scci")}<span>Depende de ajuste no SCCI.</span></div>
    <div>${statusBadge("alterado")}<span>Regra alterada a pedido do cliente.</span></div>
    <div>${statusBadge("duvida")}<span>Aguardando definição.</span></div>
    <div>${statusBadge("pendente")}<span>Nunca executado nem registrado.</span></div>
  </div>
</section>
</main>

<footer>Fonte: <code>${escapeHtml(model.files.catalog)}</code> (casos) e <code>${escapeHtml(model.files.results)}</code> (resultados). Regere com <code>npm run casos:gerar</code>.</footer>
</div>

<script type="application/json" id="csv-data">${JSON.stringify({ environments: model.environments.map(({ id, label }) => ({ id, label })), cases: csvData }).replace(/</g, "\\u003c")}</script>
<script>
(() => {
  const q = document.getElementById("q");
  const section = document.getElementById("section");
  const env = document.getElementById("env");
  const auto = document.getElementById("auto");
  const statusBoxes = [...document.querySelectorAll('input[name="status"]')];
  const groups = [...document.querySelectorAll("section.group[data-section]")];
  const counter = document.getElementById("result-count");
  const environments = JSON.parse(document.getElementById("csv-data").textContent).environments.map((e) => e.id);

  function apply() {
    const term = q.value.trim().toLowerCase();
    const statuses = statusBoxes.filter((box) => box.checked).map((box) => box.value);
    const envFilter = env.value;
    let visible = 0;
    for (const group of groups) {
      const showGroup = !section.value || group.dataset.section === section.value;
      let groupVisible = 0;
      for (const row of group.querySelectorAll("tbody tr")) {
        const envs = envFilter ? [envFilter] : environments;
        const matchesStatus = !statuses.length || envs.some((e) => statuses.includes(row.getAttribute("data-status-" + e)));
        const show = showGroup
          && (!term || row.dataset.search.includes(term))
          && (!auto.value || row.dataset.auto === auto.value)
          && matchesStatus;
        row.classList.toggle("hidden", !show);
        if (show) groupVisible += 1;
      }
      group.classList.toggle("hidden", groupVisible === 0);
      const count = group.querySelector("[data-count]");
      if (count) count.textContent = groupVisible + (groupVisible === 1 ? " caso" : " casos");
      visible += groupVisible;
    }
    for (const cell of document.querySelectorAll("[data-env]")) {
      if (cell.closest(".chip")) continue;
      cell.classList.toggle("hidden", Boolean(envFilter) && cell.dataset.env !== envFilter);
    }
    counter.textContent = visible + " de " + ${model.total} + " casos";
    for (const chip of document.querySelectorAll(".chip")) {
      const pressed = statuses.length === 1 && statuses[0] === chip.dataset.filterStatus && envFilter === chip.dataset.filterEnv;
      chip.setAttribute("aria-pressed", String(pressed));
    }
  }

  for (const control of [q, section, env, auto, ...statusBoxes]) control.addEventListener("input", apply);
  document.getElementById("clear").addEventListener("click", () => {
    q.value = ""; section.value = ""; env.value = ""; auto.value = "";
    statusBoxes.forEach((box) => { box.checked = false; });
    apply();
  });
  for (const chip of document.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => {
      const already = chip.getAttribute("aria-pressed") === "true";
      statusBoxes.forEach((box) => { box.checked = !already && box.value === chip.dataset.filterStatus; });
      env.value = already ? "" : chip.dataset.filterEnv;
      apply();
      if (!already) document.querySelector("main").scrollIntoView({ behavior: "smooth" });
    });
  }
  document.getElementById("csv").addEventListener("click", () => {
    const data = JSON.parse(document.getElementById("csv-data").textContent);
    const visibleIds = new Set([...document.querySelectorAll("tbody tr[id]:not(.hidden)")].map((row) => row.id));
    const envs = env.value ? data.environments.filter((e) => e.id === env.value) : data.environments;
    const header = ["ID", "Seção", "Regra", "Automação", ...envs.flatMap((e) => [e.label + " OK", e.label + " Obs", e.label + " Data"])];
    const quote = (value) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
    const lines = [header.map(quote).join(";")];
    for (const item of data.cases) {
      if (!visibleIds.has(item.id)) continue;
      lines.push([item.id, item.secao, item.regra, item.automacao, ...envs.flatMap((e) => [item.ambientes[e.id].status, item.ambientes[e.id].obs, item.ambientes[e.id].data])].map(quote).join(";"));
    }
    const blob = new Blob(["\\ufeff" + lines.join("\\r\\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = ${JSON.stringify(model.files.csv)};
    link.click();
    URL.revokeObjectURL(link.href);
  });
  apply();
})();
</script>
</body>
</html>
`;
}

/* ------------------------------------------------------------- Markdown -- */

function escapeCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>")
    .trim();
}

function markdownStatus(status) {
  const meta = STATUSES[status] ?? STATUSES.pendente;
  return `${meta.emoji} ${meta.label}`;
}

function renderMarkdown(model) {
  const lines = [];
  lines.push(`# ${model.title}`);
  lines.push("");
  lines.push(
    "> Gerado automaticamente — não edite à mão. As colunas **OK** e **Obs** são preenchidas a cada execução do Playwright (reporter `scripts/casos-de-teste/reporter.mjs`); casos manuais entram com `npm run casos:registrar`. " +
      `Versão interativa: [${model.files.html}](${model.files.html}).`,
  );
  lines.push("");
  lines.push(`Gerado em ${formatDate(model.generatedAt)}. ${automationSentence(model)}`);
  lines.push("");
  lines.push("## Resumo");
  lines.push("");
  const order = Object.keys(STATUSES);
  lines.push(
    `| Ambiente | Última execução | ${order.map((status) => STATUSES[status].label).join(" | ")} |`,
  );
  lines.push(`|---|---|${order.map(() => "---:").join("|")}|`);
  for (const environment of model.environments) {
    const { counts } = environment.summary;
    const run = environment.lastRun;
    lines.push(
      `| ${escapeCell(environment.label)} | ${run ? escapeCell(formatDate(run.fim)) : "—"} | ${order.map((status) => counts[status] ?? 0).join(" | ")} |`,
    );
  }
  lines.push("");

  for (const section of model.sections) {
    lines.push(`## ${section.name}`);
    lines.push("");
    const environmentHeaders = model.environments
      .map((environment) => `${environment.label} OK | ${environment.label} Obs`)
      .join(" | ");
    lines.push(`| ID | Regra | Automação | ${environmentHeaders} |`);
    lines.push(
      `|---|---|---|${model.environments.map(() => "---|---").join("|")}|`,
    );
    for (const testCase of section.cases) {
      const cells = model.environments.map((environment) => {
        const result = testCase.results[environment.id];
        const meta = [
          result.origem && result.origem !== "automatico"
            ? ORIGIN_LABELS[result.origem]
            : null,
          result.data ? formatDate(result.data) : null,
        ]
          .filter(Boolean)
          .join(" · ");
        const partial =
          testCase.automacao === "parcial" && result.origem === "automatico"
            ? "_Cobertura parcial._"
            : null;
        const obs = [result.obs, partial, result.nota ? `📌 ${result.nota}` : null]
          .filter(Boolean)
          .join("<br>");
        return `${escapeCell(markdownStatus(result.status))}${meta ? `<br><sub>${escapeCell(meta)}</sub>` : ""} | ${escapeCell(obs) || "—"}`;
      });
      const tags = caseTags(testCase).map((item) => item.label);
      const baseRule = [
        testCase.contexto ? `**${testCase.contexto}** — ${testCase.regra}` : testCase.regra,
        tags.length ? `_${tags.join(" · ")}_` : null,
      ]
        .filter(Boolean)
        .join("\n");
      const regra = testCase.notaCobertura
        ? `${baseRule}\n_Cobertura: ${testCase.notaCobertura}_`
        : baseRule;
      lines.push(
        `| ${testCase.id} | ${escapeCell(regra)} | ${escapeCell(AUTOMATION_LABELS[testCase.automacao])} | ${cells.join(" | ")} |`,
      );
    }
    lines.push("");
  }

  if (model.runs.length) {
    lines.push("## Últimas execuções");
    lines.push("");
    lines.push("| Data | Ambiente | Projetos | Casos | Resultado | Duração |");
    lines.push("|---|---|---|---:|---|---|");
    for (const run of model.runs.slice(0, 10)) {
      const environment = model.environments.find((item) => item.id === run.ambiente);
      const totals = Object.entries(run.totais ?? {})
        .map(([status, count]) => `${count} ${(STATUSES[status]?.label ?? status).toLowerCase()}`)
        .join(", ");
      lines.push(
        `| ${escapeCell(formatDate(run.fim))} | ${escapeCell(environment?.label ?? run.ambiente)} | ${escapeCell((run.projetos ?? []).join(", "))} | ${run.casos ?? ""} | ${escapeCell(totals)} | ${escapeCell(formatDuration(run.duracaoMs))} |`,
      );
    }
    lines.push("");
  }

  const unmatched = Object.entries(model.unmatched).filter(([, tests]) => tests.length);
  if (unmatched.length) {
    lines.push("## Testes executados sem caso no catálogo");
    lines.push("");
    for (const [environment, tests] of unmatched) {
      const label =
        model.environments.find((item) => item.id === environment)?.label ?? environment;
      lines.push(`**${label}**`);
      lines.push("");
      for (const test of tests) {
        lines.push(
          `- ${markdownStatus(test.status)} \`${test.arquivo}:${test.linha}\` [${test.projeto}] ${test.titulo}`,
        );
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
