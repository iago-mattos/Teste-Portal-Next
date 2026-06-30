import {
  registerClientCases,
  type ClientCase,
} from "../../support/client-cases";
import { portalConnect } from "../../config/active-connect";

const cases = [
  {
    id: "PROP-01",
    rule: "Deverá vir do lead as informações: Nº da proposta, Data de cadastro, Endereço do imóvel, Valor do imóvel, Valor do empréstimo, prazo solicitado",
    sourceStatus: "NOK",
    sourceObservation: 'Apenas campo "Data de Cadastro" está divergente',
  },
  {
    id: "PROP-02",
    rule: "As informações Endereço do imóvel, Valor do imóvel, Valor do empréstimo, prazo solicitado não sofrem alteração em fase de perfilamento pelo cliente por isso ficam sempre iguais. Caso haja alteração na plataforma da prognum nesse momento aí sim reflete no portal.",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PROP-03",
    rule: "As informações Endereço do imóvel, Valor do imóvel, Valor do empréstimo, prazo solicitado quando alteradas em outras fases na plataforma prognum, refletirão no portal",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-04",
    rule: "Deverá aparecer em “Etapa” o De/Para do status da fase parametrizado pelo C6 na “Nome da fase na WEB” na tabela de fases de operação",
    sourceStatus: "Em andamento",
    sourceObservation: "Alteração de Etapa para Fase Atual",
  },
  {
    id: "PROP-05",
    rule: "O preenchimento será dividido em duas tarefas “Preenchimento Cadastral” e “Preenchimento de Documentos”, onde a fase de preenchimento de documentos depende do término de preenchimento de cadastro",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-06",
    rule: "Tanto a tarefa de Preenchimento cadastral quando a de preenchimento terão prazos parametrizáveis pelo C6",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-07",
    rule: "Deverá aparecer em “Etapa” “proposta expirada” de forma automática quando atingir parametrizado em uma das tarefas sem atuação do cliente.",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-08",
    rule: "Deverá ser informado para o cliente a mensagem “Verifique seu e-mail ou entre em contato com o consultor”, propostas negadas pela mesa de crédito",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-09",
    rule: "Deverá ser informado para o cliente a mensagem “Verifique seu e-mail ou entre em contato com o consultor”, propostas com status a partir da Análise de Crédito.",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-10",
    rule: "Simulações canceladas acimas de 30 dias não veremos no resumo",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-11",
    rule: "Simulações canceladas até e igual 30 dias deverão constar em tela",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-12",
    rule: "Simulações canceladas na Prognum, também precisam estar canceladas no portal, tem que refletir exatamente o que está na Prognum em relação a proposta",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-13",
    rule: "Prazo remanescente deverá ser atualizado conforme os dias passarem até restar 0 dias",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-14",
    rule: "Prazo deverá correr contabilizando dias úteis.",
    sourceStatus: "NOK",
    sourceObservation: "46130",
  },
  {
    id: "PROP-15",
    rule: "Data fim de preenchimento deverá se mater a mesma desde o início",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PROP-17",
    rule: "Propostas que tiveram o cadastro finalizado irão para crédito e exibir um modal que ele concluiu a etapa e irá aguardar contato por e-mail ou whatsapp.",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "PROP-18",
    rule: "Na proposta em tela, quando o cliente tiver mais eu duas propostas ao passar o mouse o cliente será direcionado para jornada solicitada no momento (ex: completar dados cadatrais, anexar documentos, pendencias...) para proposta desejada",
    sourceStatus: "Necessário massa",
    sourceObservation: null,
  },
  {
    id: "PROP-19",
    rule: "Data de vencimento, fica na proposta, sem necessidade de mensagem informativa em tela nesse momento, para não distrair o cliente.",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "PROP-16",
    rule: "O botão refazer simulação deverá ser chamado “Fazer simulação com outro imóvel” e direcionar para página https://c6imobiliario.com.br",
    sourceStatus: "OK",
    sourceObservation: null,
  },
] as const satisfies readonly ClientCase[];

function proposalCard(): Cypress.Chainable<JQuery<HTMLElement>> {
  const number = portalConnect.testData.expectedProposal.visibleNumber;
  return cy.contains("article", `Proposta #${number}`, { timeout: 30_000 });
}

function parseBrDate(value: string): Date {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function businessDaysUntil(deadline: Date): number {
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let total = 0;

  while (cursor < deadline) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += 1;
  }

  return total;
}

beforeEach(() => {
  cy.openProposalList();
  cy.wait(2_000);
});

afterEach(() => {
  cy.wait(3_000);
});

