import type { Page } from "@playwright/test";
import { aejsTest as test, expect } from "../../fixtures/aejs/aejs.fixture";
import { assertMutationOptIn } from "../../helpers/mutation-gate";
import { assertEsteiraHtProvisioningTarget } from "../../config/esteira-ht-provisioning-target";
import { AejsOperationsPage } from "../../pages/aejs/aejs-operations.page";
import { PortalSimulatorPage } from "../../pages/portal/portal-simulator.page";
import {
  markQaRunAttempt,
  markQaRunRejected,
  markQaRunSubmitted,
  markQaRunValidated,
  reserveQaRun,
} from "../../services/simulator-qa-runs";
import {
  getDigitalMortgageSimulation,
  SIMULATOR_INITIAL_PROCESS_STATE,
} from "../../test-data/simulator-data";
import { SIMULATOR_PROPOSAL_SCENARIOS } from "../../test-data/simulator-proposal-scenarios";
import { scciJourney } from "../../test-data/scci-reference";
import { OBSERVED_SIMULATOR_JOURNEYS } from "../../test-data/simulator-journeys";

/**
 * Criação REAL de propostas pelo Simulador (esteira-ht) e verificação no SCCI.
 * Mutável: exige ALLOW_TEST_MUTATION=true passado no comando e PW_PROFILE=esteira-ht.
 * Uma proposta por cenário (registro em .playwright/simulator-qa-runs); com
 * protocolo já registrado a criação é pulada e só a verificação é repetida.
 * Escolha o cenário com --grep <id do cenário>.
 */
function formatCurrencyFromCents(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) / 100);
}

const SCCI_MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

