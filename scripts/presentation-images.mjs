#!/usr/bin/env node
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FAL_MODEL = "fal-ai/nano-banana-2";
const EDITORIAL_SCENE_STYLE_PROMPT =
  "CREATE A HAND-DRAWN ISOMETRIC SCHEMATIC DIAGRAM OF THE CLIENT'S BUSINESS CONTEXT. USE THE PRESENTATION BRAND PALETTE SO THE IMAGE FEELS SEAMLESS WITH THE SLIDES: PURE WHITE BACKGROUND (#FFFFFF), NEAR-BLACK INK (#0A0A0A), PRIMARY TEXT/LINE BLACK (#171717), HAIRLINE GREY (#E5E5E5), AND VIVID IMAGINARY SPACE ORANGE (#F05100) AS THE ONLY ACCENT. RENDER ONLY 2-3 CLEAR SCHEMATIC ASSETS, CLEANLY AND CONFIDENTLY, WITH LOTS OF NEGATIVE SPACE. THE ASSETS SHOULD BE SIMPLE ISOMETRIC OBJECTS, MINIATURE SYSTEM DIAGRAMS, PAPER STACKS, MAP TILES, ABSTRACT DATA FLOWS, TOOL-LIKE OBJECTS, OR ARCHITECTURAL MINIATURES RELATED TO THE CLIENT'S DOMAIN. HAND-DRAWN BUT POLISHED: THIN INK LINES, SLIGHTLY IMPERFECT SKETCH GEOMETRY, SOFT PAPER TEXTURE, SUBTLE SHADOWS, LIGHT ISOMETRIC DEPTH, MINIMAL FILL COLORS. DO NOT CREATE A BUSY SCENE, ROOM, DASHBOARD, CITY, COLLAGE, CROWD, OR COMPLEX ENVIRONMENT. DO NOT INCLUDE PEOPLE, FACES, BODIES, HUMAN FIGURES, HUMANOID ROBOTS, MASCOTS, OR PORTRAITS. NO TEXT, NO LETTERS, NO NUMBERS, NO LOGOS, NO SIGNAGE, NO READABLE UI. IF THE CONCEPT NEEDS LABELS OR DOCUMENTS, REPRESENT THEM AS BLANK LINES, ABSTRACT GLYPHS, OR UNREADABLE MARKS ONLY.";
const OPENING_SCENE_THEME =
  "OPENING THEME: SHOW ENERGY AND LAUNCH MOMENTUM USING EXACTLY 2-3 HAND-DRAWN ISOMETRIC SCHEMATIC ASSETS. CHOOSE SIMPLE SYMBOLIC OBJECTS FROM THE CLIENT'S BUSINESS DOMAIN AND ARRANGE THEM LIKE A CLEAN SYSTEM MAP. USE ONE ORANGE #F05100 PATH, ARROW, OR SIGNAL LINE TO SUGGEST STARTING MOTION.";
const CLOSING_SCENE_THEME =
  "CLOSING THEME: COMMUNICATE 'LET'S GET TO WORK' WITHOUT USING TEXT, USING EXACTLY 2-3 HAND-DRAWN ISOMETRIC SCHEMATIC ASSETS. SHOW READINESS AND PRACTICAL MOMENTUM: ORGANIZED MATERIALS, A SIMPLE TOOL-LIKE OBJECT, AND A CLEAR FORWARD PATH. USE ONE ORANGE #F05100 PATH OR CHECKPOINT MARK TO SUGGEST WORK MOVING FORWARD.";

function usage() {
  return `usage:
  node scripts/presentation-images.mjs prompts <deck.json> [--json] [--client-context <text>|--client-context-file <path>]
  node scripts/presentation-images.mjs generate <deck.json> [--slot cover|closing|both] [--model ${DEFAULT_FAL_MODEL}] [--client-context <text>|--client-context-file <path>] [--out <deck.json>]
  node scripts/presentation-images.mjs attach <deck.json> --cover <path-or-url> --closing <path-or-url> [--cover-prompt <text>] [--closing-prompt <text>] [--out <deck.json>]

Examples:
  node scripts/presentation-images.mjs prompts out/client-2026-04-30.json
  node scripts/presentation-images.mjs generate out/client-2026-04-30.json
  node scripts/presentation-images.mjs attach out/client-2026-04-30.json --cover /tmp/cover.png --closing /tmp/closing.png
`;
}