const implementations = {
  "PROP-01": () => {
    const expected = portalConnect.testData.expectedProposal;
    proposalCard()
      .invoke("text")
      .then((text) => {
        const normalized = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ");

        expect(normalized).to.contain(`Proposta #${expected.visibleNumber}`);
        expect(normalized).to.contain(
          `Data de cadastro: ${expected.registrationDate}`,
        );
        expect(normalized).to.contain(expected.propertyValue);
        expect(normalized).to.contain(expected.financedValue);
        expect(normalized).to.contain(expected.term);
      });

    cy.openDefaultProposal();
    cy.contains('[role="tab"]', "Imóvel").click();
    cy.getByName("IMOVEL_OPERACAO.NO_ENDERECO")
      .should("be.visible")
      .invoke("val")
      .should("not.be.empty");
    cy.wait(2_000);
  },
  "PROP-02": () => {
    cy.openDefaultProposal();

    cy.contains('[role="tab"]', "Motivo da Contratação").click();
    cy.contains("label", "Valor solicitado do Crédito").should("not.exist");
    cy.contains("label", "Prazo estimado").should("not.exist");
    cy.contains("label", "Tipo de Juros").should("not.exist");

    cy.contains('[role="tab"]', "Imóvel").click();
    cy.getByName("OPERACAO_CREDITO.VA_PRECO_IMOVEL").should("be.disabled");
    cy.getByName("IMOVEL_OPERACAO.NO_ENDERECO").should("be.disabled");
  },
  "PROP-04": () => {
    proposalCard()
      .should("contain.text", "Fase Atual")
      .and(
        "contain.text",
        portalConnect.testData.expectedProposal.currentPhase,
      );
  },
  "PROP-05": () => {
    const proposalIds = portalConnect.caseProposalIds;
    const openJourney = (proposalNumber: string, heading: string) => {
      cy.contains("article", `Proposta #${proposalNumber}`).within(() => {
        cy.contains(
          "button",
          /Completar cadastro|Acompanhar proposta|Enviar documentos/i,
        ).click();
      });
      cy.contains("h2", heading, { timeout: 30_000 }).should("be.visible");
    };

    openJourney(proposalIds.TIMELINE_04_CADASTRO, "Cadastro da Proposta");
    cy.openProposalList();
    openJourney(proposalIds.TIMELINE_04_DOCUMENTOS, "Documentos da proposta");
  },
  "PROP-06": () => {
    cy.get("article")
      .should("have.length.at.least", 2)
      .then(($cards) => {
        const deadlines = [...$cards]
          .map(
            (card) =>
              card.textContent?.match(
                /Data limite para preenchimento do cadastro:\s*(\d{2}\/\d{2}\/\d{4})/i,
              )?.[1],
          )
          .filter((deadline): deadline is string => Boolean(deadline));

        expect(
          deadlines,
          "datas-limite exibidas nas propostas",
        ).to.have.length.at.least(2);
        expect(
          new Set(deadlines).size,
          "prazos parametrizados distintos",
        ).to.be.greaterThan(1);
      });
  },
  "PROP-07": () => {
    cy.contains("article", /Expirad[ao]/i, { timeout: 30_000 })
      .should("be.visible")
      .and("contain.text", "Expirad");
  },
  "PROP-08": () => {
    cy.contains("article", /Crédito Reprovado/i, { timeout: 30_000 })
      .should("be.visible")
      .within(() => {
        cy.contains(
          /Verifique seu e-mail ou entre em contato com o consultor/i,
        ).should("be.visible");
        cy.contains("button", /Completar cadastro/i).should("not.exist");
      });
  },
  "PROP-09": () => {
    cy.contains("article", /Fase Atual\s*(Crédito|Negociação|Análise)/i, {
      timeout: 30_000,
    }).should("be.visible");
    cy.contains(/Verifique seu e-mail ou entre em contato com o consultor/i, {
      timeout: 30_000,
    }).should("be.visible");
  },
  "PROP-10": () => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 30);

    cy.get("article").then(($cards) => {
      const cancelledCards = [...$cards].filter((card) =>
        /Fase Atual\s*Cancelada/i.test(card.textContent ?? ""),
      );

      for (const card of cancelledCards) {
        const registrationDate = (card.textContent ?? "").match(
          /Data de cadastro:\s*(\d{2}\/\d{2}\/\d{4})/i,
        )?.[1];
        expect(registrationDate, "data da operacao cancelada").to.be.a(
          "string",
        );
        expect(
          parseBrDate(registrationDate as string).getTime(),
          "operacao cancelada exibida tem no maximo 30 dias",
        ).to.be.at.least(cutoff.getTime());
      }
    });
  },
  "PROP-11": () => {
    cy.get("article")
      .should("have.length.at.least", 1)
      .first()
      .within(() => {
        cy.contains(
          "button",
          /Acompanhar proposta|Completar cadastro/i,
        ).click();
      });
    cy.location("pathname", { timeout: 30_000 }).should(
      "match",
      /^\/propostas\/[^/]+$/,
    );
    cy.get("body").should("be.visible");
  },
  "PROP-12": () => {
    cy.contains("article", /Cancelad[ao]/i, { timeout: 30_000 })
      .should("be.visible")
      .within(() => {
        cy.contains(/Cancelad[ao]/i).should("be.visible");
        cy.contains("button", /Completar cadastro/i).should("not.exist");
      });
  },
  "PROP-17": () => {
    cy.contains("article", /Fase Atual\s*Crédito/i, { timeout: 30_000 })
      .should("be.visible")
      .within(() => {
        cy.contains(/Crédito/i).should("be.visible");
        cy.contains("button", /Completar cadastro/i).should("not.exist");
      });
  },
  "PROP-18": () => {
    const openedJourneys: string[] = [];

    cy.get("article")
      .should("have.length.at.least", 2)
      .then(($cards) => {
        const proposalNumbers = [...$cards]
          .filter((card) =>
            /Completar cadastro|Acompanhar proposta|Enviar documentos|Ver pendências/i.test(
              card.textContent ?? "",
            ),
          )
          .map((card) => card.textContent?.match(/Proposta\s*#(\d+)/i)?.[1])
          .filter((number): number is string => Boolean(number));

        expect(
          new Set(proposalNumbers).size,
          "propostas distintas",
        ).to.be.greaterThan(1);

        const proposalsToValidate = proposalNumbers.slice(0, 2);
        for (const [index, proposalNumber] of proposalsToValidate.entries()) {
          if (index > 0) {
            cy.openProposalList();
            cy.wait(2_000);
          }

          cy.contains("article", `Proposta #${proposalNumber}`).within(() => {
            cy.contains(
              "button",
              /Completar cadastro|Acompanhar proposta|Enviar documentos|Ver pendências/i,
            ).click();
          });

          cy.wait(1_000);
          cy.location("pathname", { timeout: 30_000 }).then((pathname) => {
            if (/^\/propostas\/[^/]+$/.test(pathname)) {
              expect(pathname).to.contain(proposalNumber);
              openedJourneys.push(pathname);
              return;
            }

            cy.get('[role="dialog"]:visible', { timeout: 10_000 })
                .should("contain.text", "Proposta")
                .then(($dialog) => {
                  openedJourneys.push(
                    `dialog:${proposalNumber}:${$dialog.text().trim()}`,
                  );
                  cy.wrap($dialog)
                    .contains("button", /Entendido|Fechar/i)
                    .click();
                });
          });
          cy.wait(2_000);
        }
      });

    cy.then(() => {
      expect(openedJourneys, "jornadas abertas").to.have.length.at.least(2);
    });
  },
  "PROP-13": () => {
    proposalCard().within(() => {
      cy.contains(
        `Data limite para preenchimento do cadastro: ${portalConnect.testData.expectedProposal.deadline}`,
      ).should("be.visible");

      const deadline = parseBrDate(
        portalConnect.testData.expectedProposal.deadline,
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const remaining = Math.max(
        0,
        Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000),
      );
      const label =
        remaining === 0
          ? /Vence hoje|0 dias? restantes/i
          : new RegExp(`${remaining} dias? restantes`, "i");

      cy.contains(label).should("be.visible");
    });
  },
  "PROP-14": () => {
    const deadline = parseBrDate(
      portalConnect.testData.expectedProposal.deadline,
    );
    const businessDays = businessDaysUntil(deadline);
    proposalCard().within(() => {
      cy.contains(new RegExp(`${businessDays} dias? restantes`, "i")).should(
        "be.visible",
      );
    });
  },
  "PROP-15": () => {
    proposalCard().should(
      "contain.text",
      `Data limite para preenchimento do cadastro: ${portalConnect.testData.expectedProposal.deadline}`,
    );
  },
  "PROP-16": () => {
    cy.contains("button", "Fazer simulacao com outro imovel").should(
      "be.visible",
    );
    cy.contains("button", "Fazer simulacao com outro imovel").click({
      force: true,
    });
    cy.location("origin", { timeout: 15_000 }).should(
      "equal",
      portalConnect.externalSimulationUrl,
    );
    cy.wait(3_000);
    cy.visit(`${portalConnect.portalUrl}${portalConnect.paths.propostas}`);
    cy.contains("h1", "Minhas propostas", { timeout: 30_000 }).should(
      "be.visible",
    );
  },
  "PROP-19": () => {
    proposalCard().within(() => {
      cy.contains(
        `Data limite para preenchimento do cadastro: ${portalConnect.testData.expectedProposal.deadline}`,
      ).should("be.visible");
    });
    cy.get('[role="dialog"]').should("not.exist");
  },
};

registerClientCases("Minhas propostas", cases, implementations);
