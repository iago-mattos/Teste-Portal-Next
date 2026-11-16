import type {
  FinancingIndexer,
  FinancingPfOrigin,
  FinancingPjOrigin,
  ObservedJourney,
  SimulationDataScreenExpectation,
  SimulationJourneySelection,
} from "../types/simulator";

/**
 * Catálogo das 24 jornadas de navegação oferecidas pelo Simulador em
 * portal-desenv (inspeção de 09/11/2026, leitura, sem envio).
 *
 * É um contrato OBSERVADO: protege contra regressão da interface, mas as
 * combinações permitidas ainda dependem de confirmação de Produto
 * (auditoria, seção 9, item 1). Divergência da auditoria de 17/09/2026:
 * PF + Imóvel Comercial oferece somente TR e IPCA, sem Poupança.
 */
const PF_ORIGINS: readonly FinancingPfOrigin[] = [
  "Empreendimento Financiado pela Esteira Digital",
  "Imóvel da Esteira Digital",
  "Imóvel Particular",
];

const PJ_ORIGINS: readonly FinancingPjOrigin[] = [
  "Empreendimento Financiado pela Esteira Digital",
  "Imóvel Esteira Digital",
  "Imóvel Particular",
];

const RESIDENTIAL_INDEXERS: readonly FinancingIndexer[] = [
  "Taxa Referencial (TR)",
  "Índice de Preços ao Consumidor Amplo (IPCA)",
  "Poupança",
];

const COMMERCIAL_INDEXERS = [
  "Taxa Referencial (TR)",
  "Índice de Preços ao Consumidor Amplo (IPCA)",
] as const;

/**
 * A tela Dados mostra, acima do título, a última escolha da jornada
 * (indexador em PF, origem em PJ, "Imóvel" no Crédito Garantia). PJ troca
 * "financiamento" por "emprestimo" e "Renda" por "Faturamento".
 */
function dataScreenFor(
  selection: SimulationJourneySelection,
): SimulationDataScreenExpectation {
  const isCorporate = selection.borrowerType === "Pessoa Jurídica";
  return {
    eyebrow:
      selection.indexer ?? selection.propertyOrigin ?? selection.propertyType,
    propertyValueLabel: "Valor do imovel",
    financingValueLabel: isCorporate
      ? "Valor do emprestimo"
      : "Valor do financiamento",
    incomeLabel: isCorporate ? "Faturamento liquido" : "Renda liquida",
  };
}

function journeyId(selection: SimulationJourneySelection): string {
  const parts: readonly (string | undefined)[] = [
    selection.modality,
    selection.borrowerType,
    selection.propertyType,
    selection.propertyOrigin,
    selection.indexer,
  ];
  return parts.filter((part): part is string => Boolean(part)).join(" > ");
}

function observed(selection: SimulationJourneySelection): ObservedJourney {
  return {
    id: journeyId(selection),
    selection,
    dataScreen: dataScreenFor(selection),
  };
}

const financingPf = PF_ORIGINS.flatMap((propertyOrigin) => [
  ...RESIDENTIAL_INDEXERS.map((indexer) =>
    observed({
      modality: "Financiamento Imobiliário",
      borrowerType: "Pessoa Física",
      propertyType: "Imóvel Residencial",
      propertyOrigin,
      indexer,
    }),
  ),
  ...COMMERCIAL_INDEXERS.map((indexer) =>
    observed({
      modality: "Financiamento Imobiliário",
      borrowerType: "Pessoa Física",
      propertyType: "Imóvel Comercial",
      propertyOrigin,
      indexer,
    }),
  ),
]);

const financingPj = [
  ...PJ_ORIGINS.map((propertyOrigin) =>
    observed({
      modality: "Financiamento Imobiliário",
      borrowerType: "Pessoa Jurídica",
      propertyType: "Imóvel Comercial",
      propertyOrigin,
    }),
  ),
  ...[...PJ_ORIGINS, "Holding Familiar" as const].map((propertyOrigin) =>
    observed({
      modality: "Financiamento Imobiliário",
      borrowerType: "Pessoa Jurídica",
      propertyType: "Imóvel Residencial",
      propertyOrigin,
    }),
  ),
];

const homeEquity = (["Pessoa Física", "Pessoa Jurídica"] as const).map(
  (borrowerType) =>
    observed({
      modality: "Crédito Garantia de Imóvel",
      borrowerType,
      propertyType: "Imóvel",
    }),
);

export const OBSERVED_SIMULATOR_JOURNEYS: readonly ObservedJourney[] =
  Object.freeze([...financingPf, ...financingPj, ...homeEquity]);

/** Opções exatas oferecidas em cada etapa, na ordem exibida (por prefixo da jornada). */
export interface ObservedMenuNode {
  readonly path: readonly string[];
  readonly options: readonly string[];
}

export const OBSERVED_SIMULATOR_MENU: readonly ObservedMenuNode[] =
  Object.freeze([
    {
      path: [],
      options: ["Financiamento Imobiliário", "Crédito Garantia de Imóvel"],
    },
    {
      path: ["Financiamento Imobiliário"],
      options: ["Pessoa Física", "Pessoa Jurídica"],
    },
    {
      path: ["Financiamento Imobiliário", "Pessoa Física"],
      options: ["Imóvel Residencial", "Imóvel Comercial"],
    },
    {
      path: ["Financiamento Imobiliário", "Pessoa Física", "Imóvel Residencial"],
      options: [
        "Empreendimento Financiado pela Esteira Digital",
        "Imóvel da Esteira Digital",
        "Imóvel Particular",
      ],
    },
    {
      path: [
        "Financiamento Imobiliário",
        "Pessoa Física",
        "Imóvel Residencial",
        "Imóvel da Esteira Digital",
      ],
      options: [
        "Taxa Referencial (TR)",
        "Índice de Preços ao Consumidor Amplo (IPCA)",
        "Poupança",
      ],
    },
    {
      path: ["Financiamento Imobiliário", "Pessoa Física", "Imóvel Comercial"],
      options: [
        "Empreendimento Financiado pela Esteira Digital",
        "Imóvel da Esteira Digital",
        "Imóvel Particular",
      ],
    },
    {
      path: [
        "Financiamento Imobiliário",
        "Pessoa Física",
        "Imóvel Comercial",
        "Imóvel da Esteira Digital",
      ],
      options: [
        "Taxa Referencial (TR)",
        "Índice de Preços ao Consumidor Amplo (IPCA)",
      ],
    },
    {
      path: ["Financiamento Imobiliário", "Pessoa Jurídica"],
      options: ["Imóvel Comercial", "Imóvel Residencial"],
    },
    {
      path: ["Financiamento Imobiliário", "Pessoa Jurídica", "Imóvel Comercial"],
      options: [
        "Empreendimento Financiado pela Esteira Digital",
        "Imóvel Esteira Digital",
        "Imóvel Particular",
      ],
    },
    {
      path: [
        "Financiamento Imobiliário",
        "Pessoa Jurídica",
        "Imóvel Residencial",
      ],
      options: [
        "Empreendimento Financiado pela Esteira Digital",
        "Imóvel Esteira Digital",
        "Imóvel Particular",
        "Holding Familiar",
      ],
    },
    {
      path: ["Crédito Garantia de Imóvel"],
      options: ["Pessoa Física", "Pessoa Jurídica"],
    },
    {
      path: ["Crédito Garantia de Imóvel", "Pessoa Física"],
      options: ["Imóvel"],
    },
    {
      path: ["Crédito Garantia de Imóvel", "Pessoa Jurídica"],
      options: ["Imóvel"],
    },
  ]);
