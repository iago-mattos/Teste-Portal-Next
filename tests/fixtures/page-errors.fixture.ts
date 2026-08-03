import type { Page, TestInfo } from "@playwright/test";
import { scenarioTest } from "./scenario.fixture";
import { attachContextScreenshots } from "./evidence";

interface CapturedPageError {
  message: string;
  name: string;
  pageUrl: string;
  stack?: string;
}

interface PageErrorFixtures {
  captureFinalPortalEvidence: void;
  capturePageErrors: void;
  captureSimulatorTrace: void;
}

const react418Prefix = "Minified React error #418;";
const maximumDiagnosticLength = 8_000;

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0] ?? "";
  }
}

function sanitizeDiagnostic(value: string): string {
  return value
    .replace(/https?:\/\/[^\s)\]]+/g, (url) => sanitizeUrl(url))
    .replace(
      /\b(token|cookie|authorization|password|senha)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .slice(0, maximumDiagnosticLength);
}

function captureError(page: Page, error: Error): CapturedPageError {
  return {
    message: sanitizeDiagnostic(error.message),
    name: sanitizeDiagnostic(error.name),
    pageUrl: sanitizeUrl(page.url()),
    stack: error.stack ? sanitizeDiagnostic(error.stack) : undefined,
  };
}

async function attachErrors(
  name: string,
  errors: CapturedPageError[],
  testInfo: TestInfo,
): Promise<void> {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(errors, null, 2)),
    contentType: "application/json",
  });
}

export const pageErrorsTest = scenarioTest.extend<PageErrorFixtures>({
  captureFinalPortalEvidence: [
    async ({ context }, use, testInfo) => {
      try {
        await use();
      } finally {
        const hasDedicatedSafeEvidence = [
          "c6-mass-provisioning",
          "integration",
          "simulator-integration",
        ].includes(testInfo.project.name);

        if (!hasDedicatedSafeEvidence) {
          await attachContextScreenshots(
            context,
            testInfo,
            "evidencia-final-portal",
          );
        }
      }
    },
    { auto: true },
  ],

  captureSimulatorTrace: [
    async ({ context }, use, testInfo) => {
      if (testInfo.project.name !== "simulator-integration") {
        await use();
        return;
      }

      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
      try {
        await use();
      } finally {
        await attachContextScreenshots(
          context,
          testInfo,
          "evidencia-final-portal",
        );
        const tracePath = testInfo.outputPath("trace-portal.zip");
        await context.tracing.stop({ path: tracePath });
        await testInfo.attach("trace-portal", {
          path: tracePath,
          contentType: "application/zip",
        });
      }
    },
    { auto: true },
  ],

  capturePageErrors: [
    async ({ context, portalConfig }, use, testInfo) => {
      const capturedErrors: CapturedPageError[] = [];
      const pageListeners = new Map<Page, (error: Error) => void>();

      const observePage = (page: Page): void => {
        if (pageListeners.has(page)) return;

        const listener = (error: Error): void => {
          capturedErrors.push(captureError(page, error));
        };
        pageListeners.set(page, listener);
        page.on("pageerror", listener);
      };

      for (const page of context.pages()) observePage(page);
      context.on("page", observePage);

      await use();

      context.off("page", observePage);
      for (const [page, listener] of pageListeners) {
        page.off("pageerror", listener);
      }

      const quarantinedErrors = portalConfig.pageErrors
        .allowReact418Quarantine
        ? capturedErrors.filter((error) =>
            error.message.startsWith(react418Prefix),
          )
        : [];
      const unexpectedErrors = capturedErrors.filter(
        (error) => !quarantinedErrors.includes(error),
      );

      if (quarantinedErrors.length > 0) {
        await attachErrors("quarantined-page-errors", quarantinedErrors, testInfo);
      }

      if (unexpectedErrors.length === 0) return;

      await attachErrors("unexpected-page-errors", unexpectedErrors, testInfo);
      throw new Error(
        `Foram capturados ${unexpectedErrors.length} erro(s) inesperado(s) de pagina: ${unexpectedErrors
          .map((error) => `${error.name}: ${error.message}`)
          .join(" | ")}`,
      );
    },
    { auto: true },
  ],
});
