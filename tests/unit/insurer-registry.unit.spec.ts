import { expect, test } from "@playwright/test";
import {
  classifyInsurerCards,
  describeUnnamedCards,
  parseEvolutionResponse,
  screenMismatches,
  type InsurerCard,
  type InsurerRegistryRow,
} from "../services/scci-db/insurer-registry";

/**
 * Testes da comparação entre os cards de seguradora que o Simulador devolve
 * (POST /api/simulacao/evolucao) e o cadastro do SCCI (SEGURADORA_TIPO_OPERACAO
 * + SEGURA). Sem rede e sem browser.
 */

const card = (
  code: string,
  policy: string,
  name = `SEG ${code}`,
  plano = "",
): InsurerCard => ({
  codigoSeguradora: code,
  codigoApolice: policy,
  nomeSeguradora: name,
  plano,
});

const row = (
  code: number,
  policy: string,
  seq: number,
  name: string | null = `SEG ${code}`,
  enquadramento: number | null = null,
): InsurerRegistryRow => ({
  coSeguradora: code,
  coApolice: policy,
  coEnquadramento: enquadramento,
  nuSeq: seq,
  nome: name,
});

test.describe("insurer-registry | resposta da evolução", () => {
  const body = JSON.stringify({
    seguradoras: [
      { codigoSeguradora: "5", nomeSeguradora: "SOMPO SEGUROS", codigoApolice: "5200", plano: "200-SOMPO SEGUROS", logoBase64: "xxx" },
    ],
    resumo: { codigoTipoOperacao: "904", nuSimulacao: "151321560", nuSessao: "33555" },
  });

  test("lê cards, tipo de operação e a chave da simulação", () => {
    expect(parseEvolutionResponse(body)).toEqual({
      cards: [
        { codigoSeguradora: "5", nomeSeguradora: "SOMPO SEGUROS", codigoApolice: "5200", plano: "200-SOMPO SEGUROS" },
      ],
      codigoTipoOperacao: "904",
      nuSimulacao: "151321560",
      nuSessao: "33555",
    });
  });

  test("não guarda o logo (base64) nem outros campos dos cards", () => {
    expect(JSON.stringify(parseEvolutionResponse(body))).not.toContain("xxx");
  });

  test("falha alto se o contrato da resposta mudou", () => {
    expect(() => parseEvolutionResponse("")).toThrow(/JSON/);
    expect(() => parseEvolutionResponse("{}")).toThrow(/seguradoras/);
    expect(() => parseEvolutionResponse(JSON.stringify({ seguradoras: [] }))).toThrow(/resumo/);
    expect(() =>
      parseEvolutionResponse(JSON.stringify({ seguradoras: [], resumo: { codigoTipoOperacao: "904" } })),
    ).toThrow(/nuSimulacao/);
  });
});

