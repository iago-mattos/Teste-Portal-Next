import type { DigitalMortgageSimulationScenario } from "../types/simulator";
import { scciInitialProcess } from "./scci-reference";

/**
 * Contrato oficial para gerar propostas descartáveis pelo simulador público.
 *
 * Valores monetários ficam em centavos porque os inputs aplicam máscara durante
 * a digitação. O nome completo e o protocolo são gerados por execução e serão
 * registrados pelo provisionador, sem transformar dados dinâmicos em contrato.
 */
const DIGITAL_MORTGAGE_SIMULATION_BASE = Object.freeze({
  journey: {
    modality: "Financiamento Imobiliário",
    borrowerType: "Pessoa Física",
    propertyType: "Imóvel Residencial",
    propertyOrigin: "Imóvel da Esteira Digital",
    indexer: "Taxa Referencial (TR)",
  },
  financial: {
    propertyValueCents: "150000000",
    financingValueCents: "50000000",
    termMonths: 120,
    amortizationSystem: "SAC - Sistema de amortizacao constante",
    gracePeriodDays: 30,
    birthDateDigits: "01012001",
    netIncomeCents: "5000000",
    composeIncome: false,
  },
  insurer: "MAPFRE",
  scciReflection: {
    financingModality: "Nova Operação",
    conditions: "Cliente da Esteira Digital",
    familyIncomeCents: "5000000",
    constructionFinancingValueCents: "0",
    amortizationSystem: "2 - SAC",
  },
} as const);

function requiredEnvironmentValue(
  env: NodeJS.ProcessEnv,
  key: string,
): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Configuração obrigatória ausente: ${key}.`);
  return value;
}

export function getDigitalMortgageSimulation(
  env: NodeJS.ProcessEnv = process.env,
): DigitalMortgageSimulationScenario {
  return Object.freeze({
    ...DIGITAL_MORTGAGE_SIMULATION_BASE,
    applicantSeed: Object.freeze({
      email: requiredEnvironmentValue(env, "PORTAL_SIMULATOR_EMAIL"),
      mobileDigits: requiredEnvironmentValue(
        env,
        "PORTAL_SIMULATOR_MOBILE",
      ).replace(/\D/g, ""),
    }),
  }) satisfies DigitalMortgageSimulationScenario;
}

/**
 * Estado inicial esperado no SCCI de uma proposta recém-criada pelo Simulador
 * no perfil esteira-ht. A fase e o código da tarefa inicial vêm do SCCI
 * (Manutenção > Tabelas > Originação > Configurações e Fases da operação),
 * lidos para tests/test-data/scci-reference.esteira-ht.json; título e status da
 * tarefa 010 e a tarefa 020 (próxima do fluxo) foram observados na operação
 * 000000668 (Andamento do Processo: 010 finalizada, 020 disponível).
 * Vale somente para o esteira-ht; outros ambientes precisam do próprio contrato.
 */
const scciProcess = scciInitialProcess();

export const SIMULATOR_INITIAL_PROCESS_STATE = Object.freeze({
  phase: scciProcess.initialPhaseName,
  tasks: [
    {
      code: scciProcess.initialTaskCode,
      title: "Registrar Proposta",
      status: "Proposta Registrada",
    },
    {
      code: "020",
      title: "Complementar dados da proposta",
      status: "Disponível",
    },
  ],
});
