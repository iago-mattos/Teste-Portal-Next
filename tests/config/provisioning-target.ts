import { assertC6ProvisioningTarget } from "./c6-provisioning-target";
import { assertEsteiraHtProvisioningTarget } from "./esteira-ht-provisioning-target";

/**
 * Preparações de fase e de documentos são idênticas para o C6 e para a
 * EsteiraHT — só a proveniência da proposta muda. Este dispatcher evita
 * duplicar os testes de preparação por provedor.
 */
export function assertProvisioningTarget(): void {
  if (process.env.PORTAL_PROVISION_PROVIDER === "c6") {
    assertC6ProvisioningTarget();
    return;
  }
  assertEsteiraHtProvisioningTarget();
}
