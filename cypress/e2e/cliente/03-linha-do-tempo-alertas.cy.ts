import {
  registerClientCases,
  type ClientCase,
} from "../../support/client-cases";
import { portalConnect } from "../../config/active-connect";

interface ProposalSummary {
  numero: string;
  faseAtual: string;
  prazoCadastroLimite: string | null;
}

let proposalSummaries: ProposalSummary[] = [];

const cases = [
  {
    id: "TIMELINE-01",
    rule: "Deverá conter cabeçalho com nome do proponente e CPF do proponente",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "TIMELINE-02",
    rule: "Retirar a indicação de CNPJ, mantendo apenas CPF",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "TIMELINE-03",
    rule: "Linha do tempo deverá ser composta por: Simulação, Cadastro, Crédito, Negociação, Análise de Documentos, Análise Técnica, Formalização e Liberação.",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "TIMELINE-04",
    rule: "O cliente poderá chegar nessa tela através de todas as jornadas na tela anterior",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "TIMELINE-05",
    rule: "A linha do tempo do portal se comunicará com a linha do tempo existente na prognum",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "TIMELINE-06",
    rule: "Se proposta expirada tela disponível para visualização, mas edição inabilitada",
    sourceStatus: "Em andamento",
    sourceObservation: null,
  },
  {
    id: "TIMELINE-07",
    rule: "Trazer mensagem informativa da data fim para preenchimento do cadastro",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "TIMELINE-08",
    rule: "Exibir mensagem indicando obrigatoriedade de preenchimento",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "TIMELINE-09",
    rule: "Caso o cliente feche a mensagem de cadastro obrigatório não precisa apresentar novamente.",
    sourceStatus: "OK",
    sourceObservation: null,
  },
  {
    id: "TIMELINE-10",
    rule: "Quando mais de uma proposta em andamento, a data limite de cada proposta deverá ser mostrada ao cliente",
    sourceStatus: "Necessário massa",
    sourceObservation: null,
  },
  {
    id: "TIMELINE-11",
    rule: "Manter habilitado botão “Ver detalhes da operação” e mostrar evolução do preenchimento",
    sourceStatus: "Pedido alteração",
    sourceObservation: "Solicitar ocultar ",
  },
  {
    id: "TIMELINE-12",
    rule: "Retirar botão “Ver documentos”, pois só teremos no final após liberação cadastral.",
    sourceStatus: "OK",
    sourceObservation: null,
  },
] as const satisfies readonly ClientCase[];

beforeEach(function () {
  const caseId = this.currentTest?.title.match(/^TIMELINE-\d+/)?.[0];

  if (caseId === "TIMELINE-04" || caseId === "TIMELINE-10") {
    if (caseId === "TIMELINE-10") {
      proposalSummaries = [];
      cy.intercept("GET", "**/api/portal/propostas*", (request) => {
        request.continue((response) => {
          const body = response.body as { itens?: ProposalSummary[] };
          proposalSummaries.push(...(body.itens ?? []));
        });
      });
    }
    cy.openProposalList();
  } else if (caseId === "TIMELINE-05") {
    cy.openProposalList();
    cy.contains("article", /Fase Atual\s*Crédito/i).within(() => {
      cy.contains("button", /Acompanhar proposta|Completar cadastro/i).click();
    });
    cy.location("pathname", { timeout: 30_000 }).should(
      "match",
      /^\/propostas\/[^/]+$/,
    );
  } else if (caseId === "TIMELINE-06") {
    cy.openProposalList();
  } else {
    cy.openDefaultProposal();
  }
});

function deadlineLabel(value: string): string {
  const [day, month, year] = value.split("/");
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  return `${day}/${months[Number(month) - 1]}/${year}`;
}

function cardDeadlineLabel(value: string): string {
  const monthNumbers: Record<string, string> = {
    Jan: "01",
    Fev: "02",
    Mar: "03",
    Abr: "04",
    Mai: "05",
    Jun: "06",
    Jul: "07",
    Ago: "08",
    Set: "09",
    Out: "10",
    Nov: "11",
    Dez: "12",
  };
  const [day, month, year] = value.split("/");
  return `${day}/${monthNumbers[month]}/${year}`;
}

