import { expect, type APIRequestContext } from "@playwright/test";

/**
 * Regras do Simulador configuradas no admin (Simulador > Limites e Regras).
 * O app público recebe essas chaves embutidas no HTML (`regras`), então o teste
 * as lê sem login de administrador. Os valores esperados dos testes vêm daqui,
 * não de literais copiados da interface.
 */
export interface SimulatorRules {
  readonly valorMinImovel: number;
  readonly valoresCampoCarencia: readonly number[];
  readonly valoresPrazo: readonly number[];
  readonly prazoMinimo: number;
  readonly prazoMaximo: number;
  /** Sistemas oferecidos (admin: "SAC - ...:2|TP - Tabela Price:1"); `code` é o código do SCCI. */
  readonly amortizationSystems: readonly Readonly<{ label: string; code: string }>[];
}

function parseNumberList(raw: string | undefined, key: string): number[] {
  const parsed: unknown = JSON.parse(raw ?? "null");
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !parsed.every((item) => Number.isFinite(item))
  ) {
    throw new Error(`Regra do admin inválida: ${key}=${raw ?? "ausente"}.`);
  }
  return parsed as number[];
}

function parseNumber(raw: string | undefined, key: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Regra do admin inválida: ${key}=${raw ?? "ausente"}.`);
  }
  return value;
}

export async function readSimulatorRules(
  request: APIRequestContext,
): Promise<SimulatorRules> {
  const response = await request.get("/menu-simulacao");
  expect(response.ok(), "O Simulador deve responder em /menu-simulacao.").toBe(
    true,
  );
  const html = await response.text();

  // No HTML do Next as aspas do JSON embutido aparecem escapadas (\").
  const match = /\\"regras\\":(\{[^{}]*\})/.exec(html);
  if (!match?.[1]) {
    throw new Error(
      "As regras do admin (`regras`) não foram encontradas no HTML do Simulador.",
    );
  }
  const regras = JSON.parse(match[1].replace(/\\"/g, '"')) as Record<
    string,
    string
  >;

  const systems = /\\"dadosSimulacao\.sistemaAmortizacao\.opcoes\\":\\"([^"\\]+)\\"/.exec(
    html,
  )?.[1];
  if (!systems) {
    throw new Error(
      "As opções de sistema de amortização não foram encontradas no HTML do Simulador.",
    );
  }
  const amortizationSystems = systems.split("|").map((option) => {
    const separator = option.lastIndexOf(":");
    return {
      label: option.slice(0, separator).trim(),
      code: option.slice(separator + 1).trim(),
    };
  });

  return Object.freeze({
    valorMinImovel: parseNumber(regras.valorMinImovel, "valorMinImovel"),
    valoresCampoCarencia: parseNumberList(
      regras.valoresCampoCarencia,
      "valoresCampoCarencia",
    ),
    valoresPrazo: parseNumberList(regras.valoresPrazo, "valoresPrazo"),
    prazoMinimo: parseNumber(regras.prazoMinimo, "prazoMinimo"),
    prazoMaximo: parseNumber(regras.prazoMaximo, "prazoMaximo"),
    amortizationSystems,
  });
}
