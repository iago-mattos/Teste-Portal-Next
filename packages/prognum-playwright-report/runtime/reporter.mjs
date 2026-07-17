import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, relative, resolve } from "node:path";

function attachmentKind(name, contentType) {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (name.toLowerCase().includes("trace")) return "trace";
  return "other";
}

function serializeStep(step) {
  return {
    title: step.title,
    category: step.category,
    duration: step.duration,
    error: step.error?.message,
    steps: step.steps.map(serializeStep),
  };
}

function stripAnsi(value) {
  const ansiPattern = new RegExp(
    `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
    "gu",
  );
  return value?.replace(ansiPattern, "");
}

export default class PrognumReporter {
  constructor(options = {}) {
    this.outputDir = resolve(
      options.outputDir ?? ".playwright/prognum-report-data",
    );
    this.attachmentsDir = resolve(this.outputDir, "assets");
    this.tests = [];
    this.rootDir = process.cwd();
    this.startedAt = new Date();
    this.total = 0;
    this.prepared = false;
  }

  printsToStdio() {
    return false;
  }

  onBegin(config, suite) {
    this.rootDir = config.rootDir;
    this.startedAt = new Date();
    this.total = suite.allTests().length;
    this.tests.length = 0;
    this.prepared = false;
  }

  onTestEnd(test, result) {
    if (!this.prepared) {
      rmSync(this.outputDir, { recursive: true, force: true });
      mkdirSync(this.attachmentsDir, { recursive: true });
      this.prepared = true;
    }

    const attachmentPrefix = createHash("sha1")
      .update(`${test.id}-${result.retry}`)
      .digest("hex")
      .slice(0, 12);
    const attachments = result.attachments.flatMap((attachment, index) => {
      const extension = attachment.path
        ? extname(attachment.path)
        : this.extensionFor(attachment.contentType);
      const sourceName = attachment.path
        ? basename(attachment.path, extname(attachment.path))
        : attachment.name;
      const safeName = sourceName.replace(/[^a-z0-9_-]+/giu, "-");
      const fileName = `${attachmentPrefix}-${index}-${safeName}${extension}`;
      const destination = resolve(this.attachmentsDir, fileName);

      if (attachment.path && existsSync(attachment.path)) {
        copyFileSync(attachment.path, destination);
      } else if (attachment.body) {
        writeFileSync(destination, attachment.body);
      } else {
        return [];
      }

      return [
        {
          name: attachment.name,
          contentType: attachment.contentType,
          kind: attachmentKind(attachment.name, attachment.contentType),
          path: `evidence/${fileName}`,
          size: statSync(destination).size,
        },
      ];
    });

    this.tests.push({
      id: `${test.id}-${result.retry}`,
      title: test.title,
      titlePath: test.titlePath(),
      project: test.parent.project()?.name ?? "default",
      file: relative(this.rootDir, test.location.file),
      line: test.location.line,
      tags: test.tags,
      status: result.status,
      outcome: test.outcome(),
      expectedStatus: test.expectedStatus,
      duration: result.duration,
      retry: result.retry,
      startedAt: result.startTime.toISOString(),
      errors: result.errors.map((error) => ({
        message: stripAnsi(error.message ?? error.value) ?? "Erro desconhecido",
        stack: stripAnsi(error.stack),
        snippet: stripAnsi(error.snippet),
        value: stripAnsi(error.value),
        location: error.location
          ? {
              file: relative(this.rootDir, error.location.file),
              line: error.location.line,
              column: error.location.column,
            }
          : undefined,
      })),
      annotations: result.annotations.map(({ type, description }) => ({
        type,
        description,
      })),
      attachments,
      steps: result.steps.map(serializeStep),
    });
  }

  onEnd(result) {
    if (!this.prepared) return;

    const endedAt = new Date();
    const summary = this.tests.reduce(
      (current, test) => {
        if (test.outcome === "skipped") current.skipped += 1;
        else if (test.outcome === "unexpected") current.failed += 1;
        else if (test.outcome === "flaky") current.flaky += 1;
        else current.passed += 1;
        return current;
      },
      { passed: 0, failed: 0, skipped: 0, flaky: 0 },
    );

    mkdirSync(this.outputDir, { recursive: true });
    writeFileSync(
      resolve(this.outputDir, "report.json"),
      `${JSON.stringify(
        {
          version: 2,
          generatedAt: endedAt.toISOString(),
          run: {
            status: result.status,
            startedAt: this.startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            duration: endedAt.getTime() - this.startedAt.getTime(),
            profile: process.env.PW_PROFILE?.trim() || "default",
            node: process.version,
            platform: process.platform,
            total: this.total,
          },
          summary,
          tests: this.tests,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  extensionFor(contentType) {
    if (contentType === "image/png") return ".png";
    if (contentType === "image/jpeg") return ".jpg";
    if (contentType === "video/webm") return ".webm";
    if (contentType === "application/zip") return ".zip";
    if (contentType === "application/json") return ".json";
    if (contentType.startsWith("text/")) return ".txt";
    return ".bin";
  }
}
