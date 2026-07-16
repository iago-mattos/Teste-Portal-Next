import { loadEnvironmentProfile } from "./environment-profile.mjs";
import { parseCoreCapabilities } from "./core-capabilities.mjs";

loadEnvironmentProfile();

const required = process.argv.slice(2);
if (required.length === 0) {
  throw new Error("Informe ao menos uma capacidade Portal Core obrigatoria.");
}

const configured = parseCoreCapabilities(
  process.env.PORTAL_CORE_CAPABILITIES,
);
const missing = required.filter((capability) => !configured.has(capability));

if (missing.length > 0) {
  throw new Error(
    `Capacidades Portal Core ausentes no perfil ativo: ${missing.join(", ")}. Qualifique as massas antes de habilita-las.`,
  );
}