function resolveFromRoot(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

async function readDeck(deckPath) {
  return JSON.parse(await readFile(deckPath, "utf8"));
}

async function readOptionalTextFile(value) {
  if (!value) {
    return "";
  }
  return readFile(resolveFromRoot(String(value)), "utf8");
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  const text = cleanText(value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function trimTerminalPunctuation(value) {
  return cleanText(value).replace(/[.!?]+$/g, "");
}

function firstPresent(...values) {
  return values.map(cleanText).find(Boolean) || "";
}

async function clientContextFromFlags(flags) {
  const inline = cleanText(flags["client-context"]);
  const fromFile = cleanText(await readOptionalTextFile(flags["client-context-file"]));
  return firstPresent(inline, fromFile);
}

function inferredClientContext(deck) {
  const explicit = firstPresent(
    deck.client_context,
    deck.clientContext,
    deck.project_context,
    deck.projectContext,
    deck.business_context,
    deck.businessContext,
    deck.client?.context,
    deck.client?.description,
    deck.client?.business,
    deck.client?.industry,
  );
  if (explicit) {
    return explicit;
  }

  const workstreamDetails = (deck.workstreams_data?.workstreams || [])
    .flatMap((w) => [w.name, w.impact])
    .filter(Boolean)
    .slice(0, 8);
  const asks = (deck.asks_data?.asks || [])
    .flatMap((ask) => [ask.ask, ask.detail])
    .filter(Boolean)
    .slice(0, 6);
  const actions = (deck.actions_data?.actions || [])
    .map((action) => action.task)
    .filter(Boolean)
    .slice(0, 4);
  const timelineTasks = (deck.timeline_data?.sections || [])
    .flatMap((section) => section.tasks || [])
    .map((task) => task.name)
    .filter(Boolean)
    .slice(0, 6);

  const parts = [
    deck.timeline_data?.title,
    deck.workstreams_data?.title,
    ...workstreamDetails,
    ...asks,
    ...actions,
    ...timelineTasks,
  ].filter(Boolean);

  return truncateText(parts.join("; "), 700);
}

function deckContext(deck, clientContext) {
  const client = deck.client?.company || deck.client?.name || deck.title || "the client";
  return {
    client,
    clientBusinessContext: truncateText(clientContext || inferredClientContext(deck), 900),
  };
}

function buildPrompts(deck, clientContext = "") {
  const { client, clientBusinessContext } = deckContext(deck, clientContext);
  const contextBlock = [
    `CLIENT NAME: ${client}.`,
    clientBusinessContext
      ? `CLIENT BUSINESS CONTEXT: ${trimTerminalPunctuation(clientBusinessContext)}.`
      : "CLIENT BUSINESS CONTEXT: Infer from the deck JSON.",
  ].join(" ");
  const basePrompt = `${contextBlock}\n\n${EDITORIAL_SCENE_STYLE_PROMPT}`;

  return {
    cover: {
      prompt: `${basePrompt}\n\n${OPENING_SCENE_THEME}`,
    },
    closing: {
      prompt: `${basePrompt}\n\n${CLOSING_SCENE_THEME}`,
    },
  };
}

function isRemoteOrData(value) {
  return /^(https?:|data:)/i.test(value);
}

function extensionForAsset(value) {
  const clean = value.startsWith("file:") ? fileURLToPath(value) : value;
  const ext = path.extname(clean).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) {
    return ext;
  }
  return ".png";
}

function extFromContentType(contentType) {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (normalized === "image/jpeg") return ".jpg";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "image/gif") return ".gif";
  return ".png";
}

function falApiKey() {
  return process.env.FAL_AI_API_KEY || process.env.FAL_KEY || "";
}

function falHeaders(apiKey) {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function readJsonResponse(response, label) {
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    const detail = parsed?.detail || parsed?.message || parsed?.error || text;
    throw new Error(`${label} failed (${response.status}): ${detail}`);
  }

  return parsed;
}

function negativePrompt() {
  return [
    "people",
    "person",
    "face",
    "portrait",
    "human",
    "humanoid",
    "robot character",
    "mascot",
    "crowd",
    "city skyline",
    "complex dashboard",
    "busy scene",
    "text",
    "letters",
    "numbers",
    "logo",
    "signage",
    "watermark",
  ].join(", ");
}

function falInputForModel(model, prompt) {
  if (model.includes("nano-banana-2")) {
    return {
      prompt,
      num_images: 1,
      aspect_ratio: "16:9",
      output_format: "png",
      safety_tolerance: "4",
      resolution: "1K",
      limit_generations: true,
      enable_web_search: false,
    };
  }

  if (model.includes("recraft")) {
    return {
      prompt,
      image_size: "landscape_16_9",
      colors: [
        { r: 0, g: 51, b: 160 },
        { r: 102, g: 204, b: 255 },
        { r: 240, g: 81, b: 0 },
        { r: 255, g: 255, b: 255 },
      ],
      enable_safety_checker: true,
    };
  }

  if (model.includes("ideogram")) {
    return {
      prompt,
      aspect_ratio: "16:9",
      expand_prompt: false,
      style: "render_3D",
      negative_prompt: negativePrompt(),
    };
  }

  if (model.includes("flux-2")) {
    return {
      prompt,
      image_size: "landscape_16_9",
      output_format: "png",
      safety_tolerance: "2",
    };
  }

  return {
    prompt,
    aspect_ratio: "16:9",
    num_images: 1,
  };
}

async function submitFalRequest({ model, prompt, apiKey }) {
  const response = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: falHeaders(apiKey),
    body: JSON.stringify(falInputForModel(model, prompt)),
  });

  return readJsonResponse(response, "FAL submit");
}

