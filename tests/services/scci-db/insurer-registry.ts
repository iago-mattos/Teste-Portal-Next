/**
 * Comparação entre os cards de seguradora que o Simulador devolve
 * (POST /api/simulacao/evolucao) e o cadastro do SCCI (SEGURADORA_TIPO_OPERACAO +
 * SEGURA). Partes puras, testadas em tests/unit/insurer-registry.unit.spec.ts.
 *
 * A chave de uma oferta é seguradora + apólice: a mesma seguradora com outra
 * apólice é outra oferta, não repetição.
 */

export interface InsurerCard {
  readonly codigoSeguradora: string;
  readonly nomeSeguradora: string;
  readonly codigoApolice: string;
  /** Descrição da apólice/plano que o card mostra (ex.: "500-TOO SEGUROS_NV"); "" se ausente. */
  readonly plano: string;
}

export interface EvolutionResponse {
  readonly cards: readonly InsurerCard[];
  readonly codigoTipoOperacao: string;
  /** Chave da simulação gravada (SIMULACAO_ORIGINACAO): NU_SIMULACAO + NU_SESSAO. */
  readonly nuSimulacao: string;
  readonly nuSessao: string;
}

export interface InsurerRegistryRow {
  readonly coSeguradora: number | null;
  readonly coApolice: string | null;
  readonly coEnquadramento: number | null;
  readonly nuSeq: number;
  /** SEGURA.NOME; null quando a seguradora não tem cadastro ou nome. */
  readonly nome: string | null;
}

/**
 * `base-sem-deduplicacao`: o cadastro tem, para um mesmo enquadramento, pelo menos
 * tantas linhas quantas os cards (o Simulador não deduplica).
 * `indeterminado-enquadramento`: só somando linhas de enquadramentos diferentes o
 * cadastro cobre os cards, e o enquadramento usado não é gravado na avaliação.
 * `simulador`: há mais cards do que linhas no cadastro.
 */
export type RepetitionOrigin =
  | "base-sem-deduplicacao"
  | "indeterminado-enquadramento"
  | "simulador";

export interface InsurerCardClassification {
  /** Cards cuja seguradora + apólice não existe no cadastro do tipo de operação. */
  readonly outsideRegistry: readonly InsurerCard[];
  /** Ofertas mostradas em mais de um card. */
  readonly repeated: readonly {
    readonly key: string;
    readonly cards: number;
    readonly registryRows: number;
    /** CO_ENQUADRAMENTO de cada linha do cadastro para a oferta. */
    readonly enquadramentos: readonly (number | null)[];
    readonly origin: RepetitionOrigin;
  }[];
  /** O cadastro repete a linha, mas o Simulador mostra menos cards: ele deduplica. */
  readonly deduplicatedByApp: readonly { readonly key: string; readonly registryRows: number }[];
  /** Cards sem nome, com a origem provável. */
  readonly unnamed: readonly {
    readonly key: string;
    readonly registryHasName: boolean;
    readonly origin: "base" | "simulador";
  }[];
}

function readString(source: Record<string, unknown>, field: string, where: string): string {
  const value = source[field];
  if (typeof value !== "string") {
    throw new Error(`Contrato da resposta da evolucao mudou: ${where}.${field} ausente ou nao e texto.`);
  }
  return value;
}

/** Lê só o que a conferência precisa; descarta o resto (logo em base64, valores). */
export function parseEvolutionResponse(body: string): EvolutionResponse {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error("A resposta da evolucao nao e JSON valido.");
  }
  const root = (json ?? {}) as Record<string, unknown>;
  if (!Array.isArray(root.seguradoras)) {
    throw new Error("Contrato da resposta da evolucao mudou: campo seguradoras ausente.");
  }
  if (!root.resumo || typeof root.resumo !== "object") {
    throw new Error("Contrato da resposta da evolucao mudou: campo resumo ausente.");
  }
  const resumo = root.resumo as Record<string, unknown>;

  return {
    cards: root.seguradoras.map((item, index) => {
      const insurer = (item ?? {}) as Record<string, unknown>;
      const where = `seguradoras[${index}]`;
      return {
        codigoSeguradora: readString(insurer, "codigoSeguradora", where),
        nomeSeguradora: typeof insurer.nomeSeguradora === "string" ? insurer.nomeSeguradora : "",
        codigoApolice: readString(insurer, "codigoApolice", where),
        plano: typeof insurer.plano === "string" ? insurer.plano : "",
      };
    }),
    codigoTipoOperacao: readString(resumo, "codigoTipoOperacao", "resumo"),
    nuSimulacao: readString(resumo, "nuSimulacao", "resumo"),
    nuSessao: readString(resumo, "nuSessao", "resumo"),
  };
}

function offerKey(code: string | number | null, policy: string | null): string {
  return `${String(code ?? "").trim()}/${(policy ?? "").trim()}`;
}

function countBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
  return counts;
}

/**
 * Linhas do cadastro que podem valer juntas: as sem enquadramento (null/0) valem
 * sempre; as de um mesmo enquadramento valem juntas. Devolve o maior grupo possível.
 */
