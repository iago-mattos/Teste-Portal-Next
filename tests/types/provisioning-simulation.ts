import type { SimulationApplicantSeed } from "./simulator";

/**
 * Recorte comum persistido pelo provisionador, independentemente de a
 * simulação nascer no Portal público ou diretamente no SCCI/AEJS.
 */
export interface ProvisioningSimulationScenario {
  readonly provider?: "portal-simulator" | "c6-scci";
  readonly financial: {
    readonly propertyValueCents: string;
    readonly financingValueCents: string;
    readonly termMonths: number;
    readonly birthDateDigits: string;
  };
  readonly applicantSeed: SimulationApplicantSeed;
}
