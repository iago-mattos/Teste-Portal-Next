import { expect, type Locator, type Page } from "@playwright/test";

type Row = Readonly<Record<string, unknown>>;

/** Subconjunto do ExtJS usado para ler as grades já carregadas (somente leitura). */
interface ExtStore {
  getRange(): { data: Record<string, unknown> }[];
  /** Total informado pelo servidor; maior que getRange().length indica grade paginada. */
  getTotalCount?(): number;
  /** Modelo do store, para listar as colunas mesmo com a grade vazia. */
  getModel?(): { getFields?(): { name: string }[] };
  findRecord(
    field: string,
    value: string,
    start: number,
    anyMatch: boolean,
    caseSensitive: boolean,
    exactMatch: boolean,
  ): unknown;
}
interface ExtGrid {
  isVisible(deep: boolean): boolean;
  getStore(): ExtStore;
  getSelectionModel(): { select(record: unknown): void };
  getView(): { focusRow(record: unknown): void };
}
interface ExtFormField {
  isVisible(deep: boolean): boolean;
  getName?(): string;
  getValue?(): unknown;
}
interface ExtGlobal {
  ComponentQuery: { query(selector: string): ExtGrid[] & ExtFormField[] };
}

/** Colunas que o construtor do snapshot lê de cada grade (ver scci-reference-builder.ts). */
export const GRACE_COLUMNS = [
  "NU_MESES_CARENCIA_MAX",
  "NU_MESES_CARENCIA_1PRST",
  "IN_TIPO_JUROS_CARENCIA",
] as const;
export const INSURER_COLUMNS = ["CO_SEGURADORA", "CO_APOLICE"] as const;
export const INSURER_REGISTRY_COLUMNS = ["CODIGO", "NOME"] as const;
export const PHASE_COLUMNS = ["NU_FASE_OPERACAO", "NO_FASE_OPERACAO"] as const;
export const GROUP_COLUMNS = [
  "CO_GRUPO_TIPO_OPERACAO",
  "CO_GRUPO_SUPERIOR",
  "NO_GRUPO_TIPO_OPERACAO",
  "IN_MODALIDADE_SUSPENSA",
] as const;
export const LTV_COLUMNS = [
  "CO_TIPO_OPERACAO",
  "PE_LTV",
  "PE_COMPROMETIMENTO_RENDA",
  "CO_SISTEMA_AMORTIZACAO",
] as const;
export const OPERATION_TYPE_COLUMNS = [
  "CO_TIPO_OPERACAO",
  "CO_GRUPO_TIPO_OPERACAO",
  "NO_TIPO_OPERACAO",
  "VA_MINIMO_OPERACAO",
  "VA_MAXIMO_OPERACAO",
  "VA_MAX_IMOVEL",
  "NU_MESES_PRAZO_MINIMO",
  "NU_MESES_PRAZO_MAXIMO",
  "NU_IDADE_MINIMA",
  "NU_IDADE_MAXIMA",
  "NU_IDADE_MAIS_PRAZO_MAXIMO",
  "NU_IDADE_MAXIMA_MESES",
  "NU_IDADE_MAIS_PRZ_MAX_MESES",
  "VA_MINIMO_PRESTACAO",
] as const;

/**
 * Leitura das tabelas de referência do SCCI (Manutenção > Tabelas). Só
 * consulta: nunca usa Incluir, Alterar ou Excluir. Serve de oráculo de
 * domínio independente do Simulador.
 */
export class AejsReferenceTablesPage {
  constructor(private readonly page: Page) {}

  private get busy(): Locator {
    return this.page.getByText("Aguarde...", { exact: false }).first();
  }

  private treeNode(name: string): Locator {
    return this.page
      .locator(".x-tree-node-text")
      .filter({ hasText: new RegExp(`^${name}$`) })
      .first();
  }

  private async settle(): Promise<void> {
    await expect(this.busy).toBeHidden({ timeout: 60_000 });
  }

