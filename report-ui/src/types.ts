export type TestOutcome = "expected" | "unexpected" | "flaky" | "skipped";
export type AttachmentKind = "image" | "video" | "trace" | "other";

export interface ReportAttachment {
  readonly name: string;
  readonly contentType: string;
  readonly kind: AttachmentKind;
  readonly path: string;
  readonly size: number;
}

export interface ReportError {
  readonly message: string;
  readonly stack?: string;
  readonly snippet?: string;
  readonly value?: string;
  readonly location?: {
    readonly file: string;
    readonly line: number;
    readonly column: number;
  };
}

export interface ReportStep {
  readonly title: string;
  readonly category: string;
  readonly duration: number;
  readonly error?: string;
  readonly steps: readonly ReportStep[];
}

export interface ReportTest {
  readonly id: string;
  readonly title: string;
  readonly titlePath: readonly string[];
  readonly project: string;
  readonly file: string;
  readonly line: number;
  readonly tags: readonly string[];
  readonly status: string;
  readonly outcome: TestOutcome;
  readonly expectedStatus: string;
  readonly duration: number;
  readonly retry: number;
  readonly startedAt: string;
  readonly errors: readonly ReportError[];
  readonly annotations: readonly { type: string; description?: string }[];
  readonly attachments: readonly ReportAttachment[];
  readonly steps: readonly ReportStep[];
}

export interface PortalReport {
  readonly version: number;
  readonly generatedAt: string;
  readonly run: {
    readonly status: string;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly duration: number;
    readonly profile: string;
    readonly node: string;
    readonly platform: string;
    readonly total: number;
  };
  readonly summary: {
    readonly passed: number;
    readonly failed: number;
    readonly skipped: number;
    readonly flaky: number;
  };
  readonly tests: readonly ReportTest[];
}
