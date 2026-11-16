import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

/**
 * Núcleo dos documentos de casos de teste (Docs/CasosDeTeste).
 *
 * Cada documento tem:
 * - catálogo: fonte da verdade dos casos (regra, seção, vínculo com os testes
 *   Playwright e, no Portal, o status original da planilha).
 * - resultados: último resultado de cada caso por ambiente, com histórico.
 *   Atualizado pelo reporter a cada execução do Playwright e pelo comando
 *   `npm run casos:registrar` para casos manuais.
 * - HTML e Markdown gerados a partir dos dois arquivos acima.
 */

export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const TESTS_DIR = join(REPO_ROOT, "tests");
// PW_CASOS_DIR permite gerar em outra pasta (ex.: ensaio sem tocar no documento oficial).
export const DOCS_DIR = process.env.PW_CASOS_DIR
  ? resolve(process.env.PW_CASOS_DIR)
  : join(REPO_ROOT, "Docs", "CasosDeTeste");

/**
 * Documentos gerados. O teste que não pertence a nenhum caso entra na seção
 * "sem caso" do documento cujo `escopo` (no catálogo) cobre o arquivo; sem
 * escopo correspondente, vai para o documento padrão.
 */
export const DOCUMENTS = {
  portal: {
    id: "portal",
    padrao: true,
    catalogo: "catalogo.json",
    resultados: "resultados.json",
    html: "CASOS_DE_TESTE.html",
    markdown: "CASOS_DE_TESTE.md",
  },
  simulador: {
    id: "simulador",
    catalogo: "catalogo-simulador.json",
    resultados: "resultados-simulador.json",
    html: "CASOS_DE_TESTE_SIMULADOR.html",
    markdown: "CASOS_DE_TESTE_SIMULADOR.md",
  },
};

export function documentPaths(documentId) {
  const document = DOCUMENTS[documentId];
  if (!document) throw new Error(`Documento desconhecido: ${documentId}.`);
  return {
    catalog: join(DOCS_DIR, document.catalogo),
    results: join(DOCS_DIR, document.resultados),
    html: join(DOCS_DIR, document.html),
    markdown: join(DOCS_DIR, document.markdown),
    htmlName: document.html,
    markdownName: document.markdown,
  };
}

/** Documentos com catálogo presente (o do ensaio pode ter só alguns). */
export function availableDocuments() {
  return Object.keys(DOCUMENTS).filter((id) =>
    existsSync(documentPaths(id).catalog),
  );
}

export const HISTORY_LIMIT = 15;
export const RUNS_LIMIT = 60;

export const STATUSES = {
  ok: { label: "OK", tone: "ok", emoji: "✅" },
  falhou: { label: "Falhou", tone: "fail", emoji: "❌" },
  "defeito-conhecido": {
    label: "Defeito conhecido",
    tone: "warn",
    emoji: "🐞",
  },
  "nao-executado": { label: "Não executado", tone: "muted", emoji: "⏭️" },
  scci: { label: "SCCI", tone: "info", emoji: "🔷" },
  alterado: { label: "Alterado", tone: "info", emoji: "✏️" },
  duvida: { label: "Dúvida", tone: "warn", emoji: "❓" },
  pendente: { label: "Pendente", tone: "muted", emoji: "⚪" },
};

export const AUTOMATION_LABELS = {
  automatizado: "Automatizado",
  parcial: "Automação parcial",
  manual: "Manual",
};

/** Projetos que não representam casos de negócio (setup, unitários, provisionamento). */
const INFRA_PROJECTS = new Set(["setup", "aejs-setup", "unit", "scci-db"]);
const INFRA_PATH_PREFIXES = ["setup/", "provisioning/", "unit/", "scci-db/"];

export function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Escrita atômica: grava em arquivo temporário e renomeia. */
export function writeFileAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, content);
  renameSync(temporaryPath, path);
}