  private async openTablesTree(): Promise<void> {
    if ((await this.treeNode("Tabelas").count()) > 0) return;
    await this.page.getByText("Manutenção", { exact: true }).first().click();
    await this.settle();
    await this.page.getByText("Tabelas", { exact: true }).first().click();
    await this.settle();
    await expect(this.treeNode("Tabelas")).toBeVisible();
  }

  private async expandNode(name: string): Promise<void> {
    const row = this.page
      .locator(".x-grid-item")
      .filter({ has: this.treeNode(name) });
    await row.locator(".x-tree-expander").first().click();
  }

  /** Abre uma tabela pelo caminho da árvore, por exemplo ["Originação", "Tipo de operação"]. */
  async openTable(path: readonly string[]): Promise<void> {
    await this.openTablesTree();
    const table = path[path.length - 1];
    if (!table) throw new Error("Informe a tabela a abrir.");
    // Expande os grupos só quando a tabela ainda não está visível na árvore.
    if (!(await this.treeNode(table).isVisible())) {
      for (const group of path.slice(0, -1)) await this.expandNode(group);
    }
    await expect(this.treeNode(table)).toBeVisible();
    await this.treeNode(table).dblclick();
    await this.settle();
  }

  /** Clica em "Pesquisar" quando a tabela exige filtro antes de listar. */
  async searchAll(): Promise<void> {
    const search = this.page
      .locator(".x-btn-inner:visible")
      .filter({ hasText: /^Pesquisar$/ });
    if ((await search.count()) === 0) return;
    await search.first().click();
    await this.settle();
  }

  /**
   * Linhas da grade visível mais recente (a janela aberta, quando houver).
   *
   * Controles contra leitura errada do oráculo:
   * - `expectedColumns`: a grade lida precisa ter essas colunas (no modelo do
   *   store ou na primeira linha). Se a janela nova ainda não renderizou e a
   *   grade anterior continua visível, as colunas não batem e a leitura espera;
   * - grade paginada: se o servidor informa mais linhas do que o store carregou,
   *   a leitura falha em vez de devolver só uma página.
   */
  async readTopGrid(
    minimumRows = 0,
    expectedColumns: readonly string[] = [],
  ): Promise<Row[]> {
    let rows: Row[] = [];
    let diagnosis = "";
    try {
      await expect
        .poll(
          async () => {
            const read = await this.page.evaluate(() => {
              const ext = (window as unknown as { Ext: ExtGlobal }).Ext;
              const grids = ext.ComponentQuery.query("gridpanel").filter(
                (grid) => grid.isVisible(true),
              );
              const grid = grids[grids.length - 1];
              if (!grid) return { rows: [], fields: [] as string[], total: 0 };
              const store = grid.getStore();
              const model = store.getModel?.();
              return {
                total: Number(store.getTotalCount?.() ?? 0),
                fields: (model?.getFields?.() ?? []).map((field) => field.name),
                rows: store.getRange().map((record) =>
                  // Descarta colunas de imagem (IM_*), que são binários grandes.
                  Object.fromEntries(
                    Object.entries(record.data).filter(
                      ([key]) => !key.startsWith("IM_"),
                    ),
                  ),
                ),
              };
            });
            rows = read.rows;
            const known = new Set([...read.fields, ...Object.keys(rows[0] ?? {})]);
            const missing = expectedColumns.filter((column) => !known.has(column));
            if (missing.length > 0) {
              diagnosis = `colunas ausentes na grade visível: ${missing.join(", ")} (colunas vistas: ${[...known].slice(0, 12).join(", ") || "nenhuma"})`;
              return -1;
            }
            if (read.total > rows.length) {
              diagnosis = `grade paginada: o servidor informa ${read.total} linhas e o store tem ${rows.length}`;
              return -1;
            }
            diagnosis = "";
            return rows.length;
          },
          { message: "A grade do SCCI não carregou as linhas.", timeout: 60_000 },
        )
        .toBeGreaterThanOrEqual(minimumRows);
    } catch (error) {
      if (diagnosis) {
        throw new Error(`Leitura do SCCI inválida: ${diagnosis}.`, { cause: error });
      }
      throw error;
    }
    return rows;
  }

