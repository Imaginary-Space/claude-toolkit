import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cornersFor, footerLabelFor, hasRenderableData } from "../deckModel";
import { BRAND, PPTX_HEIGHT, PPTX_WIDTH, SLIDE_HEIGHT, SLIDE_WIDTH, fitText, pt } from "../layout";
import { TypeScale, type TypeRoleName } from "../typeScale";
import type { AskGroup, CornerLabels, Presentation, TimelineData } from "../types/presentation";
import { formatPresentationDisplayTitle } from "../utils/presentation-title";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SLIDES_SCOPE = "https://www.googleapis.com/auth/presentations";
const PRESENTATION_MIME = "application/vnd.google-apps.presentation";

type SlidesRequest = Record<string, unknown>;

interface Dimension {
  magnitude: number;
  unit: "PT";
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RenderContext {
  token: string;
  presentationId: string;
  pageWidth: number;
  pageHeight: number;
  sx: number;
  sy: number;
  requests: SlidesRequest[];
  objectCounter: number;
  imageParentId?: string;
}

interface TextOptions extends Rect {
  fontSize?: number;
  color?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "mid" | "bottom";
  maxLines?: number;
  fitSafety?: number;
  fitValue?: unknown;
  allowGrow?: boolean;
  wrap?: boolean;
}

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

interface GoogleSlidesRenderOptions {
  parentId?: string;
  title?: string;
}

export interface GoogleSlidesRenderResult {
  id: string;
  name: string;
  webViewLink: string;
  slideCount: number;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return clean(value).toUpperCase();
}

function maxItems<T>(items: T[], count: number): T[] {
  return items.slice(0, Math.max(count, 0));
}

function dim(value: number): Dimension {
  return { magnitude: value, unit: "PT" };
}

function color(hex: string, alpha = 1): Record<string, unknown> {
  const raw = hex.replace(/^#/, "");
  const n = Number.parseInt(raw, 16);
  return {
    color: {
      rgbColor: {
        red: ((n >> 16) & 255) / 255,
        green: ((n >> 8) & 255) / 255,
        blue: (n & 255) / 255,
      },
    },
    alpha,
  };
}

function transform(rect: Rect): Record<string, unknown> {
  return {
    scaleX: 1,
    scaleY: 1,
    translateX: rect.x,
    translateY: rect.y,
    unit: "PT",
  };
}

function elementProperties(pageObjectId: string, rect: Rect): Record<string, unknown> {
  return {
    pageObjectId,
    size: { width: dim(rect.w), height: dim(rect.h) },
    transform: transform(rect),
  };
}

function createObjectId(ctx: RenderContext, prefix: string): string {
  ctx.objectCounter += 1;
  return `ims_${prefix}_${ctx.objectCounter}`;
}

function px(ctx: RenderContext, value: number): number {
  return value * ctx.sx;
}

function rectPx(ctx: RenderContext, rect: Rect): Rect {
  return {
    x: rect.x * ctx.sx,
    y: rect.y * ctx.sy,
    w: rect.w * ctx.sx,
    h: rect.h * ctx.sy,
  };
}

function addShapeFillAndLine(
  ctx: RenderContext,
  objectId: string,
  fill: string,
  line = fill,
  fillAlpha = 1,
  lineAlpha = line === fill ? 0 : 1,
): void {
  ctx.requests.push({
    updateShapeProperties: {
      objectId,
      shapeProperties: {
        shapeBackgroundFill: { solidFill: color(fill, fillAlpha) },
        outline:
          lineAlpha <= 0
            ? { propertyState: "NOT_RENDERED" }
            : { outlineFill: { solidFill: color(line, lineAlpha) }, weight: dim(0.75) },
      },
      fields: "shapeBackgroundFill.solidFill,outline",
    },
  });
}

function addRect(ctx: RenderContext, slideId: string, rect: Rect, fill: string, line = fill, transparency = 0): void {
  const objectId = createObjectId(ctx, "rect");
  ctx.requests.push({
    createShape: {
      objectId,
      shapeType: "RECTANGLE",
      elementProperties: elementProperties(slideId, rect),
    },
  });
  addShapeFillAndLine(ctx, objectId, fill, line, 1 - transparency / 100, line === fill ? 0 : 1);
}

function addEllipse(ctx: RenderContext, slideId: string, rect: Rect, fill: string, line = fill): void {
  const objectId = createObjectId(ctx, "ellipse");
  ctx.requests.push({
    createShape: {
      objectId,
      shapeType: "ELLIPSE",
      elementProperties: elementProperties(slideId, rect),
    },
  });
  addShapeFillAndLine(ctx, objectId, fill, line, 1, line === fill ? 0 : 1);
}

function addLine(
  ctx: RenderContext,
  slideId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  lineColor: string,
): void {
  const objectId = createObjectId(ctx, "line");
  ctx.requests.push({
    createLine: {
      objectId,
      lineCategory: "STRAIGHT",
      elementProperties: elementProperties(slideId, { x, y, w: Math.max(w, 0.01), h }),
    },
  });
  ctx.requests.push({
    updateLineProperties: {
      objectId,
      lineProperties: {
        lineFill: { solidFill: color(lineColor) },
        weight: dim(0.75),
      },
      fields: "lineFill.solidFill,weight",
    },
  });
}

function roleStyle(ctx: RenderContext, name: TypeRoleName, opts: TextOptions): { fontSize: number; bold: boolean } {
  const role = TypeScale[name];
  // Google Slides font sizes are point values, but its default widescreen page
  // is 10 x 5.625in (720 x 405pt), while the PPTX renderer targets
  // 13.333 x 7.5in (960 x 540pt). Start from the PPTX type scale, then scale it
  // to the actual Slides page size so text keeps the same visual weight.
  const pageScale = Math.min(ctx.pageWidth / (PPTX_WIDTH * 72), ctx.pageHeight / (PPTX_HEIGHT * 72));
  const nominalPt = pt(role.cssPx) * pageScale;
  const minPt = nominalPt * (role.minRatio ?? 0.65);
  const maxPt = opts.allowGrow ? nominalPt * 1.5 : nominalPt;
  const maxLines = opts.maxLines ?? 1;
  let fontSize = opts.fontSize ?? nominalPt;

  if (opts.w > 0) {
    const insetSafety =
      name === "askPill" || name === "workstreamPill" || name === "heroChip" || name === "supportingChip"
        ? 0.72
        : opts.fitSafety;
    fontSize = fitText({
      text: opts.fitValue ?? "",
      widthInches: opts.w / 72,
      maxLines,
      maxFontPt: maxPt,
      minFontPt: minPt,
      charWidth: role.charWidth,
      safety: insetSafety,
      trackingPt: 0,
    });
  }

  if (opts.h > 0) {
    const heightSafety =
      name === "askPill" || name === "workstreamPill" || name === "heroChip" || name === "supportingChip"
        ? 0.72
        : 0.92;
    const heightLimitedPt = (opts.h * heightSafety) / (maxLines * role.lineHeight);
    fontSize = Math.min(fontSize, Math.max(heightLimitedPt, minPt));
  }

  return { fontSize, bold: role.weight >= 600 };
}

function addText(ctx: RenderContext, slideId: string, text: unknown, opts: TextOptions): void {
  const value = clean(text);
  if (!value) {
    return;
  }
  const objectId = createObjectId(ctx, "text");
  ctx.requests.push({
    createShape: {
      objectId,
      shapeType: "TEXT_BOX",
      elementProperties: elementProperties(slideId, opts),
    },
  });
  ctx.requests.push({
    insertText: {
      objectId,
      insertionIndex: 0,
      text: value,
    },
  });
  ctx.requests.push({
    updateShapeProperties: {
      objectId,
      shapeProperties: {
        contentAlignment: opts.valign === "mid" ? "MIDDLE" : opts.valign === "bottom" ? "BOTTOM" : "TOP",
        shapeBackgroundFill: { solidFill: color(BRAND.cream, 0) },
        outline: { propertyState: "NOT_RENDERED" },
      },
      fields: "contentAlignment,shapeBackgroundFill.solidFill,outline",
    },
  });
  ctx.requests.push({
    updateTextStyle: {
      objectId,
      style: {
        foregroundColor: { opaqueColor: color(opts.color ?? BRAND.foreground).color },
        fontSize: dim(opts.fontSize ?? 12),
        bold: opts.bold ?? false,
        weightedFontFamily: {
          fontFamily: "Funnel Display",
          weight: opts.bold ? 700 : 400,
        },
      },
      fields: "foregroundColor,fontSize,bold,weightedFontFamily",
    },
  });
  ctx.requests.push({
    updateParagraphStyle: {
      objectId,
      style: {
        alignment: opts.align === "center" ? "CENTER" : opts.align === "right" ? "END" : "START",
        lineSpacing: 100,
      },
      fields: "alignment,lineSpacing",
    },
  });
}

function addRoleText(
  ctx: RenderContext,
  slideId: string,
  text: unknown,
  role: TypeRoleName,
  rect: Rect,
  overrides: Omit<TextOptions, "x" | "y" | "w" | "h"> = {},
): void {
  const value = clean(text);
  if (!value) {
    return;
  }
  const scaled = rectPx(ctx, rect);
  const style = roleStyle(ctx, role, { ...scaled, ...overrides, fitValue: overrides.fitValue ?? value });
  addText(ctx, slideId, value, {
    ...scaled,
    ...overrides,
    fontSize: style.fontSize,
    bold: overrides.bold ?? style.bold,
  });
}

async function imageUrlFor(ctx: RenderContext, src: string): Promise<string | null> {
  const value = clean(src);
  if (!value) {
    return null;
  }
  if (/^https?:/i.test(value)) {
    return value;
  }
  if (value.startsWith("data:")) {
    return null;
  }

  const filePath = value.startsWith("file:") ? fileURLToPath(value) : path.resolve(ROOT, value);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".gif"
      ? "image/gif"
      : null;
  if (!mime || !ctx.imageParentId) {
    return null;
  }

  const uploaded = await uploadDriveFile(ctx.token, filePath, ctx.imageParentId, mime, path.basename(filePath));
  await createPublicPermission(ctx.token, uploaded.id);
  return `https://drive.google.com/uc?export=download&id=${uploaded.id}`;
}

async function addImageFrame(
  ctx: RenderContext,
  slideId: string,
  src: string | undefined,
  rect: Rect,
  dark = false,
): Promise<void> {
  const scaled = rectPx(ctx, rect);
  if (!clean(src)) {
    return;
  }
  addRect(ctx, slideId, scaled, dark ? BRAND.dark : BRAND.warm, dark ? "333333" : BRAND.mutedBorder);
  const imageUrl = await imageUrlFor(ctx, src ?? "");
  if (!imageUrl) {
    return;
  }
  ctx.requests.push({
    createImage: {
      objectId: createObjectId(ctx, "image"),
      url: imageUrl,
      elementProperties: elementProperties(slideId, scaled),
    },
  });
}

function addCorners(ctx: RenderContext, slideId: string, corners: CornerLabels, dark = false): void {
  const textColor = dark ? "FFFFFF" : BRAND.muted;
  addRoleText(ctx, slideId, upper(corners.tl ?? "Imaginary Space"), "cornerLabel", { x: 40, y: 32, w: 360, h: 24 }, { color: textColor });
  addRoleText(ctx, slideId, upper(corners.tr ?? ""), "cornerLabel", { x: 1480, y: 32, w: 400, h: 24 }, { color: textColor, align: "right" });
  addRoleText(ctx, slideId, upper(corners.bl ?? ""), "cornerLabel", { x: 40, y: 1024, w: 600, h: 24 }, { color: textColor });
  addRoleText(ctx, slideId, upper(corners.br ?? ""), "cornerLabel", { x: 1280, y: 1024, w: 600, h: 24 }, { color: textColor, align: "right" });
}

function addChrome(
  ctx: RenderContext,
  slideId: string,
  variant: "cream" | "dark",
  corners?: CornerLabels,
  showCorners = true,
): void {
  addRect(ctx, slideId, { x: 0, y: 0, w: ctx.pageWidth, h: ctx.pageHeight }, variant === "dark" ? BRAND.foreground : BRAND.cream);
  if (showCorners && corners) {
    addCorners(ctx, slideId, corners, variant === "dark");
  }
}

function addHeader(ctx: RenderContext, slideId: string, eyebrow: string, title: string, footerLabel: string): void {
  addRoleText(ctx, slideId, upper(eyebrow), "slideEyebrow", { x: 80, y: 88, w: 700, h: 22 }, { color: BRAND.accent });
  addRoleText(ctx, slideId, upper(footerLabel), "slideFooter", { x: 960, y: 88, w: 880, h: 22 }, { color: BRAND.mutedText, align: "right" });
  addLine(ctx, slideId, px(ctx, 80), px(ctx, 124), px(ctx, 1760), 0, BRAND.mutedBorder);
  addRoleText(ctx, slideId, title, "slideTitle", { x: 80, y: 138, w: 1760, h: 78 }, { color: BRAND.foreground });
}

function addCallout(ctx: RenderContext, slideId: string, label: string | undefined, text: string, yPx = 936): void {
  const y = px(ctx, yPx);
  addLine(ctx, slideId, px(ctx, 80), y, px(ctx, 1620), 0, BRAND.mutedBorder);
  addLine(ctx, slideId, px(ctx, 96), y + px(ctx, 16), 0, px(ctx, 58), BRAND.accent);
  if (label) {
    addRoleText(ctx, slideId, upper(label), "calloutLabel", { x: 128, y: yPx + 18, w: 210, h: 24 }, { color: BRAND.accent });
  }
  addRoleText(ctx, slideId, text, "calloutBody", { x: label ? 350 : 128, y: yPx + 14, w: label ? 1320 : 1535, h: 66 }, {
    color: BRAND.foreground,
    maxLines: 2,
  });
}

function addDivider(ctx: RenderContext, slideId: string, dividerColor: string): void {
  addLine(ctx, slideId, px(ctx, 960), 0, 0, px(ctx, 670), dividerColor);
  addLine(ctx, slideId, 0, px(ctx, 670), px(ctx, 1920), 0, dividerColor);
}

async function renderCover(ctx: RenderContext, slideId: string, presentation: Presentation, corners: CornerLabels): Promise<void> {
  const data = presentation.cover_data;
  addChrome(ctx, slideId, "cream", corners, true);
  await addImageFrame(ctx, slideId, data.coverImageUrl, { x: 990, y: 28, w: 902, h: 612 });
  addDivider(ctx, slideId, BRAND.mutedBorder);
  addRoleText(ctx, slideId, formatPresentationDisplayTitle(data.heroText), "coverHero", { x: 0, y: 680, w: SLIDE_WIDTH, h: 400 }, {
    color: BRAND.accent,
    align: "center",
    valign: "mid",
  });
  addRoleText(ctx, slideId, `TEAM: ${data.team ?? ""}`, "coverMeta", { x: 101, y: 360, w: 840, h: 52 });
  addRoleText(ctx, slideId, `DATE: ${data.date ?? ""}`, "coverMeta", { x: 101, y: 453, w: 840, h: 36 });
  addRoleText(ctx, slideId, `CYCLE: ${data.cycle ?? ""}`, "coverMeta", { x: 101, y: 520, w: 840, h: 36 });
}

type TimelineCell = "done" | "ongoing" | "future" | "empty";

function normalizeCell(value: string): TimelineCell {
  if (value === "done" || value === "ongoing" || value === "future" || value === "empty") {
    return value;
  }
  return "empty";
}

function trackState(cells: string[], dates: string[]) {
  const normalized = cells.map(normalizeCell);
  const ongoingIndex = normalized.indexOf("ongoing");
  const doneIndexes = normalized.map((cell, index) => (cell === "done" ? index : -1)).filter((index) => index >= 0);
  const futureIndex = normalized.indexOf("future");
  const lastDoneIndex = doneIndexes.length > 0 ? doneIndexes[doneIndexes.length - 1] : -1;
  const clamp = (index: number) => Math.min(Math.max(index, 0), Math.max(dates.length - 1, 0));

  if (ongoingIndex >= 0) return { status: "In progress", tone: "active", stage: dates[clamp(ongoingIndex)] };
  if (lastDoneIndex >= 0 && futureIndex < 0) return { status: "Complete", tone: "done", stage: dates[clamp(lastDoneIndex)] };
  if (lastDoneIndex >= 0 && futureIndex >= 0) return { status: "Next", tone: "next", stage: dates[clamp(futureIndex)] };
  if (futureIndex >= 0) return { status: "Queued", tone: "future", stage: dates[clamp(futureIndex)] };
  return { status: "Planned", tone: "future", stage: dates[0] };
}

function renderTimeline(ctx: RenderContext, slideId: string, data: TimelineData, corners: CornerLabels, footerLabel: string): void {
  addChrome(ctx, slideId, "cream", corners, false);
  addHeader(ctx, slideId, "01 · Timeline", data.title ?? "Where we are", footerLabel);

  const dates = data.dates ?? [];
  const numCols = Math.max(dates.length, 1);
  const todayCol = Math.min(Math.max(data.todayColumn ?? 0, 0), Math.max(dates.length - 1, 0));
  const tracks = (data.sections ?? []).flatMap((section) =>
    section.tasks.map((task) => ({ section: section.label, name: task.name, cells: task.cells, ...trackState(task.cells, dates) })),
  );

  const x = px(ctx, 80);
  const y = px(ctx, 252);
  const w = px(ctx, 1760);
  const introW = px(ctx, 360);
  const stateW = px(ctx, 170);
  const colGap = px(ctx, 28);
  const cellsX = x + introW + colGap;
  const cellsW = w - introW - stateW - colGap * 2;
  const colW = cellsW / numCols;
  const headerH = px(ctx, 92);

  addRect(ctx, slideId, { x, y, w, h: headerH }, BRAND.soft, BRAND.borderLight);
  addLine(ctx, slideId, x, y, w, 0, BRAND.dark);
  addLine(ctx, slideId, x, y + headerH, w, 0, BRAND.mutedBorder);
  addRoleText(ctx, slideId, "PROJECT SCOPE", "timelineHeader", { x: 98, y: 296, w: 324, h: 22 }, { color: BRAND.mutedText, valign: "mid" });
  addRoleText(ctx, slideId, "STATUS", "timelineHeader", { x: 1670, y: 296, w: 152, h: 22 }, { color: BRAND.mutedText, align: "right", valign: "mid" });

  dates.forEach((date, index) => {
    const colX = cellsX + colW * index;
    const isToday = index === todayCol;
    const tone = isToday ? BRAND.accent : index < todayCol ? BRAND.foreground : BRAND.muted;
    addEllipse(ctx, slideId, { x: colX + px(ctx, 4), y: y + px(ctx, 20), w: px(ctx, 12), h: px(ctx, 12) }, tone, tone);
    if (isToday) {
      addRoleText(ctx, slideId, "CURRENT", "timelineCurrent", { x: (colX + px(ctx, 4)) / ctx.sx, y: 282, w: (colW - px(ctx, 8)) / ctx.sx, h: 18 }, { color: BRAND.accent, valign: "mid" });
    }
    addText(ctx, slideId, date, {
      x: colX + px(ctx, 4),
      y: y + headerH - px(ctx, 54),
      w: colW - px(ctx, 8),
      h: px(ctx, 22),
      ...roleStyle(ctx, "timelineStage", { x: 0, y: 0, w: colW - px(ctx, 8), h: px(ctx, 22), fitValue: date }),
      color: BRAND.foreground,
      valign: "mid",
    });
  });

  const laneCount = Math.max(tracks.length, 1);
  const lanesY = y + headerH;
  const lanesAvailable = px(ctx, 880) - lanesY - px(ctx, 20);
  const laneH = Math.min(px(ctx, 96), Math.max(px(ctx, 64), lanesAvailable / laneCount));
  addLine(ctx, slideId, x, lanesY, w, 0, BRAND.dark);
  tracks.forEach((track, index) => {
    const rowY = lanesY + laneH * index;
    if (index > 0) {
      addLine(ctx, slideId, x, rowY, w, 0, BRAND.mutedBorder);
    }
    addText(ctx, slideId, upper(track.section), {
      x,
      y: rowY + px(ctx, 14),
      w: introW - px(ctx, 8),
      h: px(ctx, 18),
      ...roleStyle(ctx, "timelineSection", { x: 0, y: 0, w: introW - px(ctx, 8), h: px(ctx, 18), fitValue: upper(track.section) }),
      color: BRAND.accent,
    });
    addText(ctx, slideId, track.name, {
      x,
      y: rowY + px(ctx, 34),
      w: introW - px(ctx, 8),
      h: laneH - px(ctx, 40),
      ...roleStyle(ctx, "timelineLane", { x: 0, y: 0, w: introW - px(ctx, 8), h: laneH - px(ctx, 40), fitValue: track.name, maxLines: 2 }),
      color: BRAND.foreground,
    });

    const cellY = rowY + laneH / 2 - px(ctx, 9);
    dates.forEach((_, colIndex) => {
      const cell = normalizeCell(track.cells[colIndex] ?? "empty");
      const cellX = cellsX + colW * colIndex + px(ctx, 6);
      const cellW = colW - px(ctx, 12);
      const fill =
        cell === "done" ? BRAND.foreground : cell === "ongoing" ? BRAND.accent : cell === "future" ? BRAND.warm : BRAND.cream;
      const line = cell === "empty" ? BRAND.mutedBorder : cell === "future" ? BRAND.mutedBorder : fill;
      addRect(ctx, slideId, { x: cellX, y: cellY, w: cellW, h: px(ctx, 18) }, fill, line, cell === "empty" ? 100 : 0);
    });

    const stateLabel = upper(track.status);
    const stateTone = track.tone === "active" ? BRAND.accent : track.tone === "done" ? BRAND.foreground : BRAND.mutedText;
    addText(ctx, slideId, stateLabel, {
      x: x + w - stateW,
      y: rowY + px(ctx, 20),
      w: stateW - px(ctx, 8),
      h: px(ctx, 22),
      ...roleStyle(ctx, "timelineStatus", { x: 0, y: 0, w: stateW - px(ctx, 8), h: px(ctx, 22), fitValue: stateLabel }),
      color: stateTone,
      align: "right",
    });
    if (track.stage) {
      addText(ctx, slideId, track.stage, {
        x: x + w - stateW,
        y: rowY + px(ctx, 46),
        w: stateW - px(ctx, 8),
        h: px(ctx, 20),
        ...roleStyle(ctx, "timelineStageHint", { x: 0, y: 0, w: stateW - px(ctx, 8), h: px(ctx, 20), fitValue: track.stage }),
        color: BRAND.mutedText,
        align: "right",
      });
    }
  });
  addLine(ctx, slideId, x, lanesY + laneH * laneCount, w, 0, BRAND.mutedBorder);
  if (data.callout?.text) addCallout(ctx, slideId, data.callout.label, data.callout.text);
}

function renderNumbers(ctx: RenderContext, slideId: string, presentation: Presentation, footerLabel: string): void {
  const data = presentation.numbers_data;
  addChrome(ctx, slideId, "cream", cornersFor(presentation), false);
  addHeader(ctx, slideId, "02 · Numbers", data.title ?? "By the numbers", footerLabel);
  const visible = (Array.isArray(data.stats) ? data.stats : []).slice(0, 4);
  const cols = Math.max(1, Math.min(visible.length, 4));
  const gap = px(ctx, 56);
  const cardW = (px(ctx, 1760) - gap * Math.max(cols - 1, 0)) / cols;

  addLine(ctx, slideId, px(ctx, 80), px(ctx, 280), px(ctx, 1760), 0, BRAND.foreground);
  addRoleText(ctx, slideId, "BUILD SNAPSHOT", "sectionEyebrow", { x: 80, y: 298, w: 540, h: 24 }, { color: BRAND.mutedText });

  visible.forEach((stat, index) => {
    const x = px(ctx, 80) + (cardW + gap) * index;
    const y = px(ctx, 360);
    const accent = clean(stat.value).startsWith("+");
    addLine(ctx, slideId, x, y, cardW, 0, BRAND.foreground);
    addText(ctx, slideId, stat.value, {
      x,
      y: y + px(ctx, 24),
      w: cardW,
      h: px(ctx, 120),
      ...roleStyle(ctx, "statValue", { x: 0, y: 0, w: cardW, h: px(ctx, 120), fitValue: stat.value, fitSafety: 0.96 }),
      color: accent ? BRAND.accent : BRAND.foreground,
    });
    addText(ctx, slideId, upper(stat.label), {
      x,
      y: y + px(ctx, 160),
      w: cardW,
      h: px(ctx, 34),
      ...roleStyle(ctx, "statLabel", { x: 0, y: 0, w: cardW, h: px(ctx, 34), fitValue: upper(stat.label) }),
      color: BRAND.foreground,
    });
    addText(ctx, slideId, stat.context, {
      x,
      y: y + px(ctx, 204),
      w: cardW,
      h: px(ctx, 80),
      ...roleStyle(ctx, "statContext", { x: 0, y: 0, w: cardW, h: px(ctx, 80), fitValue: stat.context, maxLines: 3 }),
      color: BRAND.mutedText,
    });
  });

  const breakdown = Array.isArray(data.breakdown) ? data.breakdown : [];
  if (breakdown.length > 0) {
    addRect(ctx, slideId, rectPx(ctx, { x: 80, y: 740, w: 1760, h: 160 }), BRAND.soft, BRAND.mutedBorder);
    addRoleText(ctx, slideId, upper(data.breakdownTitle ?? "Status breakdown"), "sectionEyebrow", { x: 108, y: 764, w: 800, h: 24 }, { color: BRAND.foreground });
    let cursor = px(ctx, 108);
    const totalW = px(ctx, 1704);
    breakdown.forEach((bar) => {
      const width = (totalW * Math.max(Math.min(bar.widthPct, 100), 1)) / 100;
      const fill = bar.variant === "accent" ? BRAND.accent : bar.variant === "outline" ? BRAND.cream : BRAND.foreground;
      addRect(ctx, slideId, { x: cursor, y: px(ctx, 810), w: width, h: px(ctx, 56) }, fill, bar.variant === "outline" ? BRAND.mutedBorder : fill);
      const labelText = `${bar.label} ${bar.value}`;
      addText(ctx, slideId, labelText, {
        x: cursor + px(ctx, 14),
        y: px(ctx, 814),
        w: Math.max(width - px(ctx, 28), px(ctx, 60)),
        h: px(ctx, 50),
        ...roleStyle(ctx, "scopeBarLabel", { x: 0, y: 0, w: Math.max(width - px(ctx, 28), px(ctx, 60)), h: px(ctx, 50), fitValue: labelText, maxLines: 2 }),
        color: bar.variant === "outline" ? BRAND.foreground : BRAND.cream,
        valign: "mid",
      });
      cursor += width;
    });
  }
}

function renderWorkstreams(ctx: RenderContext, slideId: string, presentation: Presentation, footerLabel: string): void {
  const data = presentation.workstreams_data;
  addChrome(ctx, slideId, "cream", cornersFor(presentation), false);
  addHeader(ctx, slideId, "03 · This Week", data.title ?? "Current work in flight", footerLabel);
  const items = (Array.isArray(data.workstreams) ? data.workstreams : []).slice(0, 4);
  const cols = Math.max(items.length, 1);
  const gap = px(ctx, 24);
  const cardW = (px(ctx, 1760) - gap * Math.max(cols - 1, 0)) / cols;
  const cardH = px(ctx, 560);
  const padding = px(ctx, 28);
  const indexReserveW = cols >= 4 ? px(ctx, 84) : px(ctx, 120);
  const indexTextW = cols >= 4 ? px(ctx, 190) : px(ctx, 220);

  items.forEach((item, index) => {
    const x = px(ctx, 80) + (cardW + gap) * index;
    const y = px(ctx, 280);
    addRect(ctx, slideId, { x, y, w: cardW, h: cardH }, BRAND.cream, BRAND.mutedBorder);
    if (index === 0) {
      addRect(ctx, slideId, { x, y, w: cardW, h: px(ctx, 3) }, BRAND.accent, BRAND.accent);
    }
    addText(ctx, slideId, upper(item.id), {
      x: x + padding,
      y: y + padding,
      w: cardW / 2,
      h: px(ctx, 22),
      ...roleStyle(ctx, "workstreamId", { x: 0, y: 0, w: cardW / 2, h: px(ctx, 22), fitValue: upper(item.id) }),
      color: BRAND.mutedText,
    });
    if (item.points) {
      addText(ctx, slideId, item.points, {
        x: x + cardW / 2,
        y: y + padding,
        w: cardW / 2 - padding,
        h: px(ctx, 22),
        ...roleStyle(ctx, "workstreamPoints", { x: 0, y: 0, w: cardW / 2 - padding, h: px(ctx, 22), fitValue: item.points }),
        color: BRAND.mutedText,
        align: "right",
      });
    }
    const indexText = String(index + 1).padStart(2, "0");
    addText(ctx, slideId, indexText, {
      x: x + cardW - indexTextW - px(ctx, 2),
      y: y + px(ctx, 72),
      w: indexTextW,
      h: px(ctx, 80),
      ...roleStyle(ctx, "workstreamIndex", { x: 0, y: 0, w: indexTextW, h: px(ctx, 80), fitValue: indexText, allowGrow: true, fitSafety: 1 }),
      color: BRAND.borderLight,
      align: "right",
    });
    const titleW = cardW - padding * 2 - indexReserveW;
    addText(ctx, slideId, item.name, {
      x: x + padding,
      y: y + px(ctx, 160),
      w: titleW,
      h: px(ctx, 150),
      ...roleStyle(ctx, "workstreamTitle", { x: 0, y: 0, w: titleW, h: px(ctx, 150), fitValue: item.name, maxLines: 3 }),
      color: BRAND.foreground,
    });
    addText(ctx, slideId, item.impact, {
      x: x + padding,
      y: y + px(ctx, 330),
      w: cardW - padding * 2,
      h: px(ctx, 170),
      ...roleStyle(ctx, "workstreamImpact", { x: 0, y: 0, w: cardW - padding * 2, h: px(ctx, 170), fitValue: item.impact, maxLines: 6 }),
      color: BRAND.mutedText,
    });
    if (item.status) {
      const pillText = upper(item.status);
      const maxPillW = cardW - padding * 2;
      const pillW = Math.min(maxPillW, Math.max(px(ctx, 140), pillText.length * px(ctx, 15) + px(ctx, 48)));
      const pillY = y + cardH - px(ctx, 64);
      addRect(ctx, slideId, { x: x + padding, y: pillY, w: pillW, h: px(ctx, 38) }, BRAND.foreground, BRAND.foreground);
      addText(ctx, slideId, pillText, {
        x: x + padding - px(ctx, 8),
        y: pillY,
        w: pillW + px(ctx, 16),
        h: px(ctx, 38),
        ...roleStyle(ctx, "workstreamPill", { x: 0, y: 0, w: pillW + px(ctx, 16), h: px(ctx, 38), fitValue: pillText }),
        color: BRAND.cream,
        align: "center",
        valign: "mid",
      });
    }
  });
  if (data.callout?.text) addCallout(ctx, slideId, data.callout.label, data.callout.text);
}

function renderRecommendations(ctx: RenderContext, slideId: string, presentation: Presentation, footerLabel: string): void {
  const data = presentation.recommendations_data;
  addChrome(ctx, slideId, "cream", cornersFor(presentation), false);
  addHeader(ctx, slideId, "04 · Recommendations", data?.title ?? "Our recommendations", footerLabel);
  if (data?.subtitle) {
    addRoleText(ctx, slideId, data.subtitle, "slideSubtitle", { x: 80, y: 220, w: 1260, h: 44 }, { color: BRAND.mutedText });
  }
  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const lead = recommendations[0];
  const supporting = recommendations.slice(1, 4);
  const gridY = px(ctx, data?.subtitle ? 298 : 268);
  const leadW = px(ctx, 960);
  const sideX = px(ctx, 1068);
  const sideW = px(ctx, 772);
  if (lead) {
    const leadInset = px(ctx, 40);
    const leadInnerW = leadW - leadInset * 2;
    const leadH = px(ctx, 580);
    addRect(ctx, slideId, { x: px(ctx, 80), y: gridY, w: leadW, h: leadH }, BRAND.foreground, BRAND.foreground);
    if (lead.priority) {
      const priorityText = upper(lead.priority);
      const pillW = Math.min(px(ctx, 420), Math.max(px(ctx, 210), priorityText.length * px(ctx, 13) + px(ctx, 42)));
      addRect(ctx, slideId, { x: px(ctx, 80) + leadInset, y: gridY + px(ctx, 30), w: pillW, h: px(ctx, 36) }, BRAND.accentWarm, BRAND.accentWarm);
      addText(ctx, slideId, priorityText, {
        x: px(ctx, 80) + leadInset - px(ctx, 6),
        y: gridY + px(ctx, 30),
        w: pillW + px(ctx, 12),
        h: px(ctx, 36),
        ...roleStyle(ctx, "heroChip", { x: 0, y: 0, w: pillW + px(ctx, 12), h: px(ctx, 36), fitValue: priorityText }),
        color: BRAND.accent,
        align: "center",
        valign: "mid",
      });
    }
    addText(ctx, slideId, lead.title, {
      x: px(ctx, 80) + leadInset,
      y: gridY + px(ctx, 86),
      w: leadInnerW,
      h: px(ctx, 180),
      ...roleStyle(ctx, "heroTitle", { x: 0, y: 0, w: leadInnerW, h: px(ctx, 180), fitValue: lead.title, maxLines: 2 }),
      color: BRAND.cream,
    });
    addText(ctx, slideId, lead.rationale, {
      x: px(ctx, 80) + leadInset,
      y: gridY + px(ctx, 282),
      w: leadInnerW,
      h: px(ctx, 120),
      ...roleStyle(ctx, "heroBody", { x: 0, y: 0, w: leadInnerW, h: px(ctx, 120), fitValue: lead.rationale, maxLines: 4 }),
      color: "D6D6D6",
    });
    addLine(ctx, slideId, px(ctx, 80) + leadInset, gridY + px(ctx, 420), leadInnerW, 0, "444444");
    addText(ctx, slideId, "EXPECTED OUTCOME", {
      x: px(ctx, 80) + leadInset,
      y: gridY + px(ctx, 436),
      w: leadInnerW,
      h: px(ctx, 20),
      ...roleStyle(ctx, "sectionEyebrow", { x: 0, y: 0, w: leadInnerW, h: px(ctx, 20), fitValue: "EXPECTED OUTCOME" }),
      color: BRAND.accent,
    });
    addText(ctx, slideId, lead.impact, {
      x: px(ctx, 80) + leadInset,
      y: gridY + px(ctx, 462),
      w: leadInnerW,
      h: px(ctx, 106),
      ...roleStyle(ctx, "heroImpact", { x: 0, y: 0, w: leadInnerW, h: px(ctx, 106), fitValue: lead.impact, maxLines: 4 }),
      color: BRAND.cream,
    });
  }
  const supportingTop = gridY;
  const supportingTotalH = px(ctx, 600);
  const slotH = supportingTotalH / Math.max(supporting.length, 1);
  const indexW = px(ctx, 108);
  const supportingBodyX = sideX + indexW + px(ctx, 16);
  const supportingBodyW = sideW - indexW - px(ctx, 16);
  const titleH = px(ctx, 54);
  const rationaleH = px(ctx, 54);
  const impactH = px(ctx, 36);
  const blockGap = px(ctx, 6);
  supporting.forEach((item, index) => {
    const y = supportingTop + index * slotH;
    addLine(ctx, slideId, sideX, y, sideW, 0, index === 0 ? BRAND.dark : BRAND.mutedBorder);
    const indexText = String(index + 2).padStart(2, "0");
    addText(ctx, slideId, indexText, {
      x: sideX,
      y: y + px(ctx, 18),
      w: indexW,
      h: px(ctx, 46),
      ...roleStyle(ctx, "supportingIndex", { x: 0, y: 0, w: indexW, h: px(ctx, 46), fitValue: indexText, fitSafety: 0.65 }),
      color: BRAND.accent,
      valign: "mid",
    });
    if (item.priority) {
      const priority = upper(item.priority);
      addText(ctx, slideId, priority, {
        x: supportingBodyX,
        y: y + px(ctx, 20),
        w: supportingBodyW,
        h: px(ctx, 18),
        ...roleStyle(ctx, "supportingChip", { x: 0, y: 0, w: supportingBodyW, h: px(ctx, 18), fitValue: priority }),
        color: BRAND.accent,
        align: "right",
        valign: "mid",
      });
    }
    const titleY = y + px(ctx, 42);
    addText(ctx, slideId, item.title, {
      x: supportingBodyX,
      y: titleY,
      w: supportingBodyW,
      h: titleH,
      ...roleStyle(ctx, "supportingTitle", { x: 0, y: 0, w: supportingBodyW, h: titleH, fitValue: item.title, maxLines: 2 }),
      color: BRAND.foreground,
    });
    addText(ctx, slideId, item.rationale, {
      x: supportingBodyX,
      y: titleY + titleH + blockGap,
      w: supportingBodyW,
      h: rationaleH,
      ...roleStyle(ctx, "supportingBody", { x: 0, y: 0, w: supportingBodyW, h: rationaleH, fitValue: item.rationale, maxLines: 3 }),
      color: BRAND.mutedText,
    });
    if (item.impact) {
      addText(ctx, slideId, item.impact, {
        x: supportingBodyX,
        y: titleY + titleH + blockGap + rationaleH + blockGap,
        w: supportingBodyW,
        h: impactH,
        ...roleStyle(ctx, "supportingImpact", { x: 0, y: 0, w: supportingBodyW, h: impactH, fitValue: item.impact, maxLines: 2 }),
        color: BRAND.foreground,
      });
    }
  });
  if (data?.callout?.text) addCallout(ctx, slideId, data.callout.label, data.callout.text);
}

function groupsFor(data: Presentation["asks_data"]): AskGroup[] {
  if (Array.isArray(data?.groups) && data.groups.length > 0) return data.groups;
  const asks = Array.isArray(data?.asks) ? data.asks : [];
  return asks.length > 0 ? [{ label: "Client input needed", tone: "default", items: asks }] : [];
}

function renderAsks(ctx: RenderContext, slideId: string, presentation: Presentation, footerLabel: string): void {
  const data = presentation.asks_data;
  addChrome(ctx, slideId, "cream", cornersFor(presentation), false);
  addHeader(ctx, slideId, "05 · Asks", data.title ?? "What we need from you", footerLabel);
  const groups = groupsFor(data).slice(0, 3);
  if (groups.length === 0) return;
  const railX = px(ctx, 80);
  const railW = px(ctx, 360);
  const rowsX = px(ctx, 480);
  const rowsW = px(ctx, 1360);
  const pillW = px(ctx, 320);
  const ownerW = px(ctx, 170);
  const askW = rowsW - ownerW - pillW - px(ctx, 44);
  const ownerX = rowsX + askW + px(ctx, 20);
  const pillX = rowsX + rowsW - pillW;
  const sectionTopY = px(ctx, 260);
  const sectionBottomY = px(ctx, 914);
  const totalH = sectionBottomY - sectionTopY;
  const groupGap = px(ctx, 24);
  const itemCounts = groups.map((g) => Math.max(g.items.length, 1));
  const totalItems = itemCounts.reduce((sum, count) => sum + count, 0);
  const availableForRows = totalH - groupGap * (groups.length - 1);
  const rowH = availableForRows / totalItems;
  let cursor = sectionTopY;

  groups.forEach((group, index) => {
    const itemCount = itemCounts[index];
    const groupH = rowH * itemCount;
    const sectionTop = cursor;
    const dot = group.tone === "urgent" ? "EF4444" : group.tone === "access" ? BRAND.warning : group.tone === "upcoming" ? "94A3B8" : BRAND.muted;
    addEllipse(ctx, slideId, { x: railX, y: sectionTop + px(ctx, 14), w: px(ctx, 16), h: px(ctx, 16) }, dot, dot);
    addText(ctx, slideId, group.label, {
      x: railX + px(ctx, 28),
      y: sectionTop + px(ctx, 6),
      w: railW - px(ctx, 28),
      h: px(ctx, 34),
      ...roleStyle(ctx, "askGroupLabel", { x: 0, y: 0, w: railW - px(ctx, 28), h: px(ctx, 34), fitValue: group.label }),
      color: BRAND.foreground,
    });
    if (group.summary) {
      addText(ctx, slideId, group.summary, {
        x: railX + px(ctx, 28),
        y: sectionTop + px(ctx, 48),
        w: railW - px(ctx, 28),
        h: groupH - px(ctx, 56),
        ...roleStyle(ctx, "askGroupSummary", { x: 0, y: 0, w: railW - px(ctx, 28), h: groupH - px(ctx, 56), fitValue: group.summary, maxLines: 4 }),
        color: BRAND.mutedText,
      });
    }
    addLine(ctx, slideId, rowsX, sectionTop, rowsW, 0, BRAND.dark);
    const items = group.items.slice(0, itemCount);
    items.forEach((row, rowIndex) => {
      const rowY = sectionTop + rowH * rowIndex;
      addText(ctx, slideId, row.ask, {
        x: rowsX,
        y: rowY + px(ctx, 6),
        w: askW,
        h: px(ctx, 34),
        ...roleStyle(ctx, "askName", { x: 0, y: 0, w: askW, h: px(ctx, 34), fitValue: row.ask }),
        color: BRAND.foreground,
      });
      if (row.detail) {
        addText(ctx, slideId, row.detail, {
          x: rowsX,
          y: rowY + px(ctx, 40),
          w: askW,
          h: rowH - px(ctx, 48),
          ...roleStyle(ctx, "askDetail", { x: 0, y: 0, w: askW, h: rowH - px(ctx, 48), fitValue: row.detail, maxLines: 3 }),
          color: BRAND.mutedText,
        });
      }
      if (row.owner) {
        addText(ctx, slideId, row.owner, {
          x: ownerX,
          y: rowY + px(ctx, 10),
          w: ownerW,
          h: px(ctx, 28),
          ...roleStyle(ctx, "askOwner", { x: 0, y: 0, w: ownerW, h: px(ctx, 28), fitValue: row.owner }),
          color: BRAND.foreground,
          valign: "mid",
        });
      }
      const priorityText = upper(row.priority);
      if (priorityText) {
        addRect(ctx, slideId, { x: pillX, y: rowY + px(ctx, 6), w: pillW, h: px(ctx, 36) }, BRAND.foreground, BRAND.foreground);
        addText(ctx, slideId, priorityText, {
          x: pillX - px(ctx, 8),
          y: rowY + px(ctx, 6),
          w: pillW + px(ctx, 16),
          h: px(ctx, 36),
          ...roleStyle(ctx, "askPill", { x: 0, y: 0, w: pillW + px(ctx, 16), h: px(ctx, 36), fitValue: priorityText }),
          color: BRAND.cream,
          align: "center",
          valign: "mid",
        });
      }
      if (rowIndex < items.length - 1) {
        addLine(ctx, slideId, rowsX, rowY + rowH - px(ctx, 2), rowsW, 0, BRAND.mutedBorder);
      }
    });
    cursor += groupH + groupGap;
  });
  if (data.callout?.text) addCallout(ctx, slideId, data.callout.label, data.callout.text, 940);
}

async function renderClosing(ctx: RenderContext, slideId: string, presentation: Presentation, corners: CornerLabels): Promise<void> {
  const data = presentation.closing_data;
  addChrome(ctx, slideId, "dark", corners, true);
  await addImageFrame(ctx, slideId, data.closingImageUrl, { x: 990, y: 28, w: 902, h: 612 }, true);
  addDivider(ctx, slideId, "3A3A3A");
  addRoleText(ctx, slideId, formatPresentationDisplayTitle(data.heroText), "coverHero", { x: 0, y: 680, w: SLIDE_WIDTH, h: 400 }, {
    color: BRAND.accent,
    align: "center",
    valign: "mid",
  });
  addRoleText(ctx, slideId, data.thankYou, "coverMeta", { x: 101, y: 360, w: 840, h: 52 }, { color: BRAND.cream });
  addRoleText(ctx, slideId, data.teamLine, "coverMeta", { x: 101, y: 430, w: 840, h: 36 }, { color: BRAND.cream });
  addRoleText(ctx, slideId, data.dateLine, "coverMeta", { x: 101, y: 500, w: 840, h: 36 }, { color: BRAND.cream });
}

async function readJsonIfExists(filePath: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function readGoogleSettingsEnv(): Promise<Record<string, string>> {
  const [tracked, local] = await Promise.all([
    readJsonIfExists(path.join(ROOT, ".claude", "settings.json")),
    readJsonIfExists(path.join(ROOT, ".claude", "settings.local.json")),
  ]);
  const merged: Record<string, string> = {};
  for (const source of [process.env, tracked.env, local.env]) {
    if (!source || typeof source !== "object") continue;
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "string" && !value.includes("<")) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

export function parseServiceAccount(value: string | undefined): GoogleServiceAccount {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.includes("<")) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_B64 is missing or still a placeholder");
  }
  const parsed = trimmed.startsWith("{")
    ? JSON.parse(trimmed)
    : JSON.parse(Buffer.from(trimmed.replace(/\s+/g, ""), "base64").toString("utf8"));
  return parsed as GoogleServiceAccount;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function getGoogleAccessToken(serviceAccount: GoogleServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: `${DRIVE_SCOPE} ${SLIDES_SCOPE}`,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), serviceAccount.private_key);
  const assertion = `${unsigned}.${base64url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token exchange failed: ${res.status} ${json.error_description || json.error || ""}`);
  }
  return json.access_token;
}