export function loadCatalog(documentId = "portal") {
  const path = documentPaths(documentId).catalog;
  const catalog = readJson(path, undefined);
  if (!catalog) {
    throw new Error(`Catálogo não encontrado em ${path}.`);
  }
  validateCatalog(catalog);
  return catalog;
}

export function saveCatalog(documentId, catalog) {
  validateCatalog(catalog);
  writeFileAtomic(
    documentPaths(documentId).catalog,
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
}

/** Documento que contém o caso (para `casos:registrar`). */
export function findDocumentForCase(caseId) {
  return availableDocuments().find((documentId) =>
    loadCatalog(documentId).casos.some((testCase) => testCase.id === caseId),
  );
}

/** Documento responsável por um teste sem caso, pelo `escopo` dos catálogos. */
export function documentForUnmatchedTest(catalogs, file) {
  for (const [documentId, catalog] of catalogs) {
    if ((catalog.escopo ?? []).some((prefix) => file.startsWith(prefix))) {
      return documentId;
    }
  }
  const fallback = [...catalogs.keys()].find((id) => DOCUMENTS[id].padrao);
  return fallback ?? [...catalogs.keys()][0];
}

export function validateCatalog(catalog) {
  const problems = [];
  const ids = new Set();
  for (const testCase of catalog.casos ?? []) {
    if (!testCase.id) problems.push("Caso sem id.");
    if (ids.has(testCase.id)) problems.push(`Caso duplicado: ${testCase.id}`);
    ids.add(testCase.id);
    if (!testCase.secao) problems.push(`${testCase.id}: sem seção.`);
    if (!testCase.regra) problems.push(`${testCase.id}: sem regra.`);
    if (!AUTOMATION_LABELS[testCase.automacao]) {
      problems.push(`${testCase.id}: automacao inválida (${testCase.automacao}).`);
    }
    if (testCase.automacao !== "manual" && !(testCase.vinculos ?? []).length) {
      problems.push(`${testCase.id}: automatizado sem vínculo com teste.`);
    }
    for (const link of testCase.vinculos ?? []) {
      if (!link.titulo && !link.arquivo) {
        problems.push(`${testCase.id}: vínculo sem arquivo nem título.`);
      }
      if (link.arquivo && !existsSync(join(TESTS_DIR, link.arquivo))) {
        problems.push(`${testCase.id}: arquivo inexistente ${link.arquivo}.`);
      }
    }
    for (const [environment, entry] of Object.entries(testCase.planilha ?? {})) {
      if (entry?.status && !STATUSES[entry.status]) {
        problems.push(
          `${testCase.id}: status da planilha inválido em ${environment} (${entry.status}).`,
        );
      }
    }
  }
  if (problems.length) {
    throw new Error(`Catálogo de casos inválido:\n- ${problems.join("\n- ")}`);
  }
}

export function emptyResults() {
  return { versao: 1, atualizadoEm: null, execucoes: [], casos: {}, semCaso: {} };
}

export function loadResults(documentId = "portal") {
  return readJson(documentPaths(documentId).results, emptyResults());
}

export function saveResults(documentId, results) {
  results.atualizadoEm = new Date().toISOString();
  writeFileAtomic(
    documentPaths(documentId).results,
    `${JSON.stringify(results, null, 2)}\n`,
  );
}

/** Lê PW_PROFILE como o playwright.config.ts faz (env → .env.local). */
export function resolveEnvironment() {
  const explicit =
    process.env.PW_CASOS_AMBIENTE?.trim() || process.env.PW_PROFILE?.trim();
  if (explicit) return explicit.toLowerCase();

  const selectorPath = join(REPO_ROOT, ".env.local");
  if (existsSync(selectorPath)) {
    const profile = parseEnv(readFileSync(selectorPath, "utf8")).PW_PROFILE;
    if (profile?.trim()) return profile.trim().toLowerCase();
  }
  return process.env.PORTAL_ENV?.trim().toLowerCase() || "sem-perfil";
}

/** Host do Portal do perfil, só para contexto no documento (sem segredos). */
export function resolvePortalHost(environment) {
  let portalUrl = process.env.PORTAL_URL;
  if (!portalUrl) {
    const profilePath = join(REPO_ROOT, `.env.${environment}.local`);
    if (existsSync(profilePath)) {
      portalUrl = parseEnv(readFileSync(profilePath, "utf8")).PORTAL_URL;
    }
  }
  if (!portalUrl) return null;
  try {
    return new URL(portalUrl).host;
  } catch {
    return null;
  }
}

export function environmentLabel(catalog, environment) {
  return (
    catalog.ambientes?.[environment] ??
    environment.charAt(0).toUpperCase() + environment.slice(1)
  );
}

/** Caminho do spec relativo a tests/, com barras normais. */
export function testFileRelativePath(absoluteFile) {
  let relativePath = relative(TESTS_DIR, absoluteFile);
  if (relativePath.startsWith("..")) {
    const marker = `${sep}tests${sep}`;
    const index = absoluteFile.lastIndexOf(marker);
    relativePath =
      index >= 0 ? absoluteFile.slice(index + marker.length) : absoluteFile;
  }
  return relativePath.split(sep).join("/");
}

export function isInfrastructureTest(project, file) {
  return (
    INFRA_PROJECTS.has(project) ||
    INFRA_PATH_PREFIXES.some((prefix) => file.startsWith(prefix))
  );
}

const TITLE_ID_PATTERN = /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+)\s+\|/;

