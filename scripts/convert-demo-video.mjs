import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve(
  "demo-results/videos/apresentacao-simulador.webm",
);
const destination = resolve(
  "demo-results/videos/apresentacao-simulador.mp4",
);
const timelinePath = resolve(
  "demo-results/videos/apresentacao-simulador-timeline.json",
);
const maximumIntervalSeconds = 5;

if (!existsSync(source)) {
  console.error(`Vídeo WebM não encontrado: ${source}`);
  process.exit(1);
}

const availability = spawnSync("ffmpeg", ["-version"], {
  stdio: "ignore",
});

if (availability.error?.code === "ENOENT") {
  console.error(
    "FFmpeg não está instalado no PATH. No macOS, execute: brew install ffmpeg",
  );
  process.exit(1);
}
if (availability.status !== 0) {
  console.error("O FFmpeg instalado não pôde ser executado.");
  process.exit(1);
}

const probeAvailability = spawnSync("ffprobe", ["-version"], {
  stdio: "ignore",
});

if (probeAvailability.error?.code === "ENOENT" || probeAvailability.status !== 0) {
  console.error(
    "FFprobe não está disponível no PATH. No macOS, execute: brew install ffmpeg",
  );
  process.exit(1);
}

function readDuration(path) {
  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      path,
    ],
    { encoding: "utf8" },
  );

  if (probe.error) throw probe.error;
  if (probe.status !== 0) {
    console.error(`Não foi possível validar a duração de ${path}.`);
    process.exit(probe.status ?? 1);
  }

  return Number.parseFloat(probe.stdout.trim());
}

function buildPresentationFilter(duration, clicks) {
  const boundaries = [
    0,
    ...clicks
      .filter((second) => Number.isFinite(second) && second > 0 && second < duration)
      .sort((left, right) => left - right),
    duration,
  ].filter((second, index, values) => index === 0 || second - values[index - 1] > 0.01);
  const filters = [];
  const labels = [];
  let presentationDuration = 0;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const interval = end - start;
    const visibleInterval = Math.min(interval, maximumIntervalSeconds);
    const speedFactor = visibleInterval / interval;
    const label = `segment${index}`;
    filters.push(
      `[0:v]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=${speedFactor.toFixed(6)}*(PTS-STARTPTS)[${label}]`,
    );
    labels.push(`[${label}]`);
    presentationDuration += visibleInterval;
  }

  filters.push(
    `${labels.join("")}concat=n=${labels.length}:v=1:a=0,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,fps=25[video]`,
  );

  return {
    filter: filters.join(";"),
    presentationDuration,
  };
}

const sourceDuration = readDuration(source);
const clickTimeline = existsSync(timelinePath)
  ? JSON.parse(readFileSync(timelinePath, "utf8")).clicks
  : undefined;
const presentation = Array.isArray(clickTimeline)
  ? buildPresentationFilter(sourceDuration, clickTimeline)
  : undefined;

const videoSelection = presentation
  ? ["-filter_complex", presentation.filter, "-map", "[video]"]
  : [
      "-map",
      "0:v:0",
      "-vf",
      "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,fps=25",
    ];

const conversion = spawnSync(
  "ffmpeg",
  [
    "-fflags",
    "+genpts",
    "-i",
    source,
    ...videoSelection,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-tag:v",
    "avc1",
    "-fps_mode",
    "cfr",
    "-avoid_negative_ts",
    "make_zero",
    "-movflags",
    "+faststart",
    "-y",
    destination,
  ],
  { stdio: "inherit" },
);

if (conversion.error) throw conversion.error;
if (conversion.status !== 0) {
  console.error("A conversão do vídeo para MP4 falhou.");
  process.exit(conversion.status ?? 1);
}

function readFrameCount(path) {
  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-count_frames",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=nb_read_frames",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      path,
    ],
    { encoding: "utf8" },
  );

  if (probe.error) throw probe.error;
  if (probe.status !== 0) {
    console.error(`Não foi possível validar os frames de ${path}.`);
    process.exit(probe.status ?? 1);
  }

  return Number.parseInt(probe.stdout.trim(), 10);
}

const sourceFrames = readFrameCount(source);
const destinationFrames = readFrameCount(destination);
const destinationDuration = readDuration(destination);

if (!presentation && sourceFrames !== destinationFrames) {
  console.error(
    `Conversão incompleta: WebM possui ${sourceFrames} frames e MP4 possui ${destinationFrames}.`,
  );
  process.exit(1);
}

if (
  presentation &&
  Math.abs(destinationDuration - presentation.presentationDuration) > 0.2
) {
  console.error(
    `Conversão dinâmica inconsistente: esperava ${presentation.presentationDuration.toFixed(2)}s e recebeu ${destinationDuration.toFixed(2)}s.`,
  );
  process.exit(1);
}

if (presentation) {
  console.log(
    `MP4 dinâmico: ${destination} (${sourceDuration.toFixed(2)}s integrais condensados em ${destinationDuration.toFixed(2)}s; intervalos limitados a ${maximumIntervalSeconds}s)`,
  );
} else {
  console.log(
    `MP4 para compartilhamento: ${destination} (${destinationFrames} frames preservados)`,
  );
}