function maxApplicableRows(rows: readonly InsurerRegistryRow[]): number {
  const universal = rows.filter((row) => !row.coEnquadramento).length;
  const byEnquadramento = new Map<number, number>();
  for (const row of rows) {
    if (row.coEnquadramento) {
      byEnquadramento.set(row.coEnquadramento, (byEnquadramento.get(row.coEnquadramento) ?? 0) + 1);
    }
  }
  return universal + Math.max(0, ...byEnquadramento.values());
}

export function classifyInsurerCards(
  cards: readonly InsurerCard[],
  registry: readonly InsurerRegistryRow[],
): InsurerCardClassification {
  const cardKey = (card: InsurerCard) => offerKey(card.codigoSeguradora, card.codigoApolice);
  const rowKey = (row: InsurerRegistryRow) => offerKey(row.coSeguradora, row.coApolice);
  const cardCounts = countBy(cards, cardKey);
  const rowsByKey = new Map<string, InsurerRegistryRow[]>();
  for (const row of registry) rowsByKey.set(rowKey(row), [...(rowsByKey.get(rowKey(row)) ?? []), row]);

  const outsideRegistry = cards.filter((card) => !rowsByKey.has(cardKey(card)));

  const repeated = [...cardCounts]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const rows = rowsByKey.get(key) ?? [];
      const origin: RepetitionOrigin =
        count <= maxApplicableRows(rows)
          ? "base-sem-deduplicacao"
          : count <= rows.length
            ? "indeterminado-enquadramento"
            : "simulador";
      return {
        key,
        cards: count,
        registryRows: rows.length,
        enquadramentos: rows.map((row) => row.coEnquadramento),
        origin,
      };
    });

  const deduplicatedByApp = [...cardCounts]
    .filter(([key, count]) => count < maxApplicableRows(rowsByKey.get(key) ?? []))
    .map(([key]) => ({ key, registryRows: (rowsByKey.get(key) ?? []).length }));

  const unnamed = cards
    .filter((card) => card.nomeSeguradora.trim() === "")
    .map((card) => {
      const key = cardKey(card);
      const registryHasName = (rowsByKey.get(key) ?? []).some((row) => (row.nome ?? "").trim() !== "");
      return { key, registryHasName, origin: registryHasName ? ("simulador" as const) : ("base" as const) };
    });

  return { outsideRegistry, repeated, deduplicatedByApp, unnamed };
}

export interface UnnamedCard {
  readonly index: number;
  readonly key: string;
  /** Outro card da mesma seguradora (mesmo código) aparece antes na lista. */
  readonly seguradoraJaListada: boolean;
  /** A mesma oferta (seguradora + apólice) aparece antes na lista. */
  readonly ofertaRepetida: boolean;
  /** O próprio BFF já mandou o card sem nome (a tela não perdeu nada). */
  readonly bffSemNome: boolean;
}

/**
 * Cards cujo nome acessível (o que o navegador calcula) está vazio, na ordem da
 * tela, com o motivo provável: no front observado, só o primeiro card de cada
 * seguradora recebe `aria-labelledby`.
 */
export function describeUnnamedCards(
  cards: readonly InsurerCard[],
  accessibleNames: readonly string[],
): UnnamedCard[] {
  if (accessibleNames.length !== cards.length) {
    throw new Error(
      `A lista de nomes acessiveis tem tamanho ${accessibleNames.length}; esperado ${cards.length}.`,
    );
  }
  const seenCodes = new Set<string>();
  const seenOffers = new Set<string>();
  const unnamed: UnnamedCard[] = [];
  cards.forEach((card, index) => {
    const code = card.codigoSeguradora.trim();
    const key = offerKey(card.codigoSeguradora, card.codigoApolice);
    if (accessibleNames[index].trim() === "") {
      unnamed.push({
        index,
        key,
        seguradoraJaListada: seenCodes.has(code),
        ofertaRepetida: seenOffers.has(key),
        bffSemNome: card.nomeSeguradora.trim() === "",
      });
    }
    seenCodes.add(code);
    seenOffers.add(key);
  });
  return unnamed;
}

const squash = (text: string): string => text.replace(/\s+/g, " ").trim();

/**
 * Cards da tela cujo texto visível, por índice, não traz o nome E a descrição da
 * apólice (plano) que o BFF enviou para aquele índice. A apólice pega a troca de
 * ordem entre ofertas da mesma seguradora.
 */
export function screenMismatches(
  cards: readonly InsurerCard[],
  visibleTexts: readonly string[],
): { index: number; esperado: string; tela: string }[] {
  if (visibleTexts.length !== cards.length) {
    throw new Error(
      `A tela tem quantidade de cards diferente da resposta: ${visibleTexts.length} x ${cards.length}.`,
    );
  }
  const mismatches: { index: number; esperado: string; tela: string }[] = [];
  cards.forEach((card, index) => {
    const screen = squash(visibleTexts[index]);
    for (const part of [squash(card.nomeSeguradora), squash(card.plano)]) {
      if (part === "") continue;
      if (!screen.toLowerCase().includes(part.toLowerCase())) {
        mismatches.push({ index, esperado: part, tela: screen.slice(0, 80) });
        break;
      }
    }
  });
  return mismatches;
}
