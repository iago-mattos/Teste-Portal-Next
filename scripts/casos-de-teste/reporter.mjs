import {
  aggregateCaseResult,
  availableDocuments,
  documentForUnmatchedTest,
  isInfrastructureTest,
  loadCatalog,
  loadResults,
  matchCases,
  recordCaseResult,
  resolveEnvironment,
  resolvePortalHost,
  RUNS_LIMIT,
  saveResults,
  describeError,
  formatFailure,
  testFileRelativePath,
  userAnnotations,
} from "./lib.mjs";
import { renderDocuments } from "./render.mjs";

/**
 * Reporter do Playwright que preenche o documento de casos de teste
 * (Docs/CasosDeTeste) ao fim de cada execução: OK/Falhou/Não executado e a
 * Obs de cada caso, por ambiente (PW_PROFILE).
 *
 * Só os casos cujos testes rodaram nesta execução são atualizados; os demais
 * mantêm o último resultado conhecido. Desligue com PW_CASOS_DE_TESTE=off.
 */
export default class CasosDeTesteReporter {
  constructor(options = {}) {
    this.options = options;
    this.tests = new Map();
    this.enabled = process.env.PW_CASOS_DE_TESTE?.trim().toLowerCase() !== "off";
  }

  printsToStdio() {
    return false;
  }

  onBegin() {
    this.startedAt = new Date();
  }

  onTestEnd(test) {
    this.tests.set(test.id, test);
  }

  async onEnd(fullResult) {
    if (!this.enabled || this.tests.size === 0) return;

    try {
      this.writeResults(fullResult);
    } catch (error) {
      console.error(
        `\n[casos-de-teste] Não foi possível atualizar Docs/CasosDeTeste: ${error.message}`,
      );
    }
  }

  writeResults(fullResult) {
    const environment = resolveEnvironment();
    // Usa os horários reais dos resultados: no `merge-reports` os eventos são
    // reproduzidos depois, e a data precisa ser a da execução, não a do merge.
    const startedAt = validDate(fullResult.startTime) ?? this.startedAt ?? new Date();
    const finishedAt = latestResultEnd(this.tests.values()) ?? new Date();
    const runId = `${finishedAt.toISOString()}-${environment}`;

    const executedTests = [...this.tests.values()].map((test) =>
      describeTest(test),
    );
    const catalogs = new Map(
      availableDocuments().map((documentId) => [documentId, loadCatalog(documentId)]),
    );

    // documento → { casos: Map<caseId, testes[]>, semCaso: [], testes: Set }
    const perDocument = new Map(
      [...catalogs.keys()].map((documentId) => [
        documentId,
        { testsByCase: new Map(), unmatched: [], tests: new Set() },
      ]),
    );
    for (const executedTest of executedTests) {
      let matchedAnywhere = false;
      for (const [documentId, catalog] of catalogs) {
        const caseIds = matchCases(catalog, executedTest);
        if (!caseIds.length) continue;
        matchedAnywhere = true;
        const bucket = perDocument.get(documentId);
        bucket.tests.add(executedTest);
        for (const caseId of caseIds) {
          if (!bucket.testsByCase.has(caseId)) bucket.testsByCase.set(caseId, []);
          bucket.testsByCase.get(caseId).push(executedTest);
        }
      }
      if (
        !matchedAnywhere &&
        !isInfrastructureTest(executedTest.projeto, executedTest.arquivo)
      ) {
        const bucket = perDocument.get(
          documentForUnmatchedTest(catalogs, executedTest.arquivo),
        );
        bucket.unmatched.push(executedTest);
        bucket.tests.add(executedTest);
      }
    }

    for (const [documentId, bucket] of perDocument) {
      if (!bucket.testsByCase.size && !bucket.unmatched.length) continue;
      this.writeDocument(documentId, catalogs.get(documentId), bucket, {
        environment,
        runId,
        startedAt,
        finishedAt,
        fullResult,
      });
    }
  }

