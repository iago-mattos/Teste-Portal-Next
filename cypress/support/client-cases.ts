import knownPendingCases from "../config/known-pending.json";

export interface ClientCase {
  id: string;
  rule: string;
  sourceStatus: string | null;
  sourceObservation: string | null;
}

export type CaseImplementation = () => void;
export type CaseImplementations = Record<string, CaseImplementation>;

const pendingCases = knownPendingCases as Record<
  string,
  { reason: string; reviewBy: string }
>;

/**
 * Mantem o catalogo da cliente visivel no runner sem gerar falso positivo.
 * Um caso sem implementacao fica identificado como pendente de automacao.
 */
export function registerClientCases(
  feature: string,
  cases: readonly ClientCase[],
  implementations: CaseImplementations = {},
): void {
  describe(feature, () => {
    const selectedCaseId = Cypress.config("reporterOptions")?.caseId as
      | string
      | undefined;
    const selectedCaseIds = selectedCaseId
      ?.split(/[|,]/)
      .map((caseId) => caseId.trim())
      .filter(Boolean);

    for (const testCase of cases) {
      const implementation = implementations[testCase.id];
      const title = `${testCase.id} | ${testCase.rule}`;

      if (selectedCaseIds?.length && !selectedCaseIds.includes(testCase.id)) {
        continue;
      }

      if (implementation) {
        it(title, implementation);
      } else {
        const pending = pendingCases[testCase.id];
        if (!pending) {
          throw new Error(
            `${testCase.id} nao possui implementacao nem justificativa em known-pending.json.`,
          );
        }
        it.skip(
          `[PENDENTE ATE ${pending.reviewBy}] ${title} | ${pending.reason}`,
          () => undefined,
        );
      }
    }
  });
}
