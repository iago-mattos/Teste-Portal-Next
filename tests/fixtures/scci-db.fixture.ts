import { test as base } from "@playwright/test";
import { resolveScciDbConfig } from "../config/scci-db-config";
import { ScciSimulatorRecords } from "../services/scci-db/simulator-records";

/**
 * `scciDb`: consultas SOMENTE LEITURA ao Oracle do SCCI (ver tests/services/scci-db).
 * Sem SCCI_DB_SSH_HOST no perfil, o teste que usa a fixture é pulado.
 *
 *   import { scciDbTest as test, expect } from "../fixtures/scci-db.fixture";
 *   test("...", async ({ scciDb }) => {
 *     const proposal = await scciDb.getProposal(protocolo);
 *   });
 */
export const scciDbTest = base.extend<{ scciDb: ScciSimulatorRecords }>({
  // eslint-disable-next-line no-empty-pattern
  scciDb: async ({}, use, testInfo) => {
    const config = resolveScciDbConfig();
    testInfo.skip(!config, "Defina SCCI_DB_SSH_HOST no perfil para consultar o banco do SCCI.");
    await use(new ScciSimulatorRecords(config!));
  },
});

export { expect } from "@playwright/test";
