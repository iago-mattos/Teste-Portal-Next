import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ScciInitialProcess,
  ScciJourneyReference,
  ScciReference,
} from "../types/scci-reference";

export const SCCI_REFERENCE_PATH = resolve(
  "tests/test-data/scci-reference.esteira-ht.json",
);

/**
 * Snapshot das tabelas do SCCI (esteira-ht) por jornada. Atualize com
 * `SCCI_REFERENCE_UPDATE=true` no teste tests/integrations/scci-reference.
 */
export function loadScciReference(): ScciReference {
  if (!existsSync(SCCI_REFERENCE_PATH)) {
    throw new Error(
      `Snapshot do SCCI ausente (${SCCI_REFERENCE_PATH}). Os testes do Simulador que comparam com o SCCI não rodam sem ele; ` +
        "gere com SCCI_REFERENCE_UPDATE=true (tests/integrations/scci-reference) ou copie-o do repositório de referência.",
    );
  }
  return JSON.parse(readFileSync(SCCI_REFERENCE_PATH, "utf8")) as ScciReference;
}

export function scciJourney(journeyId: string): ScciJourneyReference {
  const journey = loadScciReference().journeys.find(
    (item) => item.journeyId === journeyId,
  );
  if (!journey) {
    throw new Error(`Jornada sem referência no SCCI: ${journeyId}.`);
  }
  return journey;
}

export function scciInitialProcess(): ScciInitialProcess {
  return loadScciReference().process;
}