  writeDocument(documentId, catalog, bucket, run) {
    const { environment, runId, startedAt, finishedAt, fullResult } = run;
    const results = loadResults(documentId);
    const totals = {};
    for (const [caseId, tests] of bucket.testsByCase) {
      const aggregated = aggregateCaseResult(tests);
      totals[aggregated.status] = (totals[aggregated.status] ?? 0) + 1;
      recordCaseResult(results, caseId, environment, {
        status: aggregated.status,
        obs: aggregated.obs,
        data: finishedAt.toISOString(),
        origem: "automatico",
        execucao: runId,
        testes: tests.map(storedTest),
      });
    }

    results.semCaso ??= {};
    results.semCaso[environment] = bucket.unmatched.map((test) => ({
      arquivo: test.arquivo,
      linha: test.linha,
      titulo: test.tituloCompleto,
      projeto: test.projeto,
      status: test.status,
      data: finishedAt.toISOString(),
    }));

    const projects = [...new Set([...bucket.tests].map((test) => test.projeto))].sort();
    results.execucoes = [
      {
        id: runId,
        ambiente: environment,
        portal: resolvePortalHost(environment),
        inicio: startedAt.toISOString(),
        fim: finishedAt.toISOString(),
        duracaoMs: Math.round(fullResult.duration ?? 0),
        status: fullResult.status,
        maquina: process.env.CI ? "CI" : "local",
        projetos: projects,
        testes: bucket.tests.size,
        casos: bucket.testsByCase.size,
        totais: totals,
      },
      ...(results.execucoes ?? []),
    ].slice(0, RUNS_LIMIT);

    saveResults(documentId, results);
    const paths = renderDocuments(documentId, catalog, results);

    const summary = Object.entries(totals)
      .map(([status, count]) => `${count} ${status}`)
      .join(", ");
    console.log(
      `\n[casos-de-teste] ${catalog.titulo}: ${bucket.testsByCase.size} casos atualizados em ${environment}${summary ? ` (${summary})` : ""}. Documento: ${paths.html}`,
    );
    if (bucket.unmatched.length) {
      console.log(
        `[casos-de-teste] ${bucket.unmatched.length} teste(s) sem caso no catálogo — veja a seção "Testes sem caso" no documento.`,
      );
    }
  }
}

function validDate(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function latestResultEnd(tests) {
  let latest = null;
  for (const test of tests) {
    for (const result of test.results) {
      const start = validDate(result.startTime);
      if (!start) continue;
      const end = new Date(start.getTime() + Math.max(0, result.duration ?? 0));
      if (!latest || end > latest) latest = end;
    }
  }
  return latest;
}

/** O que fica gravado em resultados.json para cada teste de um caso. */
function storedTest(test) {
  return {
    titulo: test.titulo,
    arquivo: test.arquivo,
    linha: test.linha,
    projeto: test.projeto,
    status: test.status,
    duracaoMs: test.duracaoMs,
    ...(test.tentativas > 1 ? { tentativas: test.tentativas } : {}),
    ...(test.falha ? { erro: formatFailure(test.falha).replace(/\n/g, " · "), falha: test.falha } : {}),
    ...(test.motivo ? { motivo: test.motivo } : {}),
  };
}

function testStatus(test) {
  const outcome = test.outcome();
  const lastResult = test.results.at(-1);
  if (outcome === "skipped") return "nao-executado";
  if (test.expectedStatus === "failed" && outcome === "expected") {
    return "defeito-conhecido";
  }
  if (outcome === "expected" || outcome === "flaky") return "ok";
  if (lastResult?.status === "skipped") return "nao-executado";
  return "falhou";
}

function annotationReason(annotations, types) {
  return (
    annotations.find((annotation) => types.includes(annotation.type))?.description ??
    null
  );
}

function describeTest(test) {
  const lastResult = test.results.at(-1);
  const titlePath = test.titlePath().filter(Boolean);
  const project = test.parent.project()?.name ?? "";
  // titlePath = [projeto, arquivo, ...describes, título]
  const titleSegments = titlePath.slice(project ? 2 : 1);
  const annotations = [
    ...(test.annotations ?? []),
    ...(lastResult?.annotations ?? []),
  ];
  const status = testStatus(test);
  const errorMessage =
    lastResult?.errors?.[0]?.message ?? lastResult?.error?.message ?? null;

  return {
    titulo: test.title,
    tituloCompleto: titleSegments.join(" › "),
    arquivo: testFileRelativePath(test.location.file),
    linha: test.location.line,
    projeto: project,
    status,
    duracaoMs: test.results.reduce((sum, result) => sum + (result.duration ?? 0), 0),
    tentativas: test.results.length,
    ...(test.outcome() === "flaky" ? { instavel: true } : {}),
    ...(status === "falhou" ? { falha: describeError(errorMessage) } : {}),
    ...(status === "nao-executado"
      ? { motivo: annotationReason(annotations, ["skip", "fixme"]) }
      : {}),
    ...(status === "defeito-conhecido"
      ? { motivo: annotationReason(annotations, ["fail"]) }
      : {}),
    anotacoes: userAnnotations(annotations),
  };
}
