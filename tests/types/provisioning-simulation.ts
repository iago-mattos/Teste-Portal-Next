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
  /**
   * Endereço que o provisionamento deve persistir no imóvel quando o provedor
   * não o cria junto com a simulação. É opcional no contrato comum porque nem
   * todo tenant expõe essa etapa no mesmo fluxo.
   */
  readonly propertyAddress?: {
    readonly postalCode: string;
    readonly addressLine: string;
    readonly state: string;
    readonly municipality: string;
  };
}