/** DDMMAAAA → "DD/Mmm/AAAA", formato de data do SCCI. */
function formatScciDate(digits: string): string {
  const month = SCCI_MONTHS[Number(digits.slice(2, 4)) - 1];
  if (!month || digits.length !== 8) throw new Error(`Data inválida: ${digits}.`);
  return `${digits.slice(0, 2)}/${month}/${digits.slice(4, 8)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface ExtField {
  isVisible(deep: boolean): boolean;
  getFieldLabel?(): string;
  getValue?(): unknown;
  getRawValue?(): unknown;
}

interface ScciFieldReading {
  /** Valor interno (em listas, o código; ex.: "220"). */
  readonly value: string;
  /** Texto exibido na tela (ex.: "Nova Operação", "1.600.000,00"). */
  readonly text: string;
}

/**
 * Rótulo → leitura dos campos visíveis da tela atual do SCCI (somente leitura).
 * O SCCI informa os rótulos sem os dois-pontos finais.
 */
async function readVisibleFields(
  page: Page,
): Promise<Record<string, ScciFieldReading>> {
  return page.evaluate(() => {
    const ext = (
      window as unknown as {
        Ext: { ComponentQuery: { query(selector: string): ExtField[] } };
      }
    ).Ext;
    const fields: Record<string, { value: string; text: string }> = {};
    for (const field of ext.ComponentQuery.query("field")) {
      if (!field.isVisible(true)) continue;
      const label = field.getFieldLabel?.()?.replace(/:\s*$/, "").trim();
      if (!label) continue;
      fields[label] = {
        value: String(field.getValue?.() ?? "").trim(),
        text: String(field.getRawValue?.() ?? "").trim(),
      };
    }
    return fields;
  });
}

for (const scenario of SIMULATOR_PROPOSAL_SCENARIOS) {
  test(
    `Simulador → SCCI | cria e verifica a proposta ${scenario.id}`,
    {
      tag: [
        "@integration",
        "@mutation",
        ...(scenario.investigation ? ["@investigacao"] : []),
      ],
    },
    async ({ page, openAuthenticatedAejsPage }, testInfo) => {
      test.setTimeout(15 * 60_000);
      test.skip(
        process.env.PW_PROFILE !== "esteira-ht",
        "Criação de propostas exclusiva do perfil esteira-ht.",
      );
      assertMutationOptIn();
      assertEsteiraHtProvisioningTarget();

      const journey = OBSERVED_SIMULATOR_JOURNEYS.find(
        (item) => item.id === scenario.journeyId,
      );
      if (!journey) throw new Error(`Jornada inexistente: ${scenario.journeyId}.`);
      const reference = scciJourney(journey.id);
      const corporate = journey.selection.borrowerType === "Pessoa Jurídica";
      const seed = getDigitalMortgageSimulation().applicantSeed;
      const run = await reserveQaRun(
        scenario.id,
        seed,
        corporate ? "CNPJ" : "CPF",
      );
      let protocol = run.protocol;
      let investigationRefusal: string | undefined;
      const effectiveTerm = scenario.customTermMonths ?? scenario.financial.termMonths;

      await test.step("cria a proposta pelo Simulador", async () => {
        if (protocol) return; // já criada: só verifica
        const simulator = new PortalSimulatorPage(page);
        let attempted = false;
        try {
          await simulator.open();
          await simulator.startNewSimulation();
          await simulator.chooseJourney(journey.selection);
          await simulator.fillSimulationData(scenario.financial, journey.dataScreen, {
            requireGracePeriod: scenario.requireGracePeriod === true,
          });
          if (scenario.customTermMonths !== undefined) {
            await simulator.customTermInput.fill(String(scenario.customTermMonths));
          }
          await simulator.continueToInsurers();
          await simulator.selectInsurer(scenario.insurer);
          await simulator.continueToResult();
          await simulator.continueToApplicantData();
          if (corporate) {
            await simulator.fillCorporateApplicantData({
              cnpjDigits: run.applicant.cpfDigits,
              companyName: run.applicant.name,
              email: run.applicant.email,
              phoneDigits: run.applicant.mobileDigits,
            });
          } else {
            await simulator.fillApplicantData(run.applicant);
          }

          // Registra os campos enviados no envio da proposta (só nomes e tipos; sem valores pessoais).
          const submitted: Array<{ path: string; fields: Record<string, string> }> = [];
          const listener = (request: import("@playwright/test").Request): void => {
            if (request.method() !== "POST") return;
            const path = new URL(request.url()).pathname;
            if (/\/api\/simulacao\/(tipo-operacao|evolucao|planilha)$/.test(path)) return;
            let fields: Record<string, string> = {};
            try {
              const json = request.postDataJSON() as Record<string, unknown>;
              fields = Object.fromEntries(
                Object.entries(json).map(([key, value]) => [
                  key,
                  value === null || value === undefined || value === ""
                    ? "vazio"
                    : typeof value === "string"
                      ? `texto(${value.length})`
                      : typeof value,
                ]),
              );
            } catch {
              fields = { corpo: "não-JSON" };
            }
            submitted.push({ path, fields });
          };
          const responses: Array<{ path: string; status: number; bodyLength: number; rawDatabaseError: boolean }> = [];
          const responseListener = async (
            response: import("@playwright/test").Response,
          ): Promise<void> => {
            const request = response.request();
            if (request.method() !== "POST") return;
            const path = new URL(response.url()).pathname;
            if (/\/api\/simulacao\/(tipo-operacao|evolucao|planilha)$/.test(path)) return;
            const body = await response.text().catch(() => "");
            responses.push({
              path,
              status: response.status(),
              bodyLength: body.length,
              rawDatabaseError: /ORA-\d+|TOracleConnection/.test(body),
            });
          };
          page.on("request", listener);
          page.on("response", responseListener);

          // A partir daqui o retorno pode ser incerto: nunca repetir sem conferir.
          await markQaRunAttempt(run.id);
          attempted = true;
          try {
            protocol = await simulator.submitProposal();
          } catch (error) {
            // Só cenários de investigação tratam a recusa como resultado a registrar.
            if (
              scenario.investigation &&
              error instanceof Error &&
              error.message.startsWith("O Portal recusou o envio da proposta")
            ) {
              investigationRefusal = error.message;
            } else {
              throw error;
            }
          } finally {
            page.off("request", listener);
            page.off("response", responseListener);
            await testInfo.attach("envio-da-proposta-campos", {
              body: JSON.stringify(
                {
                  requisicoes: submitted,
                  respostas: responses,
                  camposDeTelefone: submitted.flatMap((item) =>
                    Object.entries(item.fields)
                      .filter(([key]) => /tel|fone|cel|phone|mobile/i.test(key))
                      .map(([key, value]) => `${item.path} :: ${key} = ${value}`),
                  ),
                },
                null,
                2,
              ),
              contentType: "application/json",
            });
          }
          if (investigationRefusal) {
            await markQaRunRejected(run.id, investigationRefusal);
            return;
          }
          if (!protocol) throw new Error("O envio terminou sem protocolo.");
          await markQaRunSubmitted(run.id, protocol);
        } catch (error) {
          if (!attempted) {
            await markQaRunRejected(
              run.id,
              error instanceof Error ? error.message : String(error),
            );
          }
          throw error;
        }
      });

      if (investigationRefusal) {
        testInfo.annotations.push({
          type: "investigacao",
          description: `${scenario.id}: envio recusado pelo Portal (${investigationRefusal}). ${scenario.investigation}`,
        });
        return;
      }
      if (!protocol) throw new Error("Proposta sem protocolo para verificar no SCCI.");
      const createdProtocol = protocol;
      await testInfo.attach("proposta-criada", {
        body: JSON.stringify(
          { scenario: scenario.id, protocol: createdProtocol, journey: journey.id },
          null,
          2,
        ),
        contentType: "application/json",
      });

      const aejsPage = await openAuthenticatedAejsPage();
      const operations = new AejsOperationsPage(aejsPage);

      await test.step("abre a operação e confere número, prazo, fase e tipo de operação", async () => {
        await operations.navigateToOperations();
        await operations.openOperationEventually(createdProtocol);
        await expect(operations.openedOperationNumber).toHaveValue(createdProtocol);
        if (scenario.investigation) {
          testInfo.annotations.push({
            type: "investigacao",
            description: `${scenario.id}: prazo digitado ${effectiveTerm}; prazo gravado no SCCI ${await operations.openedTerm.inputValue()}. ${scenario.investigation}`,
          });
        } else {
          await expect(operations.openedTerm).toHaveValue(String(effectiveTerm));
        }
        await expect(operations.openedCurrentPhase).toHaveValue(
          SIMULATOR_INITIAL_PROCESS_STATE.phase,
        );

        // Título da operação: "<nome> - <tipo de operação>".
        const header = aejsPage
          .getByText(new RegExp(`^${escapeRegExp(run.applicant.name)} - `))
          .first();
        await expect(header).toBeVisible();
        const headerText = (await header.innerText()).trim();
        await testInfo.attach("tipo-de-operacao-no-scci", {
          body: headerText,
          contentType: "text/plain",
        });

        const allowed = reference.operationTypes.map(
          (type) => `${run.applicant.name} - ${type.description}`,
        );
        expect(
          allowed,
          "O tipo de operação do SCCI deve ser um dos tipos cadastrados para a jornada.",
        ).toContain(headerText);

        // O SCCI não deve ter operação com prazo abaixo do mínimo do tipo cadastrado.
        const savedType = reference.operationTypes.find(
          (type) => headerText === `${run.applicant.name} - ${type.description}`,
        );
        if (savedType && !scenario.investigation) {
          expect
            .soft(
              effectiveTerm,
              `Prazo gravado no SCCI (${effectiveTerm}) abaixo do mínimo do tipo ${savedType.code} (${savedType.minTermMonths} meses).`,
            )
            .toBeGreaterThanOrEqual(savedType.minTermMonths);
        }

        if (scenario.expectedOperationTypeCode) {
          const expectedType = reference.operationTypes.find(
            (type) => type.code === scenario.expectedOperationTypeCode,
          );
          if (!expectedType) {
            throw new Error(
              `Tipo ${scenario.expectedOperationTypeCode} não pertence à jornada.`,
            );
          }
          expect(
            headerText,
            `Tipo esperado ${expectedType.code} (${expectedType.description}) conforme o teto de valor do cadastro.`,
          ).toBe(`${run.applicant.name} - ${expectedType.description}`);
        }
      });

      await test.step("confere os dados do proponente no cadastro do pretendente", async () => {
        await operations.openPrimaryApplicant(run.applicant.name);
        await expect(operations.getVisibleField("PESSOA$NO_PESSOA")).toHaveValue(
          run.applicant.name,
        );
        expect(
          (await operations.getVisibleField("PESSOA$NU_CPFCNPJ").inputValue()).replace(
            /\D/g,
            "",
          ),
          corporate ? "CNPJ do proponente" : "CPF do proponente",
        ).toBe(run.applicant.cpfDigits);

        if (!corporate) {
          await expect(operations.getVisibleField("PESSOA$DT_NASCIMENTO")).toHaveValue(
            formatScciDate(scenario.financial.birthDateDigits),
          );
        }

        if (corporate) {
          // PJ: o cadastro não tem a aba "Dados de Contato". O e-mail aparece no
          // cabeçalho da operação e o telefone deveria estar em alguma aba do pretendente.
          await expect(operations.getVisibleField("TITULAR$NO_EMAIL")).toHaveValue(
            run.applicant.email.toLowerCase(),
          );
          const phoneTail = run.applicant.mobileDigits.slice(-8);
          const tabs = [
            "Identificação Pessoa Jurídica",
            "Sócios/Representantes",
            "Outras Informações",
          ];
          let phoneFoundIn: string | undefined;
          for (const tab of tabs) {
            await operations.selectVisibleTab(tab);
            const values = await aejsPage.evaluate(() =>
              [...document.querySelectorAll("input, textarea, .x-grid-cell-inner")]
                .filter((element) => (element as HTMLElement).offsetParent)
                .map((element) =>
                  element instanceof HTMLInputElement ||
                  element instanceof HTMLTextAreaElement
                    ? element.value
                    : (element.textContent ?? ""),
                ),
            );
            if (values.some((value) => value.replace(/\D/g, "").includes(phoneTail))) {
              phoneFoundIn = tab;
              break;
            }
          }
          // INVESTIGAÇÃO: Produto ainda não disse onde o SCCI grava o telefone da PJ
          // (pode estar em tela/grade não varrida aqui). O resultado é registrado, não
          // afirmado: afirmar "defeito" seria falso-vermelho se o dado estiver em outra tela.
          testInfo.annotations.push({
            type: "investigacao",
            description: phoneFoundIn
              ? `Telefone da PJ (final ${phoneTail}) encontrado na aba "${phoneFoundIn}".`
              : `Telefone da PJ (final ${phoneTail}) NÃO encontrado nas abas varridas (${tabs.join(", ")}); local de gravação a confirmar com Produto.`,
          });
        } else {
          await operations.selectVisibleTab("Dados de Contato");
          // Registra os campos de contato visíveis (nome → valor) para diagnóstico.
          const contactInputs = await aejsPage
            .locator("input[name]:visible")
            .evaluateAll((inputs) =>
              inputs.map((input) => ({
                name: input.getAttribute("name") ?? "",
                value: (input as HTMLInputElement).value,
              })),
            );
          await testInfo.attach("scci-contato-do-proponente", {
            body: JSON.stringify(contactInputs, null, 2),
            contentType: "application/json",
          });

          await expect(operations.getVisibleField("PESSOA$NO_EMAIL")).toHaveValue(
            run.applicant.email.toLowerCase(),
          );
          await expect(operations.getVisibleField("PESSOA$NU_DDD_CEL")).toHaveValue(
            run.applicant.mobileDigits.slice(0, 2),
          );
          expect(
            (await operations.getVisibleField("PESSOA$NU_CELULAR").inputValue()).replace(
              /\D/g,
              "",
            ),
            "Celular do proponente",
          ).toBe(run.applicant.mobileDigits.slice(2));
        }
        await operations.closeCurrentWindow();
      });

      await test.step("confere os dados da simulação refletidos no SCCI", async () => {
        await operations.openSimulation();
        const fields = await readVisibleFields(aejsPage);
        await testInfo.attach("scci-simulacao", {
          body: JSON.stringify(fields, null, 2),
          contentType: "application/json",
        });

        const selection = journey.selection;
        // O SCCI rotula o tipo do imóvel como "Tipo do imóvel" (PF), "Tipo de imóvel" (PJ)
        // ou apenas "Imóvel" (Crédito Garantia).
        const propertyTypeLabel =
          ["Tipo do imóvel", "Tipo de imóvel", "Imóvel"].find(
            (label) => fields[label] !== undefined,
          ) ?? "Tipo do imóvel";
        const expectedText: ReadonlyArray<readonly [string, string | undefined]> = [
          ["Produto", selection.modality],
          ["Comprador", selection.borrowerType],
          [propertyTypeLabel, selection.propertyType],
          ["Origem do Imóvel", selection.propertyOrigin],
          ["Índice de correção", selection.indexer],
          [
            "Valor de compra e venda",
            formatCurrencyFromCents(scenario.financial.propertyValueCents),
          ],
          [
            "Valor estimado/avaliação do imóvel",
            formatCurrencyFromCents(scenario.financial.propertyValueCents),
          ],
          [
            "Valor financiamento imobiliário",
            formatCurrencyFromCents(scenario.financial.financingValueCents),
          ],
        ];
        const missing: string[] = [];
        for (const [label, value] of expectedText) {
          if (value === undefined) continue;
          const actual = fields[label];
          if (actual === undefined) {
            missing.push(label);
            continue;
          }
          expect.soft(actual.text, `Campo ${label} (texto exibido)`).toBe(value);
        }

        // A seguradora escolhida vira o campo "Seguradora do financiamento"; o SCCI
        // guarda o código do cadastro (ex.: 4 = MAPFRE), obtido no snapshot de referência.
        const insurerCodes = new Set(
          reference.operationTypes
            .flatMap((type) => type.insurers)
            .filter((insurer) => insurer.name.startsWith(scenario.insurer))
            .map((insurer) => insurer.code),
        );
        const insurerField = fields["Seguradora do financiamento"];
        if (insurerField) {
          expect
            .soft(
              [...insurerCodes],
              `Seguradora ${scenario.insurer} deve existir no cadastro da jornada.`,
            )
            .toContain(insurerField.value);
        } else {
          missing.push("Seguradora do financiamento");
        }

        // O código do grupo-folha da jornada aparece no último nível escolhido:
        // "Índice de correção" (quando há indexador) ou "Origem do Imóvel" (PJ).
        const leafLabel =
          selection.indexer !== undefined
            ? "Índice de correção"
            : selection.propertyOrigin !== undefined
              ? "Origem do Imóvel"
              : propertyTypeLabel; // Crédito Garantia: o grupo-folha é o próprio "Imóvel"
        if (fields[leafLabel]) {
          expect
            .soft(
              fields[leafLabel].value,
              `Código do grupo-folha da jornada em "${leafLabel}"`,
            )
            .toBe(reference.groupCode);
        } else {
          missing.push(leafLabel);
        }

        // Sistema de amortização: SAC = 2 e Price = 1 (admin: opções SAC:2 | Tabela Price:1).
        const expectedSystem =
          scenario.financial.amortizationSystem === "TP - Tabela Price" ? "1" : "2";
        const system = fields["Sistema amortização"];
        if (system) {
          expect
            .soft(system.value, "Sistema de amortização (código)")
            .toBe(expectedSystem);
        } else {
          missing.push("Sistema amortização");
        }

        // Rótulo esperado ausente = conferência NÃO feita: reprova, em vez de passar em silêncio.
        expect
          .soft(
            missing,
            `Rótulos esperados ausentes na tela da simulação do SCCI (conferência não realizada): ${missing.join(" | ")}`,
          )
          .toEqual([]);
      });

      await test.step("confere o andamento do processo (tarefas 010 e 020)", async () => {
        await operations.openProcessProgress();
        for (const task of SIMULATOR_INITIAL_PROCESS_STATE.tasks) {
          const row = operations.getProcessTaskRow(task.code);
          await expect(row).toHaveCount(1);
          await expect(
            row.getByRole("gridcell", { name: task.title, exact: true }),
          ).toBeVisible();
          await expect(
            row.getByRole("gridcell", { name: task.status, exact: true }),
          ).toBeVisible();
        }
        await expect(
          operations.processProgressGrid.getByRole("row"),
        ).toHaveCount(SIMULATOR_INITIAL_PROCESS_STATE.tasks.length + 1);
      });

      await markQaRunValidated(run.id);
    },
  );
}
