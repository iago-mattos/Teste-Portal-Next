import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const outputRoot = resolve("demo-results/test-results");
const destination = resolve(
  "demo-results/videos/apresentacao-simulador.webm",
);
const timeline = resolve(
  "demo-results/videos/apresentacao-simulador-timeline.json",
);
const startedAt = Date.now();

function findVideos(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return findVideos(path);
      return entry.isFile() && entry.name.endsWith(".webm") ? [path] : [];
    });
  } catch {
    return [];
  }
}

rmSync(destination, { force: true });
rmSync(timeline, { force: true });

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    "--config=playwright.demo.config.ts",
    "--project=demo-simulador",
    "--headed",
    "--workers=1",
  ],
  { env: process.env, stdio: "inherit" },
);

if (result.error) throw result.error;

const video = findVideos(outputRoot)
  .filter((path) => statSync(path).mtimeMs >= startedAt - 1_000)
  .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];

if (!video) {
  console.error("A execução não produziu o vídeo esperado da demonstração.");
  process.exitCode = result.status ?? 1;
} else {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(video, destination);
  console.log(`Vídeo da demonstração: ${destination}`);
  process.exitCode = result.status ?? 1;
}