  /** Campos visíveis de uma tela de formulário (nome do campo → valor), somente leitura. */
  async readFormFields(): Promise<Record<string, string>> {
    return this.page.evaluate(() => {
      const ext = (window as unknown as { Ext: ExtGlobal }).Ext;
      const fields: Record<string, string> = {};
      for (const field of ext.ComponentQuery.query("field") as ExtFormField[]) {
        if (!field.isVisible(true)) continue;
        const name = field.getName?.();
        if (name) fields[name] = String(field.getValue?.() ?? "").trim();
      }
      return fields;
    });
  }

  /** Seleciona o tipo de operação pela grade (a grade só renderiza as linhas visíveis). */
  private async selectOperationType(code: string): Promise<void> {
    const selected = await this.page.evaluate((target) => {
      const ext = (window as unknown as { Ext: ExtGlobal }).Ext;
      const grid = ext.ComponentQuery.query("gridpanel").filter((item) =>
        item.isVisible(true),
      )[0];
      const record = grid?.getStore().findRecord(
        "CO_TIPO_OPERACAO",
        target,
        0,
        false,
        true,
        true,
      );
      if (!grid || !record) return false;
      grid.getSelectionModel().select(record);
      grid.getView().focusRow(record);
      return true;
    }, code);
    if (!selected) throw new Error(`Tipo de operação ${code} não encontrado.`);
  }

  private async closeOpenWindows(): Promise<void> {
    const close = this.page
      .locator(".x-btn-inner:visible")
      .filter({ hasText: /^Fechar tela$/ });
    for (let remaining = await close.count(); remaining > 0; remaining -= 1) {
      await close.last().click();
      await expect(close).toHaveCount(remaining - 1);
    }
  }

  /** Lê a grade da janela aberta até o número de linhas estabilizar (uma grade vazia carrega sem aviso). */
  private async readStableTopGrid(
    expectedColumns: readonly string[] = [],
  ): Promise<Row[]> {
    let rows: Row[] = [];
    let previous = -1;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      rows = await this.readTopGrid(0, expectedColumns);
      if (rows.length === previous) break;
      previous = rows.length;
      await this.page.waitForTimeout(600);
    }
    return rows;
  }

  /**
   * Regras de carência cadastradas para um tipo de operação (Consultar > Carências).
   * Lista vazia = o tipo não tem carência configurada. Exige "Tipo de operação" aberta e pesquisada.
   */
  async readGraceRulesOfOperationType(code: string): Promise<Row[]> {
    await this.selectOperationType(code);
    await this.page
      .locator(".x-btn-inner:visible")
      .filter({ hasText: /^Consultar$/ })
      .first()
      .click();
    await this.settle();
    const graceButton = this.page
      .locator(".x-btn-inner:visible")
      .filter({ hasText: /^Carências$/ })
      .first();
    await expect(graceButton).toBeVisible();
    await graceButton.click();
    await this.settle();
    // Colunas que o leitor usa: sem elas, "0 regras" não prova que o tipo não tem carência.
    const rows = await this.readStableTopGrid(GRACE_COLUMNS);
    await this.closeOpenWindows();
    return rows;
  }

  /**
   * Seguradoras vinculadas a um tipo de operação (Consultar > Seguradoras).
   * Exige a tabela "Tipo de operação" aberta e pesquisada.
   */
  async readInsurersOfOperationType(code: string): Promise<Row[]> {
    await this.selectOperationType(code);
    await this.page
      .locator(".x-btn-inner:visible")
      .filter({ hasText: /^Consultar$/ })
      .first()
      .click();
    await this.settle();
    const insurersButton = this.page
      .locator(".x-btn-inner:visible")
      .filter({ hasText: /^Seguradoras$/ })
      .first();
    await expect(insurersButton).toBeVisible();
    await insurersButton.click();
    await this.settle();
    const rows = await this.readTopGrid(1, INSURER_COLUMNS);
    await this.closeOpenWindows();
    return rows;
  }
}
