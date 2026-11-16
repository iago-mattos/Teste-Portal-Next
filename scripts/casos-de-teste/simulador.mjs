import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { documentPaths, readJson, REPO_ROOT, saveCatalog } from "./lib.mjs";

/**
 * Catálogo do documento do Simulador: um caso por teste Playwright do
 * Simulador, gerado a partir de `playwright test --list`. Rodar de novo
 * (`npm run casos:simulador:sincronizar`) inclui testes novos, remove os que
 * saíram da suíte e preserva o ID dos que continuam.
 */

const PROJECTS = [
  "simulator-readonly",
  "simulator-journeys",
  "simulator-integration",
  "integration",
];

export const SIMULATOR_SCOPE = [
  "simulator/",
  "integrations/simulator-journeys/",
  "integrations/scci-reference/",
  "integrations/portal-aejs/create-and-validate-simulation.spec.ts",
];

/** Seção e prefixo de ID por spec, na ordem em que aparecem no documento. */
const GROUPS = [
  ["simulator/journeys.spec.ts", "Jornadas e navegação", "SIM-JOR"],
  ["simulator/data-step.spec.ts", "Tela Dados: validações", "SIM-DADOS"],
  ["simulator/admin-rules.spec.ts", "Regras do admin", "SIM-ADMIN"],
  ["simulator/operation-limits.spec.ts", "Limites do tipo de operação", "SIM-LIM"],
  ["simulator/term-limits.spec.ts", "Prazo mínimo e máximo", "SIM-PRAZO"],
  ["simulator/operation-type-selection.spec.ts", "Escolha do tipo de operação", "SIM-TIPO"],
  ["simulator/amortization.spec.ts", "Sistema de amortização", "SIM-AMORT"],
  ["simulator/grace-visibility.spec.ts", "Carência", "SIM-CAR"],
  ["integrations/simulator-journeys/grace-values-in-scci.spec.ts", "Carência", "SIM-CAR"],
  ["simulator/insurers.spec.ts", "Seguradoras", "SIM-SEG"],
  ["simulator/simulation-database.spec.ts", "Gravação da simulação no SCCI", "SIM-GRAV"],
  ["simulator/suspended-modalities.spec.ts", "Modalidades suspensas", "SIM-SUSP"],
  ["simulator/scci-config.spec.ts", "Cadastro do SCCI", "SIM-SCCI"],
  ["integrations/scci-reference/scci-reference.spec.ts", "Cadastro do SCCI", "SIM-SCCI"],
  ["integrations/simulator-journeys/create-and-verify-proposals.spec.ts", "Criação de propostas no SCCI", "SIM-PROP"],
  ["integrations/simulator-journeys/applicant-name-length.spec.ts", "Criação de propostas no SCCI", "SIM-PROP"],
  ["integrations/portal-aejs/create-and-validate-simulation.spec.ts", "Criação de propostas no SCCI", "SIM-PROP"],
].map(([arquivo, secao, prefixo], ordem) => ({ arquivo, secao, prefixo, ordem }));

const FALLBACK_GROUP = {
  secao: "Outros testes do Simulador",
  prefixo: "SIM-OUT",
  ordem: GROUPS.length,
};

const GENERIC_TAGS = new Set(["readonly", "simulator", "integration"]);

function groupFor(file) {
  return GROUPS.find((group) => group.arquivo === file) ?? FALLBACK_GROUP;
}

function testKey(file, fullTitle) {
  return `${file}::${fullTitle}`;
}