/**
 * Casos ligados a um teste executado. Um teste pode comprovar mais de um caso
 * (ex.: validação integrada de vários campos) e um caso pode ter vários testes.
 */
export function matchCases(catalog, executedTest) {
  const matched = new Set();
  const titleId = TITLE_ID_PATTERN.exec(executedTest.titulo)?.[1];
  for (const testCase of catalog.casos) {
    if (titleId && testCase.id === titleId) {
      matched.add(testCase.id);
      continue;
    }
    for (const link of testCase.vinculos ?? []) {
      if (link.arquivo && link.arquivo !== executedTest.arquivo) continue;
      if (link.exato) {
        if (executedTest.tituloCompleto === link.titulo) {
          matched.add(testCase.id);
          break;
        }
        continue;
      }
      if (!link.titulo || executedTest.tituloCompleto.includes(link.titulo)) {
        matched.add(testCase.id);
        break;
      }
    }
  }
  return [...matched];
}

const ANSI_PATTERN = new RegExp(String.raw`\u001b\[[0-9;]*m`, "g");

function clip(text, limit) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/** O que cada matcher do Playwright quis dizer, em português. */
const MATCHER_MEANINGS = [
  [/toBeVisible\(/, "O elemento não ficou visível na tela."],
  [/toBeHidden\(/, "O elemento continuou visível quando deveria sumir."],
  [/toHaveCount\(/, "A quantidade de elementos na tela é diferente da esperada."],
  [/toHaveText\(|toContainText\(/, "O texto na tela é diferente do esperado."],
  [/toHaveValue\(/, "O valor do campo é diferente do esperado."],
  [/toBeChecked\(/, "A opção não estava marcada."],
  [/toBeEnabled\(/, "O controle estava desabilitado."],
  [/toBeDisabled\(/, "O controle estava habilitado quando deveria estar desabilitado."],
  [/toHaveURL\(/, "A página não chegou ao endereço esperado."],
  [/toContain\(/, "O conteúdo não traz o trecho esperado."],
  [/toBeUndefined\(/, "Veio um valor onde não deveria haver nenhum."],
  [/toBeDefined\(|toBeTruthy\(/, "O valor esperado não apareceu."],
  [/toBeFalsy\(/, "A condição deveria ser falsa e foi verdadeira."],
  [/toEqual\(|toStrictEqual\(|toBe\(/, "O valor obtido é diferente do esperado."],
  [/toBeGreaterThan|toBeLessThan/, "O número ficou fora do limite esperado."],
  [/toMatch\(/, "O texto não segue o formato esperado."],
];

function explainFirstLine(first) {
  const testTimeout = /^Test timeout of (\d+)ms exceeded/.exec(first);
  if (testTimeout) {
    return `O teste estourou o tempo limite de ${Number(testTimeout[1]) / 1000} s.`;
  }
  const gotoTimeout = /^(?:TimeoutError: )?page\.goto: Timeout (\d+)ms exceeded/.exec(first);
  if (gotoTimeout) {
    return `A página não carregou em ${Number(gotoTimeout[1]) / 1000} s.`;
  }
  const network = /net::(ERR_[A-Z_]+)(?: at (\S+))?/.exec(first);
  if (network) {
    return `Falha de rede (${network[1]})${network[2] ? ` ao abrir ${network[2]}` : ""}.`;
  }
  const actionTimeout = /^(?:TimeoutError: )?locator\.(\w+): Timeout (\d+)ms exceeded/.exec(first);
  if (actionTimeout) {
    return `Não foi possível executar “${actionTimeout[1]}” no elemento em ${Number(actionTimeout[2]) / 1000} s.`;
  }
  if (/^expect(\.poll)?\(/.test(first) || /^expect\(/.test(first)) {
    return MATCHER_MEANINGS.find(([pattern]) => pattern.test(first))?.[1] ?? first;
  }
  return first;
}

/** Itens adicionados num diff do Jest/Playwright (linhas "+ ..."), compactados. */
function diffItems(lines) {
  const start = lines.findIndex((line) => /^\+ Received/.test(line));
  if (start < 0) return [];
  const items = [];
  let current = null;
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("+")) continue;
    const content = line.replace(/^\+\s?/, "").trim();
    if (/^Object \{$/.test(content)) {
      current = [];
      continue;
    }
    if (/^Array \[\]?$|^\[$|^\],?$/.test(content)) continue;
    if (current && /^\},?$/.test(content)) {
      items.push(`{ ${current.join(", ")} }`);
      current = null;
      continue;
    }
    const value = content.replace(/,$/, "");
    if (current) current.push(value.replace(/^"([^"]+)":/, "$1:"));
    else items.push(value.replace(/^"|"$/g, ""));
  }
  return items;
}

function expectedFromDiff(lines) {
  const minus = lines.filter((line) => /^- /.test(line) && !/^- Expected/.test(line));
  const values = minus.map((line) => line.replace(/^-\s?/, "").trim());
  if (values.length === 1 && values[0] === "Array []") return "nenhum item";
  return values.join(" ") || null;
}

/**
 * Descrição legível de uma falha: motivo (mensagem do teste ou explicação do
 * matcher), o esperado, o encontrado e o elemento envolvido.
 */
export function describeError(message) {
  if (!message) return null;
  const lines = message
    .replace(ANSI_PATTERN, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  if (!lines.length) return null;

  const first = lines[0].trim().replace(/^Error:\s*/, "");
  const valueOf = (...labels) => {
    for (const label of labels) {
      const line = lines.find((item) => item.trim().startsWith(`${label}:`));
      if (line) return line.trim().slice(label.length + 1).trim().replace(/·$/, "");
    }
    return null;
  };

  const motivo = explainFirstLine(first);
  let esperado = valueOf("Expected", "Expected substring", "Expected string", "Expected pattern", "Expected value");
  let encontrado = valueOf("Received", "Received string", "Received value");
  if (!encontrado) {
    const items = diffItems(lines.map((line) => line.trim()));
    if (items.length) {
      const shown = items.slice(0, 3).join(" · ");
      encontrado = items.length > 3 ? `${shown} (+${items.length - 3})` : shown;
      esperado ??= expectedFromDiff(lines.map((line) => line.trim()));
    }
  }
  const locator = valueOf("Locator");
  const plain = lines.join("\n");
  if (!esperado && /toBeUndefined\(|toBeNull\(/.test(plain)) esperado = "nenhum valor";
  if (!esperado && /toBeFalsy\(/.test(plain)) esperado = "falso";
  const balanceQuotes = (value) =>
    value && value.startsWith('"') && !value.endsWith('"') ? value.slice(1) : value;
  esperado = balanceQuotes(esperado);
  encontrado = balanceQuotes(encontrado);

  return {
    motivo: clip(motivo, 320),
    ...(esperado ? { esperado: clip(esperado, 220) } : {}),
    ...(encontrado ? { encontrado: clip(encontrado, 320) } : {}),
    ...(locator ? { elemento: clip(locator, 160) } : {}),
  };
}

/** Texto da falha para a Obs (uma linha por informação). */
export function formatFailure(failure) {
  if (!failure) return "Falhou.";
  if (typeof failure === "string") return failure;
  return [
    failure.motivo,
    failure.esperado ? `Esperado: ${failure.esperado}` : null,
    failure.encontrado ? `Encontrado: ${failure.encontrado}` : null,
    failure.elemento && !failure.encontrado ? `Elemento: ${failure.elemento}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Mantido por compatibilidade: resumo em uma linha. */
export function summarizeError(message) {
  const failure = describeError(message);
  return failure ? formatFailure(failure).replace(/\n/g, " · ") : null;
}

const BUILTIN_ANNOTATIONS = new Set([
  "skip",
  "fixme",
  "fail",
  "slow",
  "tag",
  "_annotation",
]);

export function userAnnotations(annotations = []) {
  return annotations
    .filter((annotation) => !BUILTIN_ANNOTATIONS.has(annotation.type))
    .filter((annotation) => annotation.description)
    .map((annotation) => `${annotation.type}: ${annotation.description}`);
}

export function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "";
  if (milliseconds < 1000) return `${milliseconds} ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds.toFixed(1).replace(".", ",")} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds % 60)} s`;
}

export function formatDate(isoDate) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function shortTestTitle(title) {
  const withoutId = title.replace(TITLE_ID_PATTERN, "").trim();
  return withoutId.length > 70 ? `${withoutId.slice(0, 67)}…` : withoutId;
}

/** Resultado consolidado de um caso numa execução (vários testes → um status). */
export function aggregateCaseResult(tests) {
  const count = (status) => tests.filter((test) => test.status === status).length;
  const failed = tests.filter((test) => test.status === "falhou");
  const known = tests.filter((test) => test.status === "defeito-conhecido");
  const passed = count("ok");
  const skipped = tests.filter((test) => test.status === "nao-executado");
  const executed = tests.length - skipped.length;
  const totalDuration = tests.reduce((sum, test) => sum + (test.duracaoMs ?? 0), 0);
  const flaky = tests.some((test) => test.instavel);
  const multiple = tests.length > 1;

  let status;
  let obs;
  if (failed.length) {
    status = "falhou";
    const details = failed
      .slice(0, 2)
      .map((test) =>
        multiple
          ? `“${shortTestTitle(test.titulo)}”: ${formatFailure(test.falha ?? test.erro)}`
          : formatFailure(test.falha ?? test.erro),
      );
    const more = failed.length > 2 ? `\n(+${failed.length - 2} falhas, ver Detalhes)` : "";
    obs = `${multiple ? `${failed.length} de ${tests.length} testes falharam.\n` : ""}${details.join("\n")}${more}`;
  } else if (known.length) {
    status = "defeito-conhecido";
    const reasons = [...new Set(known.map((test) => test.motivo).filter(Boolean))];
    obs = `Falha esperada (defeito já conhecido)${reasons.length ? `: ${reasons.join(" · ")}` : "."}`;
  } else if (passed) {
    status = "ok";
    const duration = formatDuration(totalDuration);
    const notes = [
      ...new Set(tests.flatMap((test) => test.anotacoes ?? [])),
    ].slice(0, 3);
    if (tests.length === 1) obs = `Passou no teste automatizado (${duration}).`;
    else if (skipped.length) {
      obs = `Passou em ${passed} de ${tests.length} testes; ${skipped.length} não executado(s) (${duration}).`;
    } else obs = `Passou nos ${passed} testes automatizados (${duration}).`;
    if (notes.length) obs += ` ${notes.join(" · ")}`;
  } else {
    status = "nao-executado";
    const reasons = [...new Set(skipped.map((test) => test.motivo).filter(Boolean))];
    obs = reasons.length
      ? `Pulado: ${reasons.join(" · ")}`
      : "Não executado: o Playwright não rodou este teste (em grupo serial, acontece quando um teste anterior do grupo falha).";
  }
  if (flaky && status === "ok") obs += " Instável: passou após nova tentativa.";

  return { status, obs, executados: executed, total: tests.length };
}

function pushHistory(entry, current) {
  entry.historico = [
    {
      status: current.status,
      data: current.data,
      origem: current.origem,
      obs: current.obs,
      ...(current.execucao ? { execucao: current.execucao } : {}),
    },
    ...(entry.historico ?? []),
  ].slice(0, HISTORY_LIMIT);
}

export function recordCaseResult(results, caseId, environment, current) {
  results.casos[caseId] ??= {};
  const entry = (results.casos[caseId][environment] ??= {});
  entry.atual = current;
  pushHistory(entry, current);
}

export function setCaseNote(results, caseId, environment, note) {
  results.casos[caseId] ??= {};
  const entry = (results.casos[caseId][environment] ??= {});
  if (note) entry.nota = note;
  else delete entry.nota;
}

/**
 * Status efetivo de um caso num ambiente: último registro (automático ou
 * manual); sem registro, o status da planilha original; sem nada, pendente.
 */
export function effectiveResult(testCase, results, environment) {
  const entry = results.casos?.[testCase.id]?.[environment];
  if (entry?.atual) {
    return { ...entry.atual, nota: entry.nota, historico: entry.historico ?? [] };
  }
  const fromSheet = testCase.planilha?.[environment];
  if (fromSheet?.status) {
    return {
      status: fromSheet.status,
      obs: fromSheet.obs ?? null,
      origem: "planilha",
      data: null,
      nota: entry?.nota,
      historico: [],
    };
  }
  return {
    status: "pendente",
    obs: null,
    origem: null,
    data: null,
    nota: entry?.nota,
    historico: [],
  };
}

/** Ambientes exibidos: os do catálogo com dados + os que já tiveram execução. */
export function visibleEnvironments(catalog, results) {
  const environments = [];
  const add = (environment) => {
    if (environment && !environments.includes(environment)) environments.push(environment);
  };
  for (const environment of catalog.ambientesExibidos ?? []) add(environment);
  for (const environment of Object.keys(catalog.ambientes ?? {})) {
    const hasSheet = catalog.casos.some((testCase) => testCase.planilha?.[environment]?.status);
    const hasResults = Object.values(results.casos ?? {}).some((entry) => entry[environment]);
    if (hasSheet || hasResults) add(environment);
  }
  for (const entry of Object.values(results.casos ?? {})) {
    for (const environment of Object.keys(entry)) add(environment);
  }
  return environments;
}

export function summarize(catalog, results, environment) {
  const counts = Object.fromEntries(Object.keys(STATUSES).map((status) => [status, 0]));
  let fromSheet = 0;
  for (const testCase of catalog.casos) {
    const effective = effectiveResult(testCase, results, environment);
    counts[effective.status] = (counts[effective.status] ?? 0) + 1;
    if (effective.origem === "planilha") fromSheet += 1;
  }
  return { counts, total: catalog.casos.length, fromSheet };
}