async function pollFalRequest({ model, submitResult, apiKey, timeoutMs, pollMs }) {
  const started = Date.now();
  const requestId = submitResult.request_id || submitResult.requestId;
  const statusUrl =
    submitResult.status_url ||
    submitResult.statusUrl ||
    (requestId ? `https://queue.fal.run/${model}/requests/${requestId}/status` : null);
  const responseUrl =
    submitResult.response_url ||
    submitResult.responseUrl ||
    (requestId ? `https://queue.fal.run/${model}/requests/${requestId}` : null);

  if (!statusUrl || !responseUrl) {
    throw new Error("FAL submit response did not include status/result URLs");
  }

  while (Date.now() - started < timeoutMs) {
    const statusResponse = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    const status = await readJsonResponse(statusResponse, "FAL status");
    const state = String(status.status || status.state || "").toUpperCase();

    if (state === "COMPLETED") {
      const resultResponse = await fetch(responseUrl, {
        headers: { Authorization: `Key ${apiKey}` },
      });
      return readJsonResponse(resultResponse, "FAL result");
    }
    if (["FAILED", "ERROR", "CANCELLED"].includes(state)) {
      throw new Error(`FAL request ${requestId || ""} ${state.toLowerCase()}: ${JSON.stringify(status)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Timed out waiting for FAL request after ${timeoutMs}ms`);
}

function firstImageUrl(result) {
  const data = result?.data || result;
  const image = data?.images?.[0] || data?.image;
  const url = typeof image === "string" ? image : image?.url;
  if (!url) {
    throw new Error(`FAL result did not include an image URL: ${JSON.stringify(result).slice(0, 500)}`);
  }
  return url;
}

async function downloadImage(url, destBase) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed (${response.status}): ${url}`);
  }
  const contentType = response.headers.get("content-type") || "image/png";
  const ext = extFromContentType(contentType);
  const dest = `${destBase}${ext}`;
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(dest, bytes);
  return { path: dest, ext };
}

async function assetRef(deckPath, source, slot) {
  if (isRemoteOrData(source)) {
    return source;
  }

  const deckDir = path.dirname(deckPath);
  const deckBase = path.basename(deckPath, path.extname(deckPath));
  const assetDirName = `${deckBase}-assets`;
  const assetDir = path.join(deckDir, assetDirName);
  const sourcePath = source.startsWith("file:") ? fileURLToPath(source) : resolveFromRoot(source);
  const ext = extensionForAsset(sourcePath);
  const dest = path.join(assetDir, `${slot}${ext}`);

  await mkdir(assetDir, { recursive: true });
  await copyFile(sourcePath, dest);

  return `./${assetDirName}/${slot}${ext}`;
}

function assetPaths(deckPath, slot) {
  const deckDir = path.dirname(deckPath);
  const deckBase = path.basename(deckPath, path.extname(deckPath));
  const assetDirName = `${deckBase}-assets`;
  const assetDir = path.join(deckDir, assetDirName);
  return {
    assetDir,
    refBase: `./${assetDirName}/${slot}`,
    destBase: path.join(assetDir, slot),
  };
}

async function runPrompts(deckPath, flags) {
  const deck = await readDeck(deckPath);
  const prompts = buildPrompts(deck, await clientContextFromFlags(flags));
  if (flags.json) {
    console.log(JSON.stringify(prompts, null, 2));
    return;
  }

  console.log("Cover image prompt:\n");
  console.log(prompts.cover.prompt);
  console.log("\nClosing image prompt:\n");
  console.log(prompts.closing.prompt);
}

async function runAttach(deckPath, flags) {
  if (!flags.cover && !flags.closing) {
    throw new Error("attach requires --cover and/or --closing");
  }

  const deck = await readDeck(deckPath);
  const prompts = buildPrompts(deck, await clientContextFromFlags(flags));
  const outPath = flags.out ? resolveFromRoot(String(flags.out)) : deckPath;

  deck.cover_data = deck.cover_data || {};
  deck.closing_data = deck.closing_data || {};

  if (flags.cover) {
    deck.cover_data.coverImageUrl = await assetRef(deckPath, String(flags.cover), "cover");
    deck.cover_data.coverImagePrompt = String(flags["cover-prompt"] || prompts.cover.prompt);
  }

  if (flags.closing) {
    deck.closing_data.closingImageUrl = await assetRef(deckPath, String(flags.closing), "closing");
    deck.closing_data.closingImagePrompt = String(flags["closing-prompt"] || prompts.closing.prompt);
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(deck, null, 2)}\n`, "utf8");
  console.log(`[presentation-images] wrote ${outPath}`);
  if (flags.cover) console.log(`[presentation-images] cover: ${deck.cover_data.coverImageUrl}`);
  if (flags.closing) console.log(`[presentation-images] closing: ${deck.closing_data.closingImageUrl}`);
}

