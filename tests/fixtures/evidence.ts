import type {
  BrowserContext,
  Locator,
  Page,
  TestInfo,
} from "@playwright/test";
import { writeFile } from "node:fs/promises";

export type EvidenceMask =
  | "none"
  | "operation"
  | "tax-id"
  | "name"
  | "email"
  | "phone"
  | "postal-code"
  | "address"
  | "date";

export interface FunctionalEvidenceField {
  readonly label: string;
  readonly expected: string | number | boolean;
  readonly actual: string | number | boolean;
  readonly mask?: EvidenceMask;
}

export interface FunctionalEvidenceOptions {
  readonly order: number;
  readonly slug: string;
  readonly title: string;
  readonly scenario: string;
  readonly operationNumber: string;
  readonly fields: readonly FunctionalEvidenceField[];
}

function maskValue(
  value: string | number | boolean,
  mask: EvidenceMask = "none",
): string {
  const text = String(value);
  if (mask === "none" || typeof value === "boolean") return text;

  if (mask === "operation") {
    const digits = text.replace(/\D/g, "");
    return digits ? `••••${digits.slice(-4)}` : "••••";
  }

  if (mask === "tax-id") {
    const digits = text.replace(/\D/g, "");
    return digits ? `***.***.***-${digits.slice(-2)}` : "***";
  }

  if (mask === "name") {
    const [firstName = ""] = text.trim().split(/\s+/);
    return firstName ? `${firstName.slice(0, 1)}***` : "***";
  }

  if (mask === "email") {
    const [local = "", domain = ""] = text.split("@");
    return domain ? `${local.slice(0, 1)}***@${domain}` : "***";
  }

  if (mask === "phone") {
    const digits = text.replace(/\D/g, "");
    return digits ? `(**) *****-${digits.slice(-4)}` : "***";
  }

  if (mask === "postal-code") {
    const digits = text.replace(/\D/g, "");
    return digits ? `*****-${digits.slice(-3)}` : "***";
  }

  if (mask === "address") {
    const number = text.match(/\d+[A-Za-z]?\s*$/)?.[0]?.trim();
    return number ? `***, ${number}` : "***";
  }

  const year = text.match(/\d{4}/)?.[0];
  return year ? `**/**/${year}` : "**/**/****";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function evidenceFilePrefix(order: number, slug: string): string {
  const normalizedSlug = slug
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${String(order).padStart(2, "0")}-${normalizedSlug}`;
}

function resolveEvidenceEnvironment(): string {
  return (
    process.env.PW_PROFILE?.trim() ||
    process.env.PORTAL_ENV?.trim() ||
    "não informado"
  );
}

export async function inputEvidenceField(
  label: string,
  locator: Locator,
  expected: string | number,
  mask: EvidenceMask = "none",
): Promise<FunctionalEvidenceField> {
  return {
    label,
    expected,
    actual: await locator.inputValue(),
    mask,
  };
}

export async function checkedEvidenceField(
  label: string,
  locator: Locator,
  expected: boolean,
): Promise<FunctionalEvidenceField> {
  return {
    label,
    expected,
    actual: await locator.isChecked(),
  };
}

export async function textEvidenceField(
  label: string,
  locator: Locator,
  expected: string,
  mask: EvidenceMask = "none",
): Promise<FunctionalEvidenceField> {
  return {
    label,
    expected,
    actual: (await locator.innerText()).trim(),
    mask,
  };
}

export async function attachFunctionalEvidence(
  page: Page,
  testInfo: TestInfo,
  options: FunctionalEvidenceOptions,
): Promise<void> {
  const prefix = evidenceFilePrefix(options.order, options.slug);
  const fields = options.fields.map((field) => ({
    campo: field.label,
    esperado: maskValue(field.expected, field.mask),
    encontrado: maskValue(field.actual, field.mask),
    resultado: "APROVADO",
  }));
  const validationSummary = fields
    .map(
      (field) =>
        `${field.campo}: esperado ${field.esperado}; encontrado ${field.encontrado}; ${field.resultado}`,
    )
    .join("\n");
  const payload = {
    evidenceType: "validação funcional Portal → SCCI",
    scenario: options.scenario,
    evidenceSection: options.title,
    operation: maskValue(options.operationNumber, "operation"),
    environment: resolveEvidenceEnvironment(),
    validatedFields: `${fields.length}/${fields.length}`,
    validationSummary,
    capturedAt: new Date().toISOString(),
    fields,
  };
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(options.title)}</title>
    <style>
      :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
      body { margin: 0; background: #f5f5f7; color: #1d1d1f; }
      main { max-width: 1080px; margin: 0 auto; padding: 40px 24px; }
      article { overflow: hidden; border: 1px solid #e5e5e7; border-radius: 18px; background: #fff; box-shadow: 0 12px 36px rgb(0 0 0 / 8%); }
      header { padding: 24px; border-bottom: 1px solid #ececef; }
      h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -.02em; }
      .meta { display: flex; flex-wrap: wrap; gap: 8px; color: #6e6e73; font-size: 13px; }
      .meta span { padding: 6px 10px; border-radius: 999px; background: #f5f5f7; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      th, td { padding: 13px 16px; border-bottom: 1px solid #ececef; text-align: left; vertical-align: top; }
      th { color: #6e6e73; background: #fafafa; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      tr:last-child td { border-bottom: 0; }
      .passed { color: #248a3d; font-weight: 650; white-space: nowrap; }
    </style>
  </head>
  <body>
    <main>
      <article>
        <header>
          <h1>${escapeHtml(options.title)}</h1>
          <div class="meta">
            <span>${escapeHtml(options.scenario)}</span>
            <span>Operação ${escapeHtml(payload.operation)}</span>
            <span>Ambiente ${escapeHtml(payload.environment)}</span>
            <span>${escapeHtml(payload.validatedFields)} campos</span>
          </div>
        </header>
        <table>
          <thead><tr><th>Campo</th><th>Esperado</th><th>Encontrado</th><th>Resultado</th></tr></thead>
          <tbody>
            ${fields
              .map(
                (field) =>
                  `<tr><td>${escapeHtml(field.campo)}</td><td>${escapeHtml(field.esperado)}</td><td>${escapeHtml(field.encontrado)}</td><td class="passed">✓ ${field.resultado}</td></tr>`,
              )
              .join("\n")}
          </tbody>
        </table>
      </article>
    </main>
  </body>
</html>`;

  await testInfo.attach(`${prefix}.evidence.json`, {
    body: Buffer.from(JSON.stringify(payload, null, 2)),
    contentType: "application/json",
  });
  const htmlPath = testInfo.outputPath(`${prefix}.evidence.html`);
  await writeFile(htmlPath, html, "utf8");
  await testInfo.attach(`${prefix}.evidence.html`, {
    path: htmlPath,
    contentType: "text/html",
  });
  await attachMaskedFullPageScreenshot(
    page,
    testInfo,
    `${prefix}-${options.title}.png`,
    [
      options.operationNumber,
      ...options.fields.flatMap((field) =>
        field.mask && field.mask !== "none"
          ? [String(field.expected), String(field.actual)]
          : [],
      ),
    ],
  );
}

export async function attachMaskedFullPageScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  sensitiveValues: readonly string[],
): Promise<boolean> {
  if (page.isClosed() || page.url() === "about:blank") return false;

  const tokens = [...new Set(sensitiveValues.map((value) => value.trim()))]
    .filter((value) => value.length >= 4)
    .map((value) => ({
      text: value.toLocaleLowerCase("pt-BR"),
      digits: value.replace(/\D/g, ""),
    }));

  await page.evaluate((maskTokens) => {
    const styleId = "pw-functional-evidence-mask-style";
    document.getElementById(styleId)?.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      [data-pw-functional-evidence-mask="true"] {
        filter: blur(6px) !important;
        user-select: none !important;
      }
    `;
    document.head.append(style);

    const candidates = document.querySelectorAll<HTMLElement>(
      "input, textarea, [role='gridcell'], [role='heading'], h1, h2, h3, span, div, p",
    );
    for (const element of candidates) {
      if (
        !(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLTextAreaElement) &&
        element.children.length > 0
      ) {
        continue;
      }

      const rawValue =
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
          ? element.value
          : (element.textContent ?? "");
      const text = rawValue.trim().toLocaleLowerCase("pt-BR");
      const digits = rawValue.replace(/\D/g, "");
      const fieldName = element.getAttribute("name") ?? "";
      const hasSensitiveFieldName =
        /CPF|CNPJ|NO_PESSOA|EMAIL|TELEFONE|CELULAR|CEP|ENDERECO|DT_NASCIMENTO|OPERACAO/iu.test(
          fieldName,
        );
      const hasSensitiveTextPattern =
        /\b\d{3}[.]\d{3}[.]\d{3}-\d{2}\b/u.test(rawValue) ||
        /\b[^\s@]+@[^\s@]+[.][^\s@]+\b/u.test(rawValue) ||
        /\b0{2,}\d{5,}\b/u.test(rawValue);
      const shouldMask = maskTokens.some(
        (token) =>
          (token.text.length >= 4 && text.includes(token.text)) ||
          (token.digits.length >= 5 && digits.includes(token.digits)),
      ) || hasSensitiveFieldName || hasSensitiveTextPattern;
      if (shouldMask) {
        element.dataset.pwFunctionalEvidenceMask = "true";
      }
    }
  }, tokens);

  try {
    return await attachFullPageScreenshot(page, testInfo, name);
  } finally {
    if (!page.isClosed()) {
      await page.evaluate(() => {
        document
          .querySelectorAll<HTMLElement>(
            '[data-pw-functional-evidence-mask="true"]',
          )
          .forEach((element) => {
            delete element.dataset.pwFunctionalEvidenceMask;
          });
        document
          .getElementById("pw-functional-evidence-mask-style")
          ?.remove();
      });
    }
  }
}

export async function attachFullPageScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<boolean> {
  if (page.isClosed() || page.url() === "about:blank") return false;

  try {
    await testInfo.attach(name, {
      body: await page.screenshot({
        fullPage: true,
        animations: "disabled",
        caret: "hide",
      }),
      contentType: "image/png",
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await testInfo.attach(`${name}.erro.txt`, {
      body: Buffer.from(
        `Não foi possível capturar a página inteira no teardown.\n${message}`,
      ),
      contentType: "text/plain",
    });
    return false;
  }
}

export async function attachContextScreenshots(
  context: BrowserContext,
  testInfo: TestInfo,
  prefix: string,
): Promise<void> {
  let attached = 0;

  for (const page of context.pages()) {
    if (
      await attachFullPageScreenshot(
        page,
        testInfo,
        `${prefix}-${String(attached + 1).padStart(2, "0")}.png`,
      )
    ) {
      attached += 1;
    }
  }

  if (attached === 0) {
    await testInfo.attach(`${prefix}-indisponivel.txt`, {
      body: Buffer.from(
        "Nenhuma página navegável permaneceu aberta para a captura final.",
      ),
      contentType: "text/plain",
    });
  }
}
