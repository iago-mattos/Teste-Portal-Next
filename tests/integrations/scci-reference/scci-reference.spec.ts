import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import {
  AejsReferenceTablesPage,
  GROUP_COLUMNS,
  INSURER_REGISTRY_COLUMNS,
  LTV_COLUMNS,
  OPERATION_TYPE_COLUMNS,
  PHASE_COLUMNS,
} from "../../pages/aejs/aejs-reference-tables.page";
import { buildJourneyReference } from "../../services/scci-reference-builder";
import {
  OBSERVED_SIMULATOR_JOURNEYS,
} from "../../test-data/simulator-journeys";
import { SCCI_REFERENCE_PATH } from "../../test-data/scci-reference";
import type { ScciReference } from "../../types/scci-reference";

/**
 * Lê as tabelas do SCCI (somente leitura) e monta a referência por jornada.
 * Sem SCCI_REFERENCE_UPDATE=true confere o snapshot versionado e reprova em
 * caso de divergência (detecta mudança de cadastro no SCCI).
 */
test(
  "SCCI | referência de grupos, tipos e seguradoras das jornadas do Simulador",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }) => {
    test.setTimeout(14 * 60_000);
    const tables = new AejsReferenceTablesPage(aejsPage);
    const update = process.env.SCCI_REFERENCE_UPDATE === "true";

    const insurerRegistry = new Map<string, string>();
    await test.step("lê o cadastro de seguradoras", async () => {
      await tables.openTable(["Terceiros", "Seguradora"]);
      for (const row of await tables.readTopGrid(1, INSURER_REGISTRY_COLUMNS)) {
        insurerRegistry.set(String(row.CODIGO).trim(), String(row.NOME).trim());
      }
      expect(insurerRegistry.size).toBeGreaterThan(0);
    });

    const initialProcess = await test.step("lê a fase e a tarefa iniciais da originação", async () => {
      await tables.openTable(["Originação", "Configurações"]);
      const settings = await tables.readFormFields();
      const phaseCode = settings.NU_FASE_SIMULACAO;
      const taskCode = settings.CO_TAREFA_ENVIO_PROPOSTA;
      if (!phaseCode || !taskCode) {
        throw new Error("Configurações do SCCI sem NU_FASE_SIMULACAO ou CO_TAREFA_ENVIO_PROPOSTA.");
      }

      await tables.openTable(["Originação", "Fases da operação"]);
      await tables.searchAll();
      const phases = await tables.readTopGrid(1, PHASE_COLUMNS);
      const phase = phases.find(
        (row) => String(row.NU_FASE_OPERACAO).trim() === phaseCode,
      );
      if (!phase) throw new Error(`Fase ${phaseCode} não cadastrada em "Fases da operação".`);
      return {
        initialPhaseCode: phaseCode,
        initialPhaseName: String(phase.NO_FASE_OPERACAO).trim(),
        initialTaskCode: taskCode,
      };
    });

    const groups = await test.step("lê os grupos de tipos de operação", async () => {
      await tables.openTable(["Originação", "Grupos de tipos de operação"]);
      return tables.readTopGrid(1, GROUP_COLUMNS);
    });

    const ltvRows = await test.step("lê as faixas de LTV por tipo de operação", async () => {
      await tables.openTable(["Originação", "Faixa LTV por tipo de operação"]);
      await tables.searchAll();
      return tables.readTopGrid(1, LTV_COLUMNS);
    });

    const operationTypes = await test.step("lê os tipos de operação", async () => {
      await tables.openTable(["Originação", "Tipo de operação"]);
      await tables.searchAll();
      return tables.readTopGrid(1, OPERATION_TYPE_COLUMNS);
    });

    // A leitura das seguradoras por tipo exige "Tipo de operação" como última tabela aberta.
    const groupByJourney = new Map(
      OBSERVED_SIMULATOR_JOURNEYS.map((journey) => [
        journey.id,
        buildJourneyReference(
          journey,
          groups,
          operationTypes,
          insurerRegistry,
          new Map(),
          ltvRows,
        ),
      ]),
    );

    const insurersByType = new Map<string, Record<string, unknown>[]>();
    await test.step("lê as seguradoras de cada tipo das jornadas", async () => {
      for (const journey of groupByJourney.values()) {
        for (const type of journey.operationTypes) {
          insurersByType.set(
            type.code,
            await tables.readInsurersOfOperationType(type.code),
          );
        }
      }
    });

    const graceByType = new Map<string, Record<string, unknown>[]>();
    await test.step("lê as regras de carência de cada tipo das jornadas", async () => {
      for (const journey of groupByJourney.values()) {
        for (const type of journey.operationTypes) {
          graceByType.set(
            type.code,
            await tables.readGraceRulesOfOperationType(type.code),
          );
        }
      }
    });

    const reference: ScciReference = {
      source:
        "SCCI esteira-ht (https://esteiradigital-ht.prognum.com.br): Manutenção > Tabelas > Originação (Grupos de tipos de operação, Tipo de operação > Seguradoras, Faixa LTV por tipo de operação; Tipo de operação > Carências) e Terceiros > Seguradora",
      readAt: new Date().toISOString(),
      process: initialProcess,
      journeys: OBSERVED_SIMULATOR_JOURNEYS.map((journey) =>
        buildJourneyReference(
          journey,
          groups,
          operationTypes,
          insurerRegistry,
          insurersByType,
          ltvRows,
          graceByType,
        ),
      ),
    };

    if (update) {
      writeFileSync(SCCI_REFERENCE_PATH, `${JSON.stringify(reference, null, 2)}\n`);
      return;
    }
    // Sem o snapshot e sem opt-in explícito, o teste NÃO se autoaprova gravando o arquivo.
    if (!existsSync(SCCI_REFERENCE_PATH)) {
      throw new Error(
        `Snapshot do SCCI ausente (${SCCI_REFERENCE_PATH}). Gere com SCCI_REFERENCE_UPDATE=true e revise o conteúdo antes de usar como referência.`,
      );
    }

    const saved = JSON.parse(
      readFileSync(SCCI_REFERENCE_PATH, "utf8"),
    ) as ScciReference;
    expect(
      { process: reference.process, journeys: reference.journeys },
      "O cadastro do SCCI mudou em relação ao snapshot. Reveja e atualize com SCCI_REFERENCE_UPDATE=true.",
    ).toEqual({ process: saved.process, journeys: saved.journeys });
  },
);
