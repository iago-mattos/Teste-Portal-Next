import { expect, test } from "@playwright/test";
import { PortalSimulatorPage } from "../pages/portal/portal-simulator.page";

/**
 * `insurerAccessibleNames` e `insurerCardTexts` sobre HTML estático (sem rede, sem
 * portal), com a mesma forma que o Simulador renderiza: um span role=radio por card
 * (aria-labelledby = seg-<código>-label) e um input nativo escondido (aria-hidden).
 */
const card = (code: string, name: string, plan: string, labelled: boolean) => `
  <div class="card" data-code="${code}">
    <span role="radio" aria-checked="false" tabindex="0"${labelled ? ` aria-labelledby="seg-${code}-label"` : ' aria-labelledby=""'}></span>
    <input type="radio" aria-hidden="true" tabindex="-1" id="seg-${code}" style="position:fixed;width:1px;height:1px;clip-path:inset(50%)">
    <div id="seg-${code}-label"><p>${name}</p><p>${plan}</p></div>
    <p>Valor da 1ª parcela R$ ${code}00,00</p>
  </div>`;

const page = (cards: string) => `
  <main>
    <h1>Escolha sua seguradora</h1>
    <p>TEXTO FORA DO GRUPO: Resolucao 3.811</p>
    <div role="radiogroup" aria-label="Seguradoras disponiveis">${cards}</div>
    <p>RODAPE FORA DO GRUPO</p>
  </main>`;

test.describe("insurer-card-dom | texto e nome acessível por card", () => {
  test("com UM card só, o texto é do card e não da página inteira", async ({ page: browserPage }) => {
    await browserPage.setContent(page(card("5", "SOMPO SEGUROS", "200-SOMPO SEGUROS", true)));
    const simulator = new PortalSimulatorPage(browserPage);
    const texts = await simulator.insurerCardTexts();
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("SOMPO SEGUROS");
    expect(texts[0]).not.toContain("FORA DO GRUPO");
    expect(texts[0]).not.toContain("Escolha sua seguradora");
  });

  test("com vários cards, cada texto é só do seu card", async ({ page: browserPage }) => {
    await browserPage.setContent(
      page(
        card("5", "SOMPO SEGUROS", "200-SOMPO SEGUROS", true) +
          card("9", "TOO SEGUROS", "500-TOO SEGUROS_NV", true),
      ),
    );
    const simulator = new PortalSimulatorPage(browserPage);
    const texts = await simulator.insurerCardTexts();
    expect(texts).toHaveLength(2);
    expect(texts[0]).toContain("SOMPO SEGUROS");
    expect(texts[0]).not.toContain("TOO SEGUROS");
    expect(texts[1]).toContain("500-TOO SEGUROS_NV");
    expect(texts[1]).not.toContain("SOMPO");
  });

  test("o input nativo escondido (aria-hidden) não conta como card nem como nome", async ({
    page: browserPage,
  }) => {
    await browserPage.setContent(
      page(card("5", "SOMPO SEGUROS", "200-SOMPO", true) + card("9", "TOO", "500-TOO", true)),
    );
    const simulator = new PortalSimulatorPage(browserPage);
    const names = await simulator.insurerAccessibleNames();
    expect(names).toHaveLength(2); // 2 cards, não 4 radios
    expect(names[0]).toContain("SOMPO SEGUROS");
  });

  test("card com aria-labelledby vazio fica sem nome acessível, mesmo com o nome visível", async ({
    page: browserPage,
  }) => {
    await browserPage.setContent(
      page(card("9", "TOO SEGUROS", "500-TOO", true) + card("9", "TOO SEGUROS", "500-TOO", false)),
    );
    const simulator = new PortalSimulatorPage(browserPage);
    const names = await simulator.insurerAccessibleNames();
    const texts = await simulator.insurerCardTexts();
    expect(names[0]).toContain("TOO SEGUROS");
    expect(names[1]).toBe("");
    expect(texts[1]).toContain("TOO SEGUROS"); // o texto aparece, o nome acessível não
  });

  test("o nome vindo de aria-label também é lido como nome acessível (sem falso-vermelho)", async ({
    page: browserPage,
  }) => {
    await browserPage.setContent(
      page(
        `<div class="card"><span role="radio" aria-checked="false" aria-label="MAPFRE plano 1"></span><p>MAPFRE</p></div>`,
      ),
    );
    const simulator = new PortalSimulatorPage(browserPage);
    expect(await simulator.insurerAccessibleNames()).toEqual(["MAPFRE plano 1"]);
  });
});
