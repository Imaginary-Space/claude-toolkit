#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import type { CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ClosingSlide,
  CoverSlide,
  DevUpdatesSlide,
  RecapSlide,
  SprintScopeSlide,
  TimelineSlide,
  VelocitySlide,
} from "./index";
import type { CornerLabels, Presentation } from "./types/presentation";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

interface CliOptions {
  inputPath: string;
  outputPath: string;
  htmlPath?: string;
}

function usage(): string {
  return [
    "usage:",
    "  presentation-kit render <input.json> --out <output.pdf> [--html <output.html>]",
    "  tsx src/cli.tsx <input.json> --out <output.pdf> [--html <output.html>]",
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions {
  const args = [...argv];
  if (args[0] === "render") {
    args.shift();
  }

  const inputPath = args.shift();
  if (!inputPath || inputPath.startsWith("-")) {
    throw new Error(usage());
  }

  let outputPath = "";
  let htmlPath: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--out" || arg === "-o") {
      outputPath = args[++i] ?? "";
    } else if (arg === "--html") {
      htmlPath = args[++i];
    } else {
      throw new Error(`Unknown argument: ${arg}\n${usage()}`);
    }
  }

  if (!outputPath) {
    throw new Error(`Missing --out <output.pdf>\n${usage()}`);
  }

  return {
    inputPath: path.resolve(inputPath),
    outputPath: path.resolve(outputPath),
    htmlPath: htmlPath ? path.resolve(htmlPath) : undefined,
  };
}

async function readPresentation(inputPath: string): Promise<Presentation> {
  const raw = await readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw) as Presentation;
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Expected ${inputPath} to contain a Presentation JSON object`);
  }
  return parsed;
}

function hasRenderableData(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(hasRenderableData);
  }
  if (typeof value === "object") {
    return Object.values(value).some(hasRenderableData);
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

function cornersFor(presentation: Presentation): CornerLabels {
  const clientName =
    presentation.client?.company?.trim() ||
    presentation.client?.name?.trim() ||
    presentation.title;
  return {
    tl: "Imaginary Space",
    tr: presentation.meeting_date ?? new Date().toISOString().slice(0, 10),
    bl: clientName,
    br: presentation.cycle_name ?? presentation.sprint_name ?? presentation.meeting_type ?? "Presentation",
  };
}

function Deck({ presentation }: { presentation: Presentation }) {
  const corners = cornersFor(presentation);
  const slides = [
    hasRenderableData(presentation.cover_data) ? (
      <CoverSlide key="cover" data={presentation.cover_data} corners={corners} active />
    ) : null,
    hasRenderableData(presentation.timeline_data) ? (
      <TimelineSlide key="timeline" data={presentation.timeline_data} corners={corners} active />
    ) : null,
    hasRenderableData(presentation.velocity_data) ? (
      <VelocitySlide key="velocity" data={presentation.velocity_data} corners={corners} active />
    ) : null,
    hasRenderableData(presentation.sprint_scope_data) ? (
      <SprintScopeSlide key="sprint-scope" data={presentation.sprint_scope_data} corners={corners} active />
    ) : null,
    hasRenderableData(presentation.recap_data) ? (
      <RecapSlide key="recap" data={presentation.recap_data} corners={corners} active />
    ) : null,
    hasRenderableData(presentation.dev_updates_data) ? (
      <DevUpdatesSlide key="dev-updates" data={presentation.dev_updates_data} corners={corners} />
    ) : null,
    hasRenderableData(presentation.closing_data) ? (
      <ClosingSlide key="closing" data={presentation.closing_data} corners={corners} active />
    ) : null,
  ].filter(Boolean);

  if (slides.length === 0) {
    throw new Error("Presentation JSON did not contain any renderable slide data");
  }

  return (
    <main className="ims-presentation" style={{ "--scale": "1" } as CSSProperties}>
      {slides}
    </main>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function buildHtml(presentation: Presentation): Promise<string> {
  const [presentationCss, fontCss] = await Promise.all([
    readFile(path.join(ROOT, "styles", "presentations.css"), "utf8"),
    readFile(path.join(ROOT, "styles", "fonts.css"), "utf8"),
  ]);
  const markup = renderToStaticMarkup(<Deck presentation={presentation} />);
  const title = escapeHtml(presentation.title || "Presentation");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=${SLIDE_WIDTH}, initial-scale=1" />
    <title>${title}</title>
    <style>
${fontCss}
${presentationCss}
@page { size: ${SLIDE_WIDTH}px ${SLIDE_HEIGHT}px; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.ims-presentation { display: block; width: ${SLIDE_WIDTH}px; }
.ims-presentation .slide { page-break-after: always; break-after: page; margin-bottom: 0; }
.ims-presentation .slide:last-child { page-break-after: auto; break-after: auto; }
    </style>
  </head>
  <body>
    ${markup}
  </body>
</html>
`;
}

async function renderPdf(htmlPath: string, outputPath: string): Promise<void> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      width: `${SLIDE_WIDTH}px`,
      height: `${SLIDE_HEIGHT}px`,
    });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const presentation = await readPresentation(options.inputPath);
  const html = await buildHtml(presentation);
  const htmlPath =
    options.htmlPath ?? options.outputPath.replace(/\.pdf$/i, "") + ".html";

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await mkdir(path.dirname(htmlPath), { recursive: true });
  await writeFile(htmlPath, html, "utf8");
  await renderPdf(htmlPath, options.outputPath);

  console.log(`[presentation-kit] wrote ${options.outputPath}`);
  console.log(`[presentation-kit] wrote ${htmlPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