test.describe("insurer-registry | cards x cadastro", () => {
  test("tudo igual: sem fora do cadastro, sem repetição, sem card sem nome", () => {
    const result = classifyInsurerCards(
      [card("5", "5200"), card("9", "9500")],
      [row(5, "5200", 1), row(9, "9500", 2)],
    );
    expect(result.outsideRegistry).toEqual([]);
    expect(result.repeated).toEqual([]);
    expect(result.deduplicatedByApp).toEqual([]);
    expect(result.unnamed).toEqual([]);
  });

  test("card que não existe no cadastro do tipo é 'fora do cadastro'", () => {
    const result = classifyInsurerCards([card("5", "5200"), card("1", "100")], [row(5, "5200", 1)]);
    expect(result.outsideRegistry).toEqual([card("1", "100")]);
  });

  test("cadastro repete a linha e o Simulador mostra todas: origem na base, Simulador não deduplica", () => {
    const result = classifyInsurerCards(
      [card("7", "7200"), card("7", "7200"), card("7", "7200")],
      [row(7, "7200", 1), row(7, "7200", 2), row(7, "7200", 3)],
    );
    expect(result.repeated).toEqual([
      {
        key: "7/7200",
        cards: 3,
        registryRows: 3,
        enquadramentos: [null, null, null],
        origin: "base-sem-deduplicacao",
      },
    ]);
  });

  test("Simulador mostra mais cards do que o cadastro tem linhas: origem no Simulador", () => {
    const result = classifyInsurerCards(
      [card("7", "7200"), card("7", "7200")],
      [row(7, "7200", 1)],
    );
    expect(result.repeated).toEqual([
      { key: "7/7200", cards: 2, registryRows: 1, enquadramentos: [null], origin: "simulador" },
    ]);
  });

  test("cadastro repete e o Simulador mostra um card só: o Simulador deduplica (sem defeito)", () => {
    const result = classifyInsurerCards(
      [card("7", "7200")],
      [row(7, "7200", 1), row(7, "7200", 2)],
    );
    expect(result.repeated).toEqual([]);
    expect(result.deduplicatedByApp).toEqual([{ key: "7/7200", registryRows: 2 }]);
  });

  test("mesma seguradora com apólices diferentes são ofertas diferentes, não repetição", () => {
    const result = classifyInsurerCards(
      [card("7", "7200"), card("7", "7300")],
      [row(7, "7200", 1), row(7, "7300", 2)],
    );
    expect(result.repeated).toEqual([]);
  });

  test("card sem nome: se o cadastro (SEGURA) também não tem nome, a origem é a base", () => {
    const result = classifyInsurerCards([card("4", "4300", "")], [row(4, "4300", 1, null)]);
    expect(result.unnamed).toEqual([{ key: "4/4300", registryHasName: false, origin: "base" }]);
  });

  test("card sem nome com nome no cadastro: o Simulador perdeu o nome", () => {
    const result = classifyInsurerCards([card("4", "4300", "  ")], [row(4, "4300", 1, "MAPFRE")]);
    expect(result.unnamed).toEqual([{ key: "4/4300", registryHasName: true, origin: "simulador" }]);
  });

  test("compara apólice sem espaços nas pontas", () => {
    const result = classifyInsurerCards([card("5", "5200 ")], [row(5, " 5200", 1)]);
    expect(result.outsideRegistry).toEqual([]);
  });
});

test.describe("insurer-registry | origem da repetição considera o enquadramento", () => {
  const two = [card("7", "7200"), card("7", "7200")];

  test("linhas repetidas com o MESMO enquadramento: origem na base", () => {
    const result = classifyInsurerCards(two, [row(7, "7200", 1, "S", 1), row(7, "7200", 2, "S", 1)]);
    expect(result.repeated[0]).toMatchObject({ origin: "base-sem-deduplicacao", enquadramentos: [1, 1] });
  });

  test("linhas repetidas de enquadramentos DIFERENTES: indeterminado (o enquadramento usado não é conhecido)", () => {
    const result = classifyInsurerCards(two, [row(7, "7200", 1, "S", 1), row(7, "7200", 2, "S", 2)]);
    expect(result.repeated[0]).toMatchObject({
      origin: "indeterminado-enquadramento",
      enquadramentos: [1, 2],
    });
  });

  test("uma linha sem enquadramento (vale para todos) mais uma de enquadramento 1: as duas se aplicam", () => {
    const result = classifyInsurerCards(two, [row(7, "7200", 1, "S", 0), row(7, "7200", 2, "S", 1)]);
    expect(result.repeated[0]).toMatchObject({ origin: "base-sem-deduplicacao" });
  });

  test("o Simulador só deduplica quando há mais linhas aplicáveis do que cards", () => {
    const result = classifyInsurerCards(
      [card("7", "7200")],
      [row(7, "7200", 1, "S", 1), row(7, "7200", 2, "S", 2)],
    );
    // linhas de enquadramentos diferentes não se aplicam juntas: não é deduplicação
    expect(result.deduplicatedByApp).toEqual([]);
  });
});

