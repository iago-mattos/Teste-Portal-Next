import { resolve } from "node:path";

/**
 * Quando `pw:test:all` provisiona um lote fresco, cada invocação de
 * `playwright test` feita pelos scripts de provisionamento grava um blob
 * próprio (nome único por etapa+slot) para que as evidências da criação pelo
 * simulador entrem no relatório consolidado final. Fora desse fluxo
 * (`PW_PROVISIONING_BLOB_ROOT` ausente), os scripts de provisionamento
 * continuam usando o reporter padrão de cada config, sem gerar blobs.
 */
export function resolveProvisioningBlobReporting(stepName, slotId) {
  const blobRoot = process.env.PW_PROVISIONING_BLOB_ROOT;
  if (!blobRoot) {
    return { extraArgs: [], extraEnv: {} };
  }

  return {
    extraArgs: ["--reporter=list,blob"],
    extraEnv: {
      PLAYWRIGHT_BLOB_OUTPUT_DIR: resolve(blobRoot, `${stepName}-${slotId}`),
    },
  };
}