async function generateSlot({ deckPath, deck, prompts, slot, flags, apiKey }) {
  const model = String(flags.model || DEFAULT_FAL_MODEL);
  const timeoutMs = Number(flags["timeout-ms"] || 180000);
  const pollMs = Number(flags["poll-ms"] || 3000);
  const prompt = String(flags[`${slot}-prompt`] || prompts[slot].prompt);

  console.log(`[presentation-images] generating ${slot} via ${model}`);
  const submitResult = await submitFalRequest({ model, prompt, apiKey });
  const result = await pollFalRequest({ model, submitResult, apiKey, timeoutMs, pollMs });
  const url = firstImageUrl(result);

  const { assetDir, destBase, refBase } = assetPaths(deckPath, slot);
  await mkdir(assetDir, { recursive: true });
  const downloaded = await downloadImage(url, destBase);
  const ref = `${refBase}${downloaded.ext}`;

  if (slot === "cover") {
    deck.cover_data.coverImageUrl = ref;
    deck.cover_data.coverImagePrompt = prompt;
  } else {
    deck.closing_data.closingImageUrl = ref;
    deck.closing_data.closingImagePrompt = prompt;
  }

  console.log(`[presentation-images] ${slot}: ${ref}`);
}

async function runGenerate(deckPath, flags) {
  const apiKey = falApiKey();
  if (!apiKey) {
    throw new Error("Missing FAL_AI_API_KEY or FAL_KEY in the environment");
  }

  const slot = String(flags.slot || "both").toLowerCase();
  const slots =
    slot === "both" ? ["cover", "closing"] : slot === "cover" || slot === "closing" ? [slot] : null;
  if (!slots) {
    throw new Error("--slot must be one of: cover, closing, both");
  }

  const deck = await readDeck(deckPath);
  const prompts = buildPrompts(deck, await clientContextFromFlags(flags));
  const outPath = flags.out ? resolveFromRoot(String(flags.out)) : deckPath;

  deck.cover_data = deck.cover_data || {};
  deck.closing_data = deck.closing_data || {};

  for (const slotName of slots) {
    await generateSlot({ deckPath, deck, prompts, slot: slotName, flags, apiKey });
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(deck, null, 2)}\n`, "utf8");
  console.log(`[presentation-images] wrote ${outPath}`);
}

async function main() {
  const [command, deckArg, ...rest] = process.argv.slice(2);
  if (!command || !deckArg || command === "--help" || command === "-h") {
    console.log(usage());
    process.exitCode = command ? 0 : 1;
    return;
  }

  const deckPath = resolveFromRoot(deckArg);
  const flags = parseFlags(rest);

  if (command === "prompts") {
    await runPrompts(deckPath, flags);
    return;
  }
  if (command === "generate") {
    await runGenerate(deckPath, flags);
    return;
  }
  if (command === "attach") {
    await runAttach(deckPath, flags);
    return;
  }

  throw new Error(`Unknown command: ${command}\n${usage()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
