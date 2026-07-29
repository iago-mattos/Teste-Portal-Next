import type { ProvisioningSimulationScenario } from "./provisioning-simulation";

export interface C6SimulationJourney {
  readonly operationGroup: "WEB";
  readonly borrowerType: "Pessoa Física";
  readonly propertyType: "Imóvel Residencial";
  readonly financingType: "Empréstimo com Garantia Imobiliária";
  readonly interestType: "Pré-fixado";
}

export interface C6ProvisioningScenario
  extends ProvisioningSimulationScenario {
  readonly provider: "c6-scci";
  readonly journey: C6SimulationJourney;
  readonly insurer: "ZURICH";
  readonly applicantPostalCode: string;
}