/** Lista os testes do Simulador como o Playwright os vê (sem executar nada). */
export function listSimulatorTests() {
  const playwright = join(REPO_ROOT, "node_modules", ".bin", "playwright");
  const result = spawnSync(
    playwright,
    [
      "test",
      "--list",
      "--reporter=json",
      ...PROJECTS.map((project) => `--project=${project}`),
    ],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, PW_CASOS_DE_TESTE: "off" },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `playwright test --list falhou (código ${result.status}):\n${result.stderr}`,
    );
  }

  const report = JSON.parse(result.stdout);
  const tests = [];
  const seen = new Set();
  const walk = (suite, describes) => {
    for (const spec of suite.specs ?? []) {
      if (!SIMULATOR_SCOPE.some((prefix) => spec.file.startsWith(prefix))) continue;
      const fullTitle = [...describes, spec.title].join(" › ");
      const key = testKey(spec.file, fullTitle);
      if (seen.has(key)) continue;
      seen.add(key);
      tests.push({
        arquivo: spec.file,
        linha: spec.line,
        describes,
        titulo: spec.title,
        tituloCompleto: fullTitle,
        tags: (spec.tags ?? []).map((tag) => tag.replace(/^@/, "")),
      });
    }
    for (const child of suite.suites ?? []) {
      const isFileSuite = !child.title || child.title === child.file;
      walk(child, isFileSuite ? describes : [...describes, child.title]);
    }
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  return tests;
}

function contextFrom(describes) {
  if (!describes.length) return undefined;
  const text = describes
    .join(" › ")
    .replace(/^Simulador\s*\|\s*/, "")
    .trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : undefined;
}

export function syncSimulatorCatalog(tests = listSimulatorTests()) {
  const paths = documentPaths("simulador");
  const previous = readJson(paths.catalog, undefined);
  const previousByKey = new Map();
  const highest = new Map();
  for (const testCase of previous?.casos ?? []) {
    const link = testCase.vinculos?.[0];
    if (link) previousByKey.set(testKey(link.arquivo, link.titulo), testCase);
    const [, prefix, number] = /^(.*)-(\d+)$/.exec(testCase.id) ?? [];
    if (prefix) highest.set(prefix, Math.max(highest.get(prefix) ?? 0, Number(number)));
  }

  const ordered = tests
    .map((test, index) => ({ ...test, group: groupFor(test.arquivo), index }))
    .sort((a, b) => a.group.ordem - b.group.ordem || a.index - b.index);

  const added = [];
  const casos = ordered.map((test) => {
    const existing = previousByKey.get(testKey(test.arquivo, test.tituloCompleto));
    let id = existing?.id;
    if (!id) {
      const next = (highest.get(test.group.prefixo) ?? 0) + 1;
      highest.set(test.group.prefixo, next);
      id = `${test.group.prefixo}-${String(next).padStart(2, "0")}`;
      added.push(id);
    }
    const tags = test.tags.filter((tag) => !GENERIC_TAGS.has(tag));
    return {
      id,
      secao: test.group.secao,
      ...(contextFrom(test.describes) ? { contexto: contextFrom(test.describes) } : {}),
      regra: test.titulo.charAt(0).toUpperCase() + test.titulo.slice(1),
      origem: "suite",
      automacao: "automatizado",
      ...(tags.length ? { tags } : {}),
      vinculos: [{ arquivo: test.arquivo, titulo: test.tituloCompleto, exato: true }],
      // Campos escritos à mão no catálogo continuam valendo após a sincronização.
      ...(existing?.notaCobertura ? { notaCobertura: existing.notaCobertura } : {}),
      ...(existing?.nota ? { nota: existing.nota } : {}),
    };
  });

  const currentIds = new Set(casos.map((testCase) => testCase.id));
  const removed = (previous?.casos ?? [])
    .map((testCase) => testCase.id)
    .filter((id) => !currentIds.has(id));

  saveCatalog("simulador", {
    titulo: "Casos de teste do Simulador",
    versao: 1,
    descricao:
      "Um caso por teste Playwright do Simulador público e das jornadas Simulador → SCCI. Gerado por `npm run casos:simulador:sincronizar` a partir de `playwright test --list`; os IDs dos testes existentes são preservados. 'notaCobertura' e 'nota' podem ser editados à mão e sobrevivem à sincronização.",
    ambientes: { desenv: "Desenv", ht: "HT", "esteira-ht": "Esteira HT" },
    ambientesExibidos: ["desenv", "esteira-ht"],
    escopo: SIMULATOR_SCOPE,
    casos,
  });

  return { total: casos.length, added, removed };
}
