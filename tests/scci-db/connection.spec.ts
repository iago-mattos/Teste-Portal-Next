import { scciDbTest as test, expect } from "../fixtures/scci-db.fixture";

/**
 * Verificação da ponte de leitura do banco do SCCI (ssh + sqlplus + Oracle).
 * Somente leitura. Rode com: npx playwright test --project=scci-db
 */
test.describe("banco do SCCI | conexão de leitura @readonly", () => {
  test("conecta e executa SELECT", async ({ scciDb }) => {
    expect(await scciDb.ping()).toBe(true);
  });

  test("lê a última simulação gravada pelo Simulador (só as chaves)", async ({ scciDb }) => {
    const latest = await scciDb.latestSimulationNumber();
    test.skip(latest === null, "SIMULACAO_ORIGINACAO vazia neste ambiente.");

    // A simulação mais recente pode ser de outra pessoa: o smoke compara só as
    // chaves (nuSimulacao/nuSessao), nunca CPF, nascimento ou renda. Há simulações
    // com mais de uma sessão: lê todas, pela chave completa.
    const keys = await scciDb.findSimulationSessionKeys(latest!);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key.nuSimulacao).toBe(latest);
      expect(key.nuSessao).toBeGreaterThan(0);
      expect((await scciDb.getSimulation(key))?.nuSessao).toBe(key.nuSessao);
    }
  });

  test("lê proposta ligada a simulação e os pretendentes (só chaves e contagem)", async ({
    scciDb,
  }) => {
    const proposal = await scciDb.latestLinkedProposalKeys();
    test.skip(!proposal, "Nenhuma proposta ligada a simulação neste ambiente.");

    const keys = await scciDb.findSimulationSessionKeys(proposal!.nuSimulacao!);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key) => key.nuSimulacao === proposal!.nuSimulacao)).toBe(true);

    // Só a contagem: a proposta mais recente do ambiente pode ser de outra pessoa,
    // então o smoke não lê nome, CPF, e-mail, telefone, renda nem valores.
    expect(proposal!.nuPretendente).not.toBeNull();
    expect(await scciDb.countApplicants(proposal!.nuPretendente!)).toBeGreaterThan(0);
  });
});
