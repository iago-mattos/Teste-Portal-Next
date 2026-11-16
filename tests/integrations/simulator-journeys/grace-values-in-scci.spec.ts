import type { Page } from "@playwright/test";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { findQaRun } from "../../services/simulator-qa-runs";

/**
 * Conferência pedida pelo Castilho (Mestre da Originação): os valores devem sair
 * iguais com e sem carência. Compara, no SCCI, a "Evolução da Simulação" (120
 * parcelas) das operações criadas com as mesmas condições, uma com carência de
 * 60 dias (PF-IPCA-CARENCIA60) e outra sem carência (PF-IPCA-SEM-CARENCIA).
 * Somente leitura sobre operações já criadas.
 *
 * LIMITES (parecer do Revisor, 11/11/2026): a igualdade das parcelas NÃO prova
 * que a carência de 60 foi gravada na operação (nenhuma tela do SCCI mostra a
 * carência; se ela se perdeu no caminho, as tabelas também saem iguais). Também
 * não está confirmado com o Castilho que "iguais" seja o contrato (carência
 * costuma alterar o fluxo). Por isso o resultado é uma OBSERVAÇÃO @pendente-produto,
 * fora do conjunto validador. A leitura é protegida contra grade errada: as duas
 * tabelas precisam ter o prazo contratado (120 parcelas numeradas de 1 a 120).
 */
const EXPECTED_INSTALLMENTS = 120;
interface EvolutionRow {
  readonly installment: string;
  readonly amortization: string;
  readonly interest: string;
  readonly payment: string;
  readonly insurance: string;
  readonly balance: string;
}

interface ExtGrid {
  isVisible(deep: boolean): boolean;
  getStore(): { getRange(): { data: Record<string, unknown> }[] };
}

async function readEvolution(page: Page, protocol: string): Promise<EvolutionRow[]> {
  const operations = new AejsOperationsPage(page);
  await operations.navigateToOperations();
  await operations.openOperationEventually(protocol);
  await page
    .getByText("Dados da Operação", { exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const button = page
    .locator(".x-btn-inner:visible")
    .filter({ hasText: /^Evolução da Simulação$/ })
    .first();
  await expect(button).toBeVisible();
  await button.click();

  let rows: EvolutionRow[] = [];
  await expect
    .poll(
      async () => {
        rows = await page.evaluate(() => {
          const ext = (
            window as unknown as {
              Ext: { ComponentQuery: { query(selector: string): ExtGrid[] } };
            }
          ).Ext;
          const grids = ext.ComponentQuery.query("gridpanel").filter((grid) =>
            grid.isVisible(true),
          );
          const grid = grids[grids.length - 1];
          return grid
            ? grid.getStore().getRange().map((record) => ({
                installment: String(record.data.NU_PRESTACAO ?? ""),
                amortization: String(record.data.VA_AMORTIZACAO ?? ""),
                interest: String(record.data.VA_JUROS ?? ""),
                payment: String(record.data.VA_PRESTACAO ?? ""),
                insurance: String(record.data.VA_SEGUROS ?? ""),
                balance: String(record.data.VA_SALDO_DEVEDOR ?? ""),
              }))
            : [];
        });
        return rows.length;
      },
      { message: "A Evolução da Simulação não carregou as parcelas.", timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  // Sanidade: uma grade errada (ou obsoleta) idêntica nas duas leituras faria a
  // comparação passar sem provar nada. A evolução precisa ser a do prazo contratado.
  expect(rows, "Parcelas da Evolução da Simulação").toHaveLength(EXPECTED_INSTALLMENTS);
  expect(
    rows.map((row) => Number(row.installment)),
    "Parcelas numeradas de 1 até o prazo",
  ).toEqual(Array.from({ length: EXPECTED_INSTALLMENTS }, (_, index) => index + 1));
  return rows;
}

// Cada leitura usa a própria sessão do SCCI; o estado é passado entre os testes em série.
test.describe.configure({ mode: "serial" });

const tables: { withGrace?: EvolutionRow[]; withoutGrace?: EvolutionRow[] } = {};

async function protocolOf(scenarioId: string): Promise<string> {
  const run = await findQaRun(scenarioId);
  if (!run?.protocol) {
    throw new Error(`Crie antes a proposta ${scenarioId} (projeto simulator-journeys).`);
  }
  return run.protocol;
}

test(
  "lê a Evolução da Simulação da operação com carência de 60 dias",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }) => {
    test.setTimeout(5 * 60_000);
    tables.withGrace = await readEvolution(aejsPage, await protocolOf("PF-IPCA-CARENCIA60"));
  },
);

test(
  "lê a Evolução da Simulação da operação sem carência",
  { tag: ["@integration", "@readonly"] },
  async ({ aejsPage }) => {
    test.setTimeout(5 * 60_000);
    tables.withoutGrace = await readEvolution(aejsPage, await protocolOf("PF-IPCA-SEM-CARENCIA"));
  },
);

test(
  "os valores da Evolução da Simulação no SCCI saem iguais com e sem carência (observação)",
  { tag: ["@integration", "@readonly", "@pendente-produto"] },
  // eslint-disable-next-line no-empty-pattern
  async ({}, testInfo) => {
    const { withGrace, withoutGrace } = tables;
    if (!withGrace || !withoutGrace) {
      throw new Error("As leituras anteriores não produziram as duas tabelas.");
    }
    await testInfo.attach("evolucao-com-e-sem-carencia", {
      body: JSON.stringify(
        {
          comCarencia60: { parcelas: withGrace.length, primeiras: withGrace.slice(0, 3), ultima: withGrace.at(-1) },
          semCarencia: { parcelas: withoutGrace.length, primeiras: withoutGrace.slice(0, 3), ultima: withoutGrace.at(-1) },
        },
        null,
        2,
      ),
      contentType: "application/json",
    });

    expect(withoutGrace.length, "Mesmo número de parcelas").toBe(withGrace.length);
    expect(
      withoutGrace,
      "Com as mesmas condições, os valores devem sair iguais com e sem carência.",
    ).toEqual(withGrace);
  },
);
