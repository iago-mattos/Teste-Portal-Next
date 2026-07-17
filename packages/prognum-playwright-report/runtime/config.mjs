import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const reporterPath = fileURLToPath(new URL("./reporter.mjs", import.meta.url));

function normalizeReporters(reporter) {
  if (!reporter) return [];
  if (typeof reporter === "string") return [[reporter]];
  return reporter;
}

export function withPrognumReport(baseConfig, options = {}) {
  const captureAllEvidence = process.env.PW_EVIDENCE === "all";
  const existingReporters = normalizeReporters(baseConfig.reporter);

  return defineConfig(baseConfig, {
    reporter: [
      ...existingReporters,
      [
        reporterPath,
        {
          outputDir:
            options.dataDir ??
            process.env.PROGNUM_REPORT_DATA_DIR ??
            ".playwright/prognum-report-data",
        },
      ],
    ],
    use: {
      ...baseConfig.use,
      screenshot: captureAllEvidence
        ? "on"
        : (baseConfig.use?.screenshot ?? "only-on-failure"),
      trace: captureAllEvidence
        ? "on"
        : (baseConfig.use?.trace ?? "retain-on-failure"),
      video: captureAllEvidence
        ? "on"
        : (baseConfig.use?.video ?? "retain-on-failure"),
    },
  });
}