const implementations = {
  "TIMELINE-01": () => {
    const expected = portalConnect.testData.expectedProposal;
    cy.contains("Proponente:")
      .parent()
      .invoke("text")
      .then((text) => {
        expect(text.toUpperCase()).to.contain(
          expected.proponentName.toUpperCase(),
        );
      });
    cy.contains("CPF:")
      .parent()
      .should("contain.text", `***.***.***-${expected.cpfEnding}`);
  },
  "TIMELINE-02": () => {
    cy.contains("Proponente:").parent().should("contain.text", "CPF:");
    cy.contains("Proponente:").parent().should("not.contain.text", "CNPJ:");
  },
  "TIMELINE-03": () => {
    cy.get('nav[aria-label="Fases da proposta"]:visible')
      .should("have.length", 1)
      .invoke("text")
      .then((text) => {
        for (const phase of [
          "Simulação",
          "Cadastro",
          "Crédito",
          "Negociação",
          "Análise de Documentos",
          "Análise Técnica",
          "Formalização",
          "Liberação",
        ]) {
          expect(text).to.contain(phase);
        }
      });
  },
  "TIMELINE-04": () => {
    const proposalIds = portalConnect.caseProposalIds;

    const openJourney = (proposalNumber: string, heading: string) => {
      cy.contains("article", `Proposta #${proposalNumber}`).within(() => {
        cy.contains(
          "button",
          /Completar cadastro|Acompanhar proposta|Enviar documentos/i,
        ).click();
      });
      cy.location("pathname", { timeout: 30_000 }).should(
        "match",
        /^\/propostas\/[^/]+$/,
      );
      cy.get('nav[aria-label="Fases da proposta"]:visible').should(
        "have.length",
        1,
      );
      cy.contains("h2", heading).should("be.visible");
    };

    openJourney(proposalIds.TIMELINE_04_CADASTRO, "Cadastro da Proposta");
    cy.openProposalList();
    openJourney(proposalIds.TIMELINE_04_DOCUMENTOS, "Documentos da proposta");
  },
  "TIMELINE-05": () => {
    cy.get('nav[aria-label="Fases da proposta"]:visible')
      .should("have.length", 1)
      .find('[aria-current="step"]')
      .should("contain.text", "Crédito");
  },
  "TIMELINE-06": () => {
    const proposalNumber = portalConnect.testData.propostaExpiradaId.replace(
      /^0+/,
      "",
    );

    cy.contains("article", `Proposta #${proposalNumber}`).within(() => {
      cy.contains(
        "button",
        /Completar cadastro|Acompanhar proposta/i,
      ).click();
    });
    cy.get('[role="dialog"]').should(
      "not.exist",
      "proposta expirada deve continuar disponivel para visualizacao",
    );
    cy.location("pathname", { timeout: 30_000 }).should(
      "match",
      /^\/propostas\/[^/]+$/,
    );
    cy.get('[data-slot="skeleton"]', { timeout: 30_000 }).should("not.exist");
    cy.get("input:visible, select:visible, textarea:visible")
      .should("have.length.at.least", 1)
      .each(($field) => {
        const isLocked =
          $field.is(":disabled") || $field.attr("readonly") !== undefined;
        expect(
          isLocked,
          `campo ${$field.attr("name") ?? $field.attr("id")}`,
        ).to.equal(true);
      });
    cy.get("body").then(($body) => {
      const $confirmButton = $body
        .find("button")
        .filter((_index, button) =>
          /Confirmar e avançar cadastro/i.test(button.textContent ?? ""),
        );

      if ($confirmButton.length > 0) {
        cy.wrap($confirmButton).should("be.disabled");
      } else {
        expect($confirmButton, "botao de confirmacao oculto").to.have.length(0);
      }
    });
  },
  "TIMELINE-07": () => {
    const deadline = deadlineLabel(
      portalConnect.testData.expectedProposal.deadline,
    );
    cy.contains(
      new RegExp(
        `Você tem até o dia\\s*${Cypress._.escapeRegExp(deadline)}\\s*para finalizar o cadastro`,
        "i",
      ),
    ).should("be.visible");
  },
  "TIMELINE-08": () => {
    cy.contains(
      "As informações deste Cadastro são obrigatórias para dar continuidade ao processo.",
    ).should("be.visible");
  },
  "TIMELINE-09": () => {
    const message =
      "As informações deste Cadastro são obrigatórias para dar continuidade ao processo.";
    cy.contains('[role="status"]', message).within(() => {
      cy.get('button[aria-label="Fechar aviso"]').click();
    });
    cy.contains("button", /^Não mostrar novamente$/i).click();
    cy.contains('[role="status"]', message).should("not.exist");
    cy.reload();
    cy.contains('[role="status"]', message).should("not.exist");
  },
  "TIMELINE-10": () => {
    cy.then(() => {
      const expected = proposalSummaries.filter(
        (proposal) =>
          /Cadastro|Documentos|Análise de Documentos/i.test(
            proposal.faseAtual,
          ) && Boolean(proposal.prazoCadastroLimite),
      );

      expect(expected, "propostas com prazo aplicável").to.have.length.at.least(
        2,
      );
      for (const proposal of expected) {
        cy.contains("article", `Proposta #${proposal.numero}`).should(
          "contain.text",
          `Data limite para preenchimento do cadastro: ${cardDeadlineLabel(
            proposal.prazoCadastroLimite as string,
          )}`,
        );
      }
    });
  },
  "TIMELINE-11": () => {
    cy.contains("button", /Ver Detalhes da Operação/i).should("not.exist");
  },
  "TIMELINE-12": () => {
    cy.contains("button", /Ver documentos/i).should("not.exist");
  },
};

registerClientCases(
  "Portal Cadastro: Linha do Tempo e Alertas",
  cases,
  implementations,
);
