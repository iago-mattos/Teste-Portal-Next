import { existsSync } from "node:fs";

for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
    break;
  }
}

const requireOperation = process.argv.includes("--require-operation");
const operation = process.env.PORTAL_INTEGRATION_OPERATION?.replace(/\D/g, "") ?? "";

if (process.env.ALLOW_TEST_MUTATION !== "true") {
  console.error(
    "Execucao bloqueada: defina ALLOW_TEST_MUTATION=true para autorizar alteracoes em propostas de QA.",
  );
  process.exit(1);
}

if (requireOperation && (!operation || /^0+$/.test(operation))) {
  console.error(
    "Execucao bloqueada: informe PORTAL_INTEGRATION_OPERATION com uma massa descartavel valida.",
  );
  process.exit(1);
}

console.log("Opt-in destrutivo validado para ambiente de QA.");
