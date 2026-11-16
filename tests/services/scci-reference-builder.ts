import type {
  ScciGraceRule,
  ScciInsurerLink,
  ScciJourneyReference,
  ScciLtvBand,
  ScciOperationType,
} from "../types/scci-reference";
import type { ObservedJourney } from "../types/simulator";

type Row = Readonly<Record<string, unknown>>;

const text = (row: Row, key: string): string => String(row[key] ?? "").trim();
/**
 * Número da coluna. Coluna AUSENTE na linha lança erro (não vira 0 em silêncio,
 * o que esconderia um leitor apontando para a grade errada); valor nulo = 0.
 */
const num = (row: Row, key: string): number => {
  if (!(key in row)) {
    throw new Error(`Grade do SCCI sem a coluna ${key} (colunas: ${Object.keys(row).slice(0, 15).join(", ")}).`);
  }
  return Number(row[key] ?? 0);
};

function isTrue(value: unknown): boolean {
  return value === true || ["T", "t", "S", "s", "V", "v"].includes(String(value));
}

/** Cadeia de grupos da jornada (da modalidade à folha), pelos nomes do menu na árvore de grupos do SCCI. */
export function resolveJourneyGroupChain(
  groups: readonly Row[],
  journey: ObservedJourney,
): readonly Row[] {
  const steps: readonly (string | undefined)[] = [
    journey.selection.modality,
    journey.selection.borrowerType,
    journey.selection.propertyType,
    journey.selection.propertyOrigin,
    journey.selection.indexer,
  ];
  // As modalidades ficam sob o grupo 009 "Nova Operação".
  let parent = "009";
  const chain: Row[] = [];
  for (const step of steps.filter((item): item is string => Boolean(item))) {
    const matches = groups.filter(
      (group) =>
        text(group, "CO_GRUPO_SUPERIOR") === parent &&
        text(group, "NO_GRUPO_TIPO_OPERACAO") === step &&
        !group.IN_MODALIDADE_INATIVA,
    );
    if (matches.length !== 1 || !matches[0]) {
      throw new Error(
        `Jornada ${journey.id}: ${matches.length} grupos ativos do SCCI chamados "${step}" sob ${parent}.`,
      );
    }
    chain.push(matches[0]);
    parent = text(matches[0], "CO_GRUPO_TIPO_OPERACAO");
  }
  return chain;
}

/** Grupo da folha da jornada. */
export function resolveJourneyGroupCode(
  groups: readonly Row[],
  journey: ObservedJourney,
): string {
  const leaf = resolveJourneyGroupChain(groups, journey).at(-1);
  if (!leaf) throw new Error(`Jornada ${journey.id}: sem grupos.`);
  return text(leaf, "CO_GRUPO_TIPO_OPERACAO");
}

export function buildJourneyReference(
  journey: ObservedJourney,
  groups: readonly Row[],
  operationTypes: readonly Row[],
  insurerRegistry: ReadonlyMap<string, string>,
  insurersByType: ReadonlyMap<string, readonly Row[]>,
  ltvRows: readonly Row[] = [],
  graceByType: ReadonlyMap<string, readonly Row[]> = new Map(),
): ScciJourneyReference {
  const groupCode = resolveJourneyGroupCode(groups, journey);
  const types = operationTypes
    .filter((type) => text(type, "CO_GRUPO_TIPO_OPERACAO") === groupCode)
    .map((type): ScciOperationType => {
      const code = text(type, "CO_TIPO_OPERACAO");
      const insurers = (insurersByType.get(code) ?? []).map(
        (link): ScciInsurerLink => {
          const insurerCode = text(link, "CO_SEGURADORA");
          return {
            code: insurerCode,
            name: insurerRegistry.get(insurerCode) ?? `(código ${insurerCode})`,
            policy: text(link, "CO_APOLICE"),
          };
        },
      );
      return {
        code,
        description: text(type, "NO_TIPO_OPERACAO"),
        minOperation: num(type, "VA_MINIMO_OPERACAO"),
        maxOperation: num(type, "VA_MAXIMO_OPERACAO"),
        maxProperty: num(type, "VA_MAX_IMOVEL"),
        minTermMonths: num(type, "NU_MESES_PRAZO_MINIMO"),
        maxTermMonths: num(type, "NU_MESES_PRAZO_MAXIMO"),
        minAge: num(type, "NU_IDADE_MINIMA"),
        maxAge: num(type, "NU_IDADE_MAXIMA"),
        agePlusTermMax: num(type, "NU_IDADE_MAIS_PRAZO_MAXIMO"),
        maxAgeMonths: num(type, "NU_IDADE_MAXIMA_MESES"),
        agePlusTermMaxMonths: num(type, "NU_IDADE_MAIS_PRZ_MAX_MESES"),
        minInstallment: num(type, "VA_MINIMO_PRESTACAO"),
        insurers,
        graceRules: (graceByType.get(code) ?? []).map(
          (rule): ScciGraceRule => ({
            maxMonths: num(rule, "NU_MESES_CARENCIA_MAX"),
            firstInstallmentMonths: num(rule, "NU_MESES_CARENCIA_1PRST"),
            interestType: text(rule, "IN_TIPO_JUROS_CARENCIA"),
          }),
        ),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  if (types.length === 0) {
    throw new Error(`Jornada ${journey.id}: grupo ${groupCode} sem tipos de operação.`);
  }

  const typeCodes = new Set(types.map((type) => type.code));
  const ltvBands = ltvRows
    .filter(
      (row) =>
        text(row, "CO_GRUPO_TIPO_OPERACAO") === groupCode ||
        typeCodes.has(text(row, "CO_TIPO_OPERACAO")),
    )
    .map(
      (row): ScciLtvBand => ({
        operationTypeCode: text(row, "CO_TIPO_OPERACAO"),
        maxLtvPercent: num(row, "PE_LTV"),
        incomeCommitmentPercent: num(row, "PE_COMPROMETIMENTO_RENDA"),
        amortizationSystem: text(row, "CO_SISTEMA_AMORTIZACAO"),
        inactive: Boolean(row.IN_FAIXA_INATIVA),
      }),
    )
    .sort(
      (a, b) =>
        a.operationTypeCode.localeCompare(b.operationTypeCode) ||
        a.amortizationSystem.localeCompare(b.amortizationSystem) ||
        a.maxLtvPercent - b.maxLtvPercent,
    );

  const suspendedGroups = resolveJourneyGroupChain(groups, journey)
    .filter((group) => isTrue(group.IN_MODALIDADE_SUSPENSA))
    .map((group) => `${text(group, "CO_GRUPO_TIPO_OPERACAO")} ${text(group, "NO_GRUPO_TIPO_OPERACAO")}`);

  return { journeyId: journey.id, groupCode, suspendedGroups, operationTypes: types, ltvBands };
}
