import { parseArgs } from "node:util";
import {
  availableDocuments,
  DOCUMENTS,
  environmentLabel,
  findDocumentForCase,
  loadCatalog,
  loadResults,
  recordCaseResult,
  resolveEnvironment,
  saveResults,
  setCaseNote,
  STATUSES,
  summarize,
  visibleEnvironments,
} from "./lib.mjs";
import { renderDocuments } from "./render.mjs";
import { syncSimulatorCatalog } from "./simulador.mjs";

const STATUS_ALIASES = {
  nok: "falhou",
  erro: "falhou",
  "dúvida": "duvida",
  "não-executado": "nao-executado",
  "nao executado": "nao-executado",
  defeito: "defeito-conhecido",
};

const USAGE = `Uso:
  npm run casos:gerar                        Regera o HTML e o Markdown de todos os documentos.
  npm run casos:resumo [-- --ambiente ht]    Mostra o resumo no terminal.
  npm run casos:validar                      Valida os catálogos.
  npm run casos:simulador:sincronizar        Atualiza o catálogo do Simulador a partir da suíte.
  npm run casos:registrar -- <ID[,ID...]> --status <status> [--obs "texto"]
      [--ambiente <perfil>] [--por "nome"] [--nota "texto fixo" | --limpar-nota]

Documentos: ${Object.keys(DOCUMENTS).join(", ")} (use --doc <nome> em gerar, resumo e validar).
Status: ${Object.keys(STATUSES).join(", ")}.
O ambiente padrão é o PW_PROFILE ativo (.env.local).
--nota grava um lembrete fixo que continua aparecendo na Obs mesmo depois
das próximas execuções automáticas.`;

function fail(message) {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

function normalizeStatus(value) {
  const normalized = value?.trim().toLowerCase();
  return STATUS_ALIASES[normalized] ?? normalized;
}

function selectedDocuments(documentId) {
  if (!documentId) return availableDocuments();
  if (!DOCUMENTS[documentId]) fail(`Documento desconhecido: ${documentId}.`);
  return [documentId];
}

function generate(argv) {
  const { values } = parseArgs({ args: argv, options: { doc: { type: "string" } } });
  for (const documentId of selectedDocuments(values.doc)) {
    const paths = renderDocuments(documentId, loadCatalog(documentId), loadResults(documentId));
    console.log(`Documento gerado:\n  ${paths.html}\n  ${paths.markdown}`);
  }
}

function register(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      status: { type: "string" },
      obs: { type: "string" },
      ambiente: { type: "string" },
      por: { type: "string" },
      nota: { type: "string" },
      "limpar-nota": { type: "boolean" },
    },
  });

  const ids = positionals
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (!ids.length) fail("Informe ao menos um ID de caso.");

  const status = values.status ? normalizeStatus(values.status) : undefined;
  if (status && !STATUSES[status]) fail(`Status inválido: ${values.status}.`);
  if (!status && values.nota === undefined && !values["limpar-nota"]) {
    fail("Informe --status, --nota ou --limpar-nota.");
  }

  const idsByDocument = new Map();
  const unknown = [];
  for (const id of ids) {
    const documentId = findDocumentForCase(id);
    if (!documentId) {
      unknown.push(id);
      continue;
    }
    if (!idsByDocument.has(documentId)) idsByDocument.set(documentId, []);
    idsByDocument.get(documentId).push(id);
  }
  if (unknown.length) fail(`Caso(s) inexistente(s) nos catálogos: ${unknown.join(", ")}.`);

  const environment = (values.ambiente ?? resolveEnvironment()).toLowerCase();
  const now = new Date().toISOString();

  for (const [documentId, documentIds] of idsByDocument) {
    const catalog = loadCatalog(documentId);
    const results = loadResults(documentId);
    for (const id of documentIds) {
      if (status) {
        recordCaseResult(results, id, environment, {
          status,
          obs: values.obs?.trim() || null,
          data: now,
          origem: "manual",
          ...(values.por ? { por: values.por.trim() } : {}),
        });
      }
      if (values["limpar-nota"]) setCaseNote(results, id, environment, null);
      else if (values.nota !== undefined) {
        setCaseNote(results, id, environment, values.nota.trim() || null);
      }
    }
    saveResults(documentId, results);
    const paths = renderDocuments(documentId, catalog, results);
    console.log(
      `${documentIds.length} caso(s) registrado(s) em ${environmentLabel(catalog, environment)}${status ? ` como ${STATUSES[status].label}` : ""}.\nDocumento: ${paths.html}`,
    );
  }
}

function summary(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { ambiente: { type: "string" }, doc: { type: "string" } },
  });
  for (const documentId of selectedDocuments(values.doc)) {
    const catalog = loadCatalog(documentId);
    const results = loadResults(documentId);
    const environments = values.ambiente
      ? [values.ambiente.toLowerCase()]
      : visibleEnvironments(catalog, results);

    console.log(`\n${catalog.titulo}`);
    for (const environment of environments) {
      const { counts, total, fromSheet } = summarize(catalog, results, environment);
      console.log(`  ${environmentLabel(catalog, environment)} (${total} casos)`);
      for (const [status, meta] of Object.entries(STATUSES)) {
        if (counts[status]) console.log(`    ${meta.label.padEnd(18)} ${counts[status]}`);
      }
      if (fromSheet) console.log(`    (${fromSheet} ainda com o status da planilha original)`);
    }
  }
}

function validate(argv) {
  const { values } = parseArgs({ args: argv, options: { doc: { type: "string" } } });
  for (const documentId of selectedDocuments(values.doc)) {
    const catalog = loadCatalog(documentId);
    console.log(`${catalog.titulo}: catálogo válido, ${catalog.casos.length} casos.`);
  }
}

function syncSimulator() {
  const { total, added, removed } = syncSimulatorCatalog();
  console.log(`Catálogo do Simulador: ${total} casos.`);
  if (added.length) console.log(`  Novos: ${added.join(", ")}`);
  if (removed.length) console.log(`  Removidos (saíram da suíte): ${removed.join(", ")}`);
  const paths = renderDocuments("simulador", loadCatalog("simulador"), loadResults("simulador"));
  console.log(`Documento gerado:\n  ${paths.html}\n  ${paths.markdown}`);
}

const [command, ...rest] = process.argv.slice(2);
switch (command) {
  case "gerar":
    generate(rest);
    break;
  case "registrar":
    register(rest);
    break;
  case "resumo":
    summary(rest);
    break;
  case "validar":
    validate(rest);
    break;
  case "sincronizar-simulador":
    syncSimulator();
    break;
  default:
    fail(command ? `Comando desconhecido: ${command}.` : "Informe um comando.");
}