test.describe("insurer-registry | cards sem nome acessível, por índice", () => {
  const cards = [card("5", "5200"), card("9", "9500"), card("9", "9500"), card("9", "9600"), card("4", "4300")];

  test("devolve índice, chave e se a seguradora já tinha aparecido antes na lista", () => {
    const result = describeUnnamedCards(cards, ["SOMPO", "TOO", "", "", "MAPFRE"]);
    expect(result).toEqual([
      { index: 2, key: "9/9500", seguradoraJaListada: true, ofertaRepetida: true, bffSemNome: false },
      { index: 3, key: "9/9600", seguradoraJaListada: true, ofertaRepetida: false, bffSemNome: false },
    ]);
  });

  test("card sem nome que é o primeiro da seguradora não é 'já listada'", () => {
    const result = describeUnnamedCards(cards, ["", "TOO", "TOO", "TOO", "MAPFRE"]);
    expect(result).toEqual([
      { index: 0, key: "5/5200", seguradoraJaListada: false, ofertaRepetida: false, bffSemNome: false },
    ]);
  });

  test("separa o card que o BFF já mandou sem nome (origem na base) do que perdeu o nome na tela", () => {
    const result = describeUnnamedCards(
      [card("4", "4300", ""), card("5", "5200", "SOMPO")],
      ["", ""],
    );
    expect(result).toEqual([
      { index: 0, key: "4/4300", seguradoraJaListada: false, ofertaRepetida: false, bffSemNome: true },
      { index: 1, key: "5/5200", seguradoraJaListada: false, ofertaRepetida: false, bffSemNome: false },
    ]);
  });

  test("nome só com espaços conta como sem nome", () => {
    expect(describeUnnamedCards([card("5", "5200")], ["  "])).toHaveLength(1);
  });

  test("lista de nomes de tamanho diferente dos cards falha alto", () => {
    expect(() => describeUnnamedCards(cards, ["a"])).toThrow(/tamanho/);
  });
});

test.describe("insurer-registry | tela x resposta do BFF, card a card", () => {
  test("acusa o índice em que o texto do card não traz o nome enviado", () => {
    const result = screenMismatches(
      [card("5", "5200", "SOMPO SEGUROS"), card("9", "9500", "TOO SEGUROS")],
      ["SOMPO SEGUROS\n200-SOMPO SEGUROS", "MAPFRE\nMAPFRE SEGUROS"],
    );
    expect(result).toEqual([
      { index: 1, esperado: "TOO SEGUROS", tela: "MAPFRE MAPFRE SEGUROS" },
    ]);
  });

  test("a apólice (plano) também é conferida: pega troca de ordem entre apólices da mesma seguradora", () => {
    const cards = [
      card("9", "9400", "TOO SEGUROS", "400-TOO A"),
      card("9", "9500", "TOO SEGUROS", "500-TOO B"),
    ];
    const swapped = ["TOO SEGUROS 500-TOO B", "TOO SEGUROS 400-TOO A"];
    expect(screenMismatches(cards, swapped)).toEqual([
      { index: 0, esperado: "400-TOO A", tela: "TOO SEGUROS 500-TOO B" },
      { index: 1, esperado: "500-TOO B", tela: "TOO SEGUROS 400-TOO A" },
    ]);
    expect(screenMismatches(cards, ["TOO SEGUROS 400-TOO A", "TOO SEGUROS 500-TOO B"])).toEqual([]);
  });

  test("ignora maiúsculas e espaços repetidos; não cobra nome que o BFF não enviou", () => {
    expect(
      screenMismatches(
        [card("5", "5200", "sompo   seguros"), card("9", "9500", "")],
        ["SOMPO SEGUROS 200", "qualquer coisa"],
      ),
    ).toEqual([]);
  });

  test("quantidade diferente falha alto", () => {
    expect(() => screenMismatches([card("5", "5200")], [])).toThrow(/quantidade/);
  });
});