async function googleFetch(token: string, url: URL | string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Google API failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

async function assertDriveFolderAccess(token: string, folderId: string | undefined): Promise<void> {
  if (!folderId) {
    return;
  }
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${folderId}`);
  url.searchParams.set("fields", "id,name,mimeType,capabilities/canAddChildren");
  url.searchParams.set("supportsAllDrives", "true");
  const folder = (await (
    await googleFetch(token, url, {
      method: "GET",
    })
  ).json()) as { mimeType?: string; capabilities?: { canAddChildren?: boolean } };
  if (folder.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error(`Google Drive destination ${folderId} is not a folder`);
  }
  if (folder.capabilities?.canAddChildren === false) {
    throw new Error(`Google service account cannot add files to Drive folder ${folderId}`);
  }
}

async function createSlidesPresentation(
  token: string,
  parentId: string | undefined,
  name: string,
): Promise<GoogleSlidesRenderResult> {
  const createUrl = new URL("https://www.googleapis.com/drive/v3/files");
  createUrl.searchParams.set("fields", "id,name,webViewLink");
  createUrl.searchParams.set("supportsAllDrives", "true");
  const body: Record<string, unknown> = {
    name,
    mimeType: PRESENTATION_MIME,
  };
  if (parentId) {
    body.parents = [parentId];
  }
  const created = (await (
    await googleFetch(token, createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(body),
    })
  ).json()) as GoogleSlidesRenderResult;
  return { ...created, slideCount: 0 };
}

async function uploadDriveFile(
  token: string,
  filePath: string,
  parentId: string,
  mimeType: string,
  driveName: string,
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const body = await readFile(filePath);
  const initUrl = new URL("https://www.googleapis.com/upload/drive/v3/files");
  initUrl.searchParams.set("uploadType", "resumable");
  initUrl.searchParams.set("supportsAllDrives", "true");
  initUrl.searchParams.set("fields", "id,name,webViewLink");
  const init = await googleFetch(token, initUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(body.length),
    },
    body: JSON.stringify({ name: driveName, parents: [parentId], mimeType }),
  });
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) {
    throw new Error("Drive resumable upload did not return a Location header");
  }
  return (await (
    await googleFetch(token, uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(body.length),
      },
      body,
    })
  ).json()) as { id: string; name: string; webViewLink?: string };
}

async function createPublicPermission(token: string, fileId: string): Promise<void> {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`);
  url.searchParams.set("supportsAllDrives", "true");
  await googleFetch(token, url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

async function getPresentation(token: string, presentationId: string): Promise<Record<string, unknown>> {
  const url = new URL(`https://slides.googleapis.com/v1/presentations/${presentationId}`);
  return (await (await googleFetch(token, url)).json()) as Record<string, unknown>;
}

function pointsFromPageDimension(dimension: { magnitude?: number; unit?: string } | undefined, fallback: number): number {
  const magnitude = dimension?.magnitude;
  if (typeof magnitude !== "number") {
    return fallback;
  }
  if (dimension?.unit === "EMU") {
    return magnitude / 12700;
  }
  return magnitude;
}

function pageSizeFrom(presentation: Record<string, unknown>): { width: number; height: number } {
  const pageSize = presentation.pageSize as
    | { width?: { magnitude?: number; unit?: string }; height?: { magnitude?: number; unit?: string } }
    | undefined;
  return {
    width: pointsFromPageDimension(pageSize?.width, 720),
    height: pointsFromPageDimension(pageSize?.height, 405),
  };
}

async function batchUpdate(token: string, presentationId: string, requests: SlidesRequest[]): Promise<void> {
  const url = new URL(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`);
  const chunkSize = 150;
  for (let i = 0; i < requests.length; i += chunkSize) {
    await googleFetch(token, url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ requests: requests.slice(i, i + chunkSize) }),
    });
  }
}

function createSlide(ctx: RenderContext, index: number): string {
  const slideId = `ims_slide_${index + 1}`;
  ctx.requests.push({
    createSlide: {
      objectId: slideId,
      insertionIndex: index,
      slideLayoutReference: { predefinedLayout: "BLANK" },
    },
  });
  return slideId;
}

export async function renderDeckToGoogleSlides(
  presentation: Presentation,
  token: string,
  options: GoogleSlidesRenderOptions = {},
): Promise<GoogleSlidesRenderResult> {
  const title = options.title ?? presentation.title ?? "Presentation";
  await assertDriveFolderAccess(token, options.parentId);
  const created = await createSlidesPresentation(token, options.parentId, title);
  const existing = await getPresentation(token, created.id);
  const oldSlideIds = Array.isArray(existing.slides)
    ? existing.slides.map((slide) => (slide as { objectId?: string }).objectId).filter(Boolean)
    : [];
  const { width, height } = pageSizeFrom(existing);
  const ctx: RenderContext = {
    token,
    presentationId: created.id,
    pageWidth: width,
    pageHeight: height,
    sx: width / SLIDE_WIDTH,
    sy: height / SLIDE_HEIGHT,
    requests: [],
    objectCounter: 0,
    imageParentId: options.parentId,
  };
  const corners = cornersFor(presentation);
  const footerLabel = footerLabelFor(presentation);
  let slideCount = 0;

  if (hasRenderableData(presentation.cover_data)) {
    await renderCover(ctx, createSlide(ctx, slideCount), presentation, corners);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.timeline_data)) {
    renderTimeline(ctx, createSlide(ctx, slideCount), presentation.timeline_data, corners, footerLabel);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.numbers_data)) {
    renderNumbers(ctx, createSlide(ctx, slideCount), presentation, footerLabel);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.workstreams_data)) {
    renderWorkstreams(ctx, createSlide(ctx, slideCount), presentation, footerLabel);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.recommendations_data)) {
    renderRecommendations(ctx, createSlide(ctx, slideCount), presentation, footerLabel);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.asks_data)) {
    renderAsks(ctx, createSlide(ctx, slideCount), presentation, footerLabel);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.closing_data)) {
    await renderClosing(ctx, createSlide(ctx, slideCount), presentation, corners);
    slideCount += 1;
  }

  if (slideCount === 0) {
    throw new Error("Presentation JSON did not contain any renderable slide data");
  }

  for (const objectId of oldSlideIds) {
    ctx.requests.push({ deleteObject: { objectId } });
  }
  await batchUpdate(token, created.id, ctx.requests);
  return { ...created, slideCount };
}
