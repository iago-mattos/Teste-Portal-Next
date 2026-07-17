import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  Film,
  FolderOpen,
  ImageIcon,
  Moon,
  Search,
  Sun,
  TestTube2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  PortalReport,
  ReportAttachment,
  ReportError,
  ReportStep,
  ReportTest,
  TestOutcome,
} from "@/types";

const outcomeLabels: Record<TestOutcome, string> = {
  expected: "Aprovado",
  unexpected: "Falhou",
  flaky: "Instável",
  skipped: "Ignorado",
};

const domainLabels: Record<string, string> = {
  auth: "Autenticação",
  login: "Login",
  proposals: "Propostas",
  timeline: "Linha do tempo",
  "proposal-form": "Cadastro da proposta",
  documents: "Documentos",
  fields: "Campos e contratos",
  persistence: "Persistência",
  concurrency: "Concorrência",
  isolation: "Isolamento",
  navigation: "Navegação",
  session: "Sessão e autorização",
  mobile: "Mobile e acessibilidade",
  "portal-aejs": "Portal → SCCI/AEJS",
  setup: "Preparação",
};

function formatDuration(duration: number): string {
  if (duration < 1_000) return `${duration} ms`;
  const seconds = duration / 1_000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatBytes(size: number): string {
  if (size < 1_024) return `${size} B`;
  if (size < 1_024 * 1_024) return `${(size / 1_024).toFixed(1)} KB`;
  return `${(size / (1_024 * 1_024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function outcomeVariant(
  outcome: TestOutcome,
): "success" | "destructive" | "warning" | "secondary" {
  if (outcome === "expected") return "success";
  if (outcome === "unexpected") return "destructive";
  if (outcome === "flaky") return "warning";
  return "secondary";
}

function domainFor(test: ReportTest): string {
  const parts = test.file.split("/");
  const rawDomain = parts.length > 2 ? parts[1] : parts[0];
  return domainLabels[rawDomain] ?? rawDomain.replaceAll("-", " ");
}

function summarize(tests: readonly ReportTest[]) {
  return tests.reduce(
    (summary, test) => {
      summary[test.outcome] += 1;
      return summary;
    },
    { expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
  );
}

function extractExpectation(error: ReportError): {
  expected?: string;
  received?: string;
} {
  const lines = error.message.split("\n").map((line) => line.trim());
  const readValue = (label: "Expected" | "Received") => {
    const line = lines.find((candidate) =>
      new RegExp(`^${label}(?: [^:]*)?:`, "iu").test(candidate),
    );
    return line?.replace(new RegExp(`^${label}(?: [^:]*)?:\\s*`, "iu"), "");
  };
  return { expected: readValue("Expected"), received: readValue("Received") };
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

function StepTree({
  steps,
  depth = 0,
}: {
  steps: readonly ReportStep[];
  depth?: number;
}) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div
          key={`${step.title}-${index}`}
          style={{ marginLeft: `${depth * 14}px` }}
        >
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-card px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.category}</p>
              {step.error ? (
                <p className="mt-1 text-xs text-red-600">{step.error}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDuration(step.duration)}
            </span>
          </div>
          {step.steps.length ? (
            <StepTree steps={step.steps} depth={depth + 1} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FailurePanel({
  test,
  onOpenImage,
}: {
  test: ReportTest;
  onOpenImage: (attachment: ReportAttachment) => void;
}) {
  const [copied, setCopied] = useState(false);
  const error = test.errors[0];
  const screenshot = test.attachments.filter(({ kind }) => kind === "image").at(-1);
  const trace = test.attachments.find(({ kind }) => kind === "trace");
  const expectation = error ? extractExpectation(error) : {};

  if (!error) return null;

  const copyError = async () => {
    await copyText(error.stack ?? error.message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/40">
      <div className="flex items-start gap-3 border-b border-red-200 p-4 dark:border-red-900">
        <div className="rounded-lg bg-red-100 p-2 text-red-700 dark:bg-red-900 dark:text-red-200">
          <CircleAlert className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-900 dark:text-red-100">
            Diagnóstico da falha
          </p>
          <p className="mt-1 line-clamp-3 text-sm text-red-800 dark:text-red-200">
            {error.message.split("\n")[0]}
          </p>
          {error.location ? (
            <p className="mt-2 break-all text-xs text-red-700 dark:text-red-300">
              {error.location.file}:{error.location.line}:{error.location.column}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_180px]">
        <div className="space-y-3">
          {expectation.expected || expectation.received ? (
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-background p-3 dark:border-emerald-900">
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Esperado
                </p>
                <p className="mt-1 break-words">{expectation.expected ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-background p-3 dark:border-red-900">
                <p className="font-semibold text-red-700 dark:text-red-300">
                  Recebido
                </p>
                <p className="mt-1 break-words">{expectation.received ?? "—"}</p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyError}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copiado" : "Copiar erro"}
            </Button>
            {trace ? (
              <a href={trace.path} download>
                <Button variant="outline" size="sm">
                  <Download className="size-3.5" /> Baixar trace
                </Button>
              </a>
            ) : null}
          </div>
        </div>
        {screenshot ? (
          <button
            type="button"
            onClick={() => onOpenImage(screenshot)}
            className="group overflow-hidden rounded-lg border bg-background text-left"
          >
            <img
              src={screenshot.path}
              alt="Última screenshot antes da falha"
              className="aspect-video w-full object-cover transition group-hover:scale-[1.02]"
            />
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
              Abrir última screenshot
            </p>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function TestDetails({ test }: { test: ReportTest }) {
  const [lightbox, setLightbox] = useState<ReportAttachment>();
  const [copiedTrace, setCopiedTrace] = useState<string>();
  const images = test.attachments.filter(({ kind }) => kind === "image");
  const videos = test.attachments.filter(({ kind }) => kind === "video");
  const traces = test.attachments.filter(({ kind }) => kind === "trace");
  const files = test.attachments.filter(({ kind }) => kind === "other");
  const poster = images.at(-1)?.path;

  const copyTraceCommand = async (attachment: ReportAttachment) => {
    await copyText(`npx playwright show-trace portal-report/${attachment.path}`);
    setCopiedTrace(attachment.path);
    window.setTimeout(() => setCopiedTrace(undefined), 1_500);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge variant={outcomeVariant(test.outcome)}>
          {outcomeLabels[test.outcome]}
        </Badge>
        <Badge variant="outline">{test.project}</Badge>
        <Badge variant="outline">{domainFor(test)}</Badge>
        {test.tags.map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>

      {test.outcome === "unexpected" ? (
        <div className="mt-5">
          <FailurePanel test={test} onOpenImage={setLightbox} />
        </div>
      ) : null}

      <Tabs defaultValue="summary" className="mt-6">
        <TabsList>
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          <TabsTrigger value="evidence">
            Evidências ({test.attachments.length})
          </TabsTrigger>
          <TabsTrigger value="steps">Etapas</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Arquivo</p>
              <p className="mt-1 break-all font-medium">
                {test.file}:{test.line}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Duração</p>
              <p className="mt-1 font-medium">{formatDuration(test.duration)}</p>
            </div>
          </div>
          {test.errors.length ? (
            <div className="space-y-3">
              {test.errors.map((error, index) => (
                <div key={index} className="space-y-2">
                  {error.snippet ? (
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100">
                      {error.snippet}
                    </pre>
                  ) : null}
                  <details className="rounded-lg border bg-card">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                      Stack completo
                    </summary>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t p-4 text-xs">
                      {error.stack ?? error.message}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              <CheckCircle2 className="size-4" /> Execução concluída sem erros.
            </div>
          )}
        </TabsContent>

        <TabsContent value="evidence" className="space-y-6">
          {!test.attachments.length ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma evidência foi gerada para este teste.
            </p>
          ) : null}

          {images.length ? (
            <section>
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <ImageIcon className="size-4" /> Screenshots
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {images.map((attachment) => (
                  <button
                    key={attachment.path}
                    type="button"
                    onClick={() => setLightbox(attachment)}
                    className="group overflow-hidden rounded-lg border bg-muted text-left"
                  >
                    <img
                      src={attachment.path}
                      alt={attachment.name}
                      className="aspect-video w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    />
                    <div className="flex items-center justify-between gap-2 bg-card px-3 py-2 text-xs">
                      <span className="truncate">{attachment.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatBytes(attachment.size)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {videos.length ? (
            <section>
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Film className="size-4" /> Vídeos
              </h3>
              <div className="space-y-3">
                {videos.map((attachment) => (
                  <div key={attachment.path} className="overflow-hidden rounded-lg border bg-card">
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      poster={poster}
                      className="aspect-video w-full bg-black object-contain"
                      src={attachment.path}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div>
                        <p className="text-xs font-medium">{attachment.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatBytes(attachment.size)} · WebM
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a href={attachment.path} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="size-3.5" /> Abrir
                          </Button>
                        </a>
                        <a href={attachment.path} download>
                          <Button variant="outline" size="sm">
                            <Download className="size-3.5" /> Baixar
                          </Button>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {traces.length ? (
            <section>
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <FileArchive className="size-4" /> Traces
              </h3>
              <div className="space-y-2">
                {traces.map((attachment) => (
                  <div
                    key={attachment.path}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(attachment.size)} · Playwright Trace
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyTraceCommand(attachment)}
                      >
                        {copiedTrace === attachment.path ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                        {copiedTrace === attachment.path ? "Copiado" : "Copiar comando"}
                      </Button>
                      <a href={attachment.path} download>
                        <Button variant="outline" size="sm">
                          <Download className="size-3.5" /> Baixar
                        </Button>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {files.length ? (
            <section>
              <h3 className="mb-3 font-semibold">Outros arquivos</h3>
              {files.map((attachment) => (
                <a
                  key={attachment.path}
                  href={attachment.path}
                  download
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                >
                  <span>{attachment.name}</span>
                  <Badge variant="outline">{formatBytes(attachment.size)}</Badge>
                </a>
              ))}
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="steps">
          {test.steps.length ? (
            <StepTree steps={test.steps} />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma etapa registrada.</p>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(lightbox)} onOpenChange={(open) => !open && setLightbox(undefined)}>
        <DialogContent>
          {lightbox ? (
            <>
              <DialogTitle>{lightbox.name}</DialogTitle>
              <DialogDescription>
                {formatBytes(lightbox.size)} · clique fora ou pressione Esc para fechar
              </DialogDescription>
              <img
                src={lightbox.path}
                alt={lightbox.name}
                className="mt-4 max-h-[78vh] w-full rounded-lg bg-muted object-contain"
              />
              <div className="mt-3 flex justify-end">
                <a href={lightbox.path} download>
                  <Button variant="outline" size="sm">
                    <Download className="size-3.5" /> Baixar screenshot
                  </Button>
                </a>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TestRow({ test, onSelect }: { test: ReportTest; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-4 border-t px-4 py-3 text-left transition first:border-t-0 hover:bg-muted/70"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={outcomeVariant(test.outcome)}>{outcomeLabels[test.outcome]}</Badge>
          <p className="truncate text-sm font-medium">{test.title}</p>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {test.file}:{test.line}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        <span className="text-xs text-muted-foreground">
          {formatDuration(test.duration)}
        </span>
        {test.attachments.length ? (
          <Badge variant="outline">{test.attachments.length} evidências</Badge>
        ) : null}
      </div>
    </button>
  );
}

export function App() {
  const [report, setReport] = useState<PortalReport>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [project, setProject] = useState("all");
  const [selected, setSelected] = useState<ReportTest>();
  const [dark, setDark] = useState(
    () => localStorage.getItem("portal-report-theme") === "dark",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("portal-report-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    fetch("./report-data.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<PortalReport>;
      })
      .then(setReport)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Falha ao carregar o relatório",
        ),
      );
  }, []);

  const projects = useMemo(
    () => [...new Set(report?.tests.map((test) => test.project) ?? [])].sort(),
    [report],
  );

  const filteredTests = useMemo(
    () =>
      report?.tests.filter((test) => {
        const searchable = `${test.title} ${test.file} ${test.project} ${test.tags.join(" ")}`.toLowerCase();
        return (
          searchable.includes(query.toLowerCase()) &&
          (outcome === "all" || test.outcome === outcome) &&
          (project === "all" || test.project === project)
        );
      }) ?? [],
    [outcome, project, query, report],
  );

  const groupedTests = useMemo(() => {
    const projectGroups = new Map<string, Map<string, ReportTest[]>>();
    for (const test of filteredTests) {
      const domains = projectGroups.get(test.project) ?? new Map<string, ReportTest[]>();
      const domain = domainFor(test);
      domains.set(domain, [...(domains.get(domain) ?? []), test]);
      projectGroups.set(test.project, domains);
    }

    return [...projectGroups.entries()].map(([projectName, domains]) => {
      const tests = [...domains.values()].flat();
      return {
        name: projectName,
        tests,
        summary: summarize(tests),
        domains: [...domains.entries()].map(([name, domainTests]) => ({
          name,
          tests: [...domainTests].sort(
            (left, right) =>
              Number(right.outcome === "unexpected") -
              Number(left.outcome === "unexpected"),
          ),
          summary: summarize(domainTests),
        })),
      };
    });
  }, [filteredTests]);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Card className="max-w-lg">
          <CardContent>
            <CircleAlert className="mb-3 size-6 text-red-600" />
            <h1 className="font-semibold">Não foi possível abrir o relatório</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error}. Gere os dados e abra pelo servidor do projeto.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Carregando relatório…
      </main>
    );
  }

  const summaryCards = [
    { label: "Total", value: report.run.total, icon: TestTube2, tone: "text-blue-600" },
    { label: "Aprovados", value: report.summary.passed, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Falhas", value: report.summary.failed, icon: CircleAlert, tone: "text-red-600" },
    { label: "Duração", value: formatDuration(report.run.duration), icon: Clock3, tone: "text-violet-600" },
  ];

  return (
    <main className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Portal Quality
            </p>
            <h1 className="mt-1 text-lg font-semibold">Relatório Playwright</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={report.run.status === "passed" ? "success" : "destructive"}>
              {report.run.status === "passed" ? "Execução aprovada" : "Execução com falhas"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark((current) => !current)}
              aria-label="Alternar tema"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-5 py-7">
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Visão geral</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Perfil <strong>{report.run.profile}</strong> · {formatDate(report.generatedAt)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Node {report.run.node} · {report.run.platform}
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">{value}</p>
                </div>
                <div className="rounded-lg bg-muted p-2.5">
                  <Icon className={`size-5 ${tone}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_190px_190px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar teste, arquivo ou tag"
                  className="pl-9"
                />
              </div>
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Todos os resultados</option>
                <option value="expected">Aprovados</option>
                <option value="unexpected">Falhas</option>
                <option value="flaky">Instáveis</option>
                <option value="skipped">Ignorados</option>
              </select>
              <select
                value={project}
                onChange={(event) => setProject(event.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Todos os projetos</option>
                {projects.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {groupedTests.length ? (
                groupedTests.map((projectGroup) => (
                  <details
                    key={projectGroup.name}
                    open
                    className="group overflow-hidden rounded-xl border bg-card"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          <FolderOpen className="size-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{projectGroup.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {countLabel(projectGroup.tests.length, "execução", "execuções")} ·{" "}
                            {countLabel(projectGroup.domains.length, "domínio", "domínios")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {projectGroup.summary.unexpected ? (
                          <Badge variant="destructive">
                            {countLabel(projectGroup.summary.unexpected, "falha", "falhas")}
                          </Badge>
                        ) : (
                          <Badge variant="success">
                            {countLabel(projectGroup.summary.expected, "aprovado", "aprovados")}
                          </Badge>
                        )}
                        <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
                      </div>
                    </summary>
                    <div className="space-y-3 border-t bg-muted/20 p-3">
                      {projectGroup.domains.map((domain) => (
                        <section key={domain.name} className="overflow-hidden rounded-lg border bg-card">
                          <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-2.5">
                            <div>
                              <p className="text-sm font-medium capitalize">{domain.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {countLabel(domain.tests.length, "execução", "execuções")}
                              </p>
                            </div>
                            {domain.summary.unexpected ? (
                              <Badge variant="destructive">
                                {countLabel(domain.summary.unexpected, "falha", "falhas")}
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                {countLabel(domain.summary.expected, "aprovado", "aprovados")}
                              </Badge>
                            )}
                          </div>
                          {domain.tests.map((test) => (
                            <TestRow key={test.id} test={test} onSelect={() => setSelected(test)} />
                          ))}
                        </section>
                      ))}
                    </div>
                  </details>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                  Nenhum teste encontrado com esses filtros.
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Exibindo {filteredTests.length} de {report.tests.length} execuções.
            </p>
          </CardContent>
        </Card>
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(undefined);
        }}
      >
        <SheetContent>
          {selected ? (
            <>
              <SheetTitle>{selected.title}</SheetTitle>
              <SheetDescription>
                {selected.titlePath.slice(0, -1).join(" › ")}
              </SheetDescription>
              <div className="mt-5">
                <TestDetails test={selected} />
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
