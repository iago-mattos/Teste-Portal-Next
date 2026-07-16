import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test, type Request } from "@playwright/test";
import { generateValidCpfDigits } from "../helpers/cpf";
import { PortalSimulatorPage } from "../pages/portal/portal-simulator.page";
import { getDigitalMortgageSimulation } from "../test-data/simulator-data";
import type { SimulationApplicantInput } from "../types/simulator";
import {
  createDemoInteractions,
  getDemoClickTimeline,
  holdDemoFinalScreen,
  installDemoCursor,
} from "./demo-interactions";

const DEMO_APPLICANT_NAME = "João da Silva";

function containsValue(value: unknown, expected: string): boolean {
  if (value === expected) return true;
  if (Array.isArray(value)) {
    return value.some((item) => containsValue(item, expected));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsValue(item, expected));
  }
  return false;
}

function requestContainsApplicantName(request: Request): boolean {
  if (request.method() !== "POST") return false;
  try {
    return containsValue(request.postDataJSON(), DEMO_APPLICANT_NAME);
  } catch {
    const rawBody = request.postData();
    return rawBody ? decodeURIComponent(rawBody).includes(DEMO_APPLICANT_NAME) : false;
  }
}

test(
  "apresenta o fluxo completo do simulador imobiliário",
  { tag: ["@demo", "@mutation"] },
  async ({ page }) => {
    if (process.env.ALLOW_TEST_MUTATION !== "true") {
      throw new Error(
        "Demonstração bloqueada: defina ALLOW_TEST_MUTATION=true para criar a proposta de QA.",
      );
    }

    const scenario = getDigitalMortgageSimulation();
    const applicant: SimulationApplicantInput = {
      cpfDigits: generateValidCpfDigits(() => randomInt(10)),
      name: DEMO_APPLICANT_NAME,
      email: scenario.applicantSeed.email,
      mobileDigits: scenario.applicantSeed.mobileDigits,
    };

    await installDemoCursor(page);
    const simulator = new PortalSimulatorPage(
      page,
      createDemoInteractions(page),
      90_000,
    );
    const submittedApplicant = page.waitForRequest(
      requestContainsApplicantName,
      { timeout: 10 * 60_000 },
    );

    const protocol = await simulator.completeSimulation(scenario, applicant);
    const submissionRequest = await submittedApplicant;

    expect(submissionRequest.method()).toBe("POST");
    await expect(
      page.getByText("Tudo certo! Enviamos o link de acesso.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(`Protocolo: ${protocol}`, { exact: true })).toBeVisible();
    await holdDemoFinalScreen(page);

    const timelinePath = resolve(
      "demo-results/videos/apresentacao-simulador-timeline.json",
    );
    mkdirSync(dirname(timelinePath), { recursive: true });
    writeFileSync(
      timelinePath,
      `${JSON.stringify({ clicks: getDemoClickTimeline(page) }, null, 2)}\n`,
      "utf8",
    );
  },
);
