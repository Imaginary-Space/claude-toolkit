import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { cornersFor, footerLabelFor, hasRenderableData } from "../deckModel";
import { BRAND, FONT, PPTX_HEIGHT, PPTX_WIDTH, pt, px } from "../layout";
import { roleStyle, type RoleStyleOptions } from "../typography";
import type { TypeRoleName } from "../typeScale";
import type {
  AskGroup,
  CornerLabels,
  Presentation,
  TimelineData,
} from "../types/presentation";
import { formatPresentationDisplayTitle } from "../utils/presentation-title";

const PptxGen = ((PptxGenJS as unknown as { default?: typeof PptxGenJS }).default ??
  PptxGenJS) as typeof PptxGenJS;

type Pptx = InstanceType<typeof PptxGenJS>;
type Slide = ReturnType<Pptx["addSlide"]>;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TextOptions extends Rect {
  fontSize?: number;
  color?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "mid" | "bottom";
  margin?: number;
  breakLine?: boolean;
  /**
   * `fit: "shrink"` is unreliable in pptxgenjs because it depends on the
   * client doing autofit at open time. Prefer pre-computing font sizes with
   * `fitText` and only set this for last-resort safety.
   */
  fit?: "shrink" | "resize";
  /** When false, text never wraps and overflowing glyphs are clipped to the frame. */
  wrap?: boolean;
  /** Letter spacing in 1/100 points; mirrors PowerPoint's character spacing field. */
  charSpacing?: number;
  lineSpacingMultiple?: number;
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

interface RoleTextOverrides
  extends Partial<Omit<TextOptions, "fontSize" | "bold" | "charSpacing" | "lineSpacingMultiple" | "wrap" | "x" | "y" | "w" | "h">> {
  /** Override `wrap`. Defaults to `false` for single-line roles, `true` otherwise. */
  wrap?: boolean;
  /** Use a different string when computing the fit (e.g. uppercased version). */
  fitValue?: unknown;
  /** Allow the helper to grow the font above the role's nominal size. */
  allowGrow?: boolean;
}

/**
 * Render `text` inside `rect` using the named type-scale role. The role
 * controls font size, weight, line-height, and letter spacing. When `rect`'s
 * width is provided the helper also shrinks the font (down to the role's
 * `minRatio`) to keep the value on one line — or `maxLines` lines if the
 * caller passes that explicitly.
 */
function addRoleText(
  slide: Slide,
  text: unknown,
  role: TypeRoleName,
  rect: Rect,
  overrides: RoleTextOverrides & { maxLines?: number; fitSafety?: number } = {},
): void {
  const value = clean(text);
  if (!value) {
    return;
  }
  const { maxLines, fitSafety, fitValue, allowGrow, wrap, ...rest } = overrides;
  const style = roleStyle(role, {
    fitWidth: rect.w,
    maxLines,
    fitValue: fitValue ?? value,
    safety: fitSafety,
    allowGrow,
  } as RoleStyleOptions);
  addText(slide, value, {
    ...rect,
    ...rest,
    fontSize: style.fontSize,
    bold: style.bold,
    charSpacing: style.charSpacing,
    lineSpacingMultiple: style.lineSpacingMultiple,
    wrap: wrap ?? !style.singleLine,
  });
}

function addText(slide: Slide, text: unknown, opts: TextOptions): void {
  const value = clean(text);
  if (!value) {
    return;
  }
  slide.addText(value, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    fontFace: FONT.body,
    fontSize: opts.fontSize ?? 18,
    color: opts.color ?? BRAND.foreground,
    bold: opts.bold,
    align: opts.align ?? "left",
    valign: opts.valign ?? "top",
    margin: opts.margin ?? 0,
    breakLine: opts.breakLine,
    fit: opts.fit,
    wrap: opts.wrap,
    // pptxgenjs serializes `charSpacing` straight through to OOXML's `spc`
    // attribute, multiplied by 100. OOXML interprets `spc` as 1/100 of a
    // point, so passing `charSpacing: 150` writes spc="15000" → 150 points
    // of letter spacing, which spreads "Now" so wide that only "N" stays
    // inside the frame. Divide by 100 here so callers pass the value in
    // 1/100 points (CSS-style tracking) and we get the small extra spacing
    // they actually expect.
    charSpacing: opts.charSpacing != null ? opts.charSpacing / 100 : undefined,
    lineSpacingMultiple: opts.lineSpacingMultiple,
  } as never);
}

function addRect(
  slide: Slide,
  pptx: Pptx,
  rect: Rect,
  fill: string,
  line: string = fill,
  transparency = 0,
): void {
  slide.addShape(pptx.ShapeType.rect, {
    ...rect,
    fill: { color: fill, transparency },
    line: { color: line, transparency: line === fill ? 100 : 0, width: 0.8 },
  } as never);
}

function addLine(slide: Slide, pptx: Pptx, x: number, y: number, w: number, h: number, color: string): void {
  slide.addShape(pptx.ShapeType.line, {
    x,
    y,
    w,
    h,
    line: { color, width: 1 },
  } as never);
}

function addEllipse(slide: Slide, pptx: Pptx, rect: Rect, fill: string, line: string = fill): void {
  slide.addShape(pptx.ShapeType.ellipse, {
    ...rect,
    fill: { color: fill },
    line: { color: line, transparency: line === fill ? 100 : 0, width: 0.8 },
  } as never);
}

function addCorners(slide: Slide, corners: CornerLabels, dark = false): void {
  const color = dark ? "FFFFFF" : BRAND.muted;
  // PPTX lacks CSS opacity for text, so dim corner labels by colour rather
  // than transparency on dark slides.
  addRoleText(slide, upper(corners.tl ?? "Imaginary Space"), "cornerLabel", { x: px(40), y: px(32), w: px(360), h: px(24) }, { color });
  addRoleText(slide, upper(corners.tr ?? ""), "cornerLabel", { x: px(1480), y: px(32), w: px(400), h: px(24) }, { color, align: "right" });
  addRoleText(slide, upper(corners.bl ?? ""), "cornerLabel", { x: px(40), y: px(1024), w: px(600), h: px(24) }, { color });
  addRoleText(slide, upper(corners.br ?? ""), "cornerLabel", { x: px(1280), y: px(1024), w: px(600), h: px(24) }, { color, align: "right" });
}

function addChrome(slide: Slide, pptx: Pptx, variant: "cream" | "dark", corners?: CornerLabels, showCorners = true): void {
  slide.background = { color: variant === "dark" ? BRAND.foreground : BRAND.cream };
  addRect(slide, pptx, { x: 0, y: 0, w: PPTX_WIDTH, h: PPTX_HEIGHT }, variant === "dark" ? BRAND.foreground : BRAND.cream);
  if (showCorners && corners) {
    addCorners(slide, corners, variant === "dark");
  }
}

function addHeader(slide: Slide, pptx: Pptx, eyebrow: string, title: string, footerLabel: string): void {
  addRoleText(slide, upper(eyebrow), "slideEyebrow", { x: px(80), y: px(88), w: px(700), h: px(22) }, { color: BRAND.accent });
  addRoleText(slide, upper(footerLabel), "slideFooter", { x: px(960), y: px(88), w: px(880), h: px(22) }, { color: BRAND.mutedText, align: "right" });
  addLine(slide, pptx, px(80), px(124), px(1760), 0, BRAND.mutedBorder);
  addRoleText(slide, title, "slideTitle", { x: px(80), y: px(138), w: px(1760), h: px(78) }, { color: BRAND.foreground });
}

function addCallout(slide: Slide, pptx: Pptx, label: string | undefined, text: string, y = px(936)): void {
  addLine(slide, pptx, px(80), y, px(1620), 0, BRAND.mutedBorder);
  addLine(slide, pptx, px(96), y + px(16), 0, px(58), BRAND.accent);
  if (label) {
    addRoleText(slide, upper(label), "calloutLabel", { x: px(128), y: y + px(18), w: px(210), h: px(24) }, { color: BRAND.accent });
  }
  addRoleText(
    slide,
    text,
    "calloutBody",
    { x: px(label ? 350 : 128), y: y + px(14), w: px(label ? 1320 : 1535), h: px(66) },
    { color: BRAND.foreground, maxLines: 2 },
  );
}

function addDivider(slide: Slide, pptx: Pptx, color: string): void {
  addLine(slide, pptx, px(960), 0, 0, px(670), color);
  addLine(slide, pptx, 0, px(670), px(1920), 0, color);
}

function addImageFrame(slide: Slide, pptx: Pptx, src: string | undefined, rect: Rect, dark = false): void {
  const value = clean(src);
  if (!value) {
    return;
  }
  addRect(slide, pptx, rect, dark ? BRAND.dark : BRAND.warm, dark ? "333333" : BRAND.mutedBorder);
  if (value.startsWith("data:")) {
    slide.addImage({ data: value, ...rect } as never);
    return;
  }
  if (value && !/^(https?:)/i.test(value)) {
    slide.addImage({ path: value, ...rect } as never);
    return;
  }
}

function renderCover(slide: Slide, pptx: Pptx, presentation: Presentation, corners: CornerLabels): void {
  const data = presentation.cover_data;
  addChrome(slide, pptx, "cream", corners, true);
  addImageFrame(slide, pptx, data.coverImageUrl, { x: px(990), y: px(28), w: px(902), h: px(612) });
  addDivider(slide, pptx, BRAND.mutedBorder);
  addRoleText(
    slide,
    formatPresentationDisplayTitle(data.heroText),
    "coverHero",
    { x: 0, y: px(680), w: PPTX_WIDTH, h: px(400) },
    { color: BRAND.accent, align: "center", valign: "mid" },
  );
  addRoleText(slide, `TEAM: ${data.team ?? ""}`, "coverMeta", { x: px(101), y: px(360), w: px(840), h: px(52) });
  addRoleText(slide, `DATE: ${data.date ?? ""}`, "coverMeta", { x: px(101), y: px(453), w: px(840), h: px(36) });
  addRoleText(slide, `CYCLE: ${data.cycle ?? ""}`, "coverMeta", { x: px(101), y: px(520), w: px(840), h: px(36) });
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
  const doneIndexes = normalized
    .map((cell, index) => (cell === "done" ? index : -1))
    .filter((index) => index >= 0);
  const futureIndex = normalized.indexOf("future");
  const lastDoneIndex = doneIndexes.length > 0 ? doneIndexes[doneIndexes.length - 1] : -1;
  const clamp = (index: number) => Math.min(Math.max(index, 0), Math.max(dates.length - 1, 0));

  if (ongoingIndex >= 0) return { status: "In progress", tone: "active", stage: dates[clamp(ongoingIndex)] };
  if (lastDoneIndex >= 0 && futureIndex < 0) return { status: "Complete", tone: "done", stage: dates[clamp(lastDoneIndex)] };
  if (lastDoneIndex >= 0 && futureIndex >= 0) return { status: "Next", tone: "next", stage: dates[clamp(futureIndex)] };
  if (futureIndex >= 0) return { status: "Queued", tone: "future", stage: dates[clamp(futureIndex)] };
  return { status: "Planned", tone: "future", stage: dates[0] };
}

function renderTimeline(slide: Slide, pptx: Pptx, data: TimelineData, corners: CornerLabels, footerLabel: string): void {
  addChrome(slide, pptx, "cream", corners, false);
  addHeader(slide, pptx, "01 · Timeline", data.title ?? "Where we are", footerLabel);

  const dates = data.dates ?? [];
  const numCols = Math.max(dates.length, 1);
  const todayCol = Math.min(Math.max(data.todayColumn ?? 0, 0), Math.max(dates.length - 1, 0));
  const sections = data.sections ?? [];
  const tracks = sections.flatMap((section) =>
    section.tasks.map((task) => ({ section: section.label, name: task.name, cells: task.cells, ...trackState(task.cells, dates) })),
  );

  // The HTML uses:
  //   stage row:  360px | repeat(N, 1fr)              | 150px
  //   lane row:   360px | minmax(0,1fr) (cells)       | 150px   (gap 28px)
  // We mirror the same column math so cell pills line up under the dot above.
  const x = px(80);
  const y = px(252);
  const w = px(1760);
  const introW = px(360);
  const stateW = px(170);
  const colGap = px(28);
  const cellsX = x + introW + colGap;
  const cellsW = w - introW - stateW - colGap * 2;
  const colW = cellsW / numCols;

  // Stage header row (intro · stage cells · status header).
  const headerH = px(92);
  addRect(slide, pptx, { x, y, w, h: headerH }, BRAND.soft, BRAND.borderLight);
  addLine(slide, pptx, x, y, w, 0, BRAND.dark);
  addLine(slide, pptx, x, y + headerH, w, 0, BRAND.mutedBorder);
  addRoleText(slide, "PROJECT SCOPE", "timelineHeader", { x: x + px(18), y: y + headerH - px(34), w: introW - px(36), h: px(20) }, { color: BRAND.mutedText });
  addRoleText(slide, "STATUS", "timelineHeader", { x: x + w - stateW, y: y + headerH - px(34), w: stateW - px(18), h: px(20) }, { color: BRAND.mutedText, align: "right" });

  dates.forEach((date, index) => {
    const colX = cellsX + colW * index;
    const isToday = index === todayCol;
    const tone = isToday ? BRAND.accent : index < todayCol ? BRAND.foreground : BRAND.muted;
    addEllipse(slide, pptx, { x: colX + px(4), y: y + px(20), w: px(12), h: px(12) }, tone, tone);
    if (isToday) {
      addRoleText(slide, "CURRENT", "timelineCurrent", { x: colX + px(4), y: y + px(40), w: colW - px(8), h: px(18) }, { color: BRAND.accent });
    }
    addRoleText(slide, date, "timelineStage", { x: colX + px(4), y: y + headerH - px(34), w: colW - px(8), h: px(22) }, { color: BRAND.foreground });
  });

  // Lane rows. Compact lane height when there are many tracks so they always
  // fit between the stage header and the callout (below y ~880).
  const laneCount = Math.max(tracks.length, 1);
  const lanesY = y + headerH;
  const lanesAvailable = px(880) - lanesY - px(20);
  const laneH = Math.min(px(96), Math.max(px(64), lanesAvailable / laneCount));
  addLine(slide, pptx, x, lanesY, w, 0, BRAND.dark);
  tracks.forEach((track, index) => {
    const rowY = lanesY + laneH * index;
    if (index > 0) {
      addLine(slide, pptx, x, rowY, w, 0, BRAND.mutedBorder);
    }
    addRoleText(slide, upper(track.section), "timelineSection", { x, y: rowY + px(14), w: introW - px(8), h: px(18) }, { color: BRAND.accent });
    addRoleText(slide, track.name, "timelineLane", { x, y: rowY + px(34), w: introW - px(8), h: laneH - px(40) }, { color: BRAND.foreground, maxLines: 2 });

    // Cell row aligned to the stage header columns.
    const cellY = rowY + laneH / 2 - px(9);
    dates.forEach((_, colIndex) => {
      const cell = normalizeCell(track.cells[colIndex] ?? "empty");
      const cellX = cellsX + colW * colIndex + px(6);
      const cellW = colW - px(12);
      const fill =
        cell === "done"
          ? BRAND.foreground
          : cell === "ongoing"
          ? BRAND.accent
          : cell === "future"
          ? BRAND.warm
          : BRAND.cream;
      const line = cell === "empty" ? BRAND.mutedBorder : cell === "future" ? BRAND.mutedBorder : fill;
      addRect(slide, pptx, { x: cellX, y: cellY, w: cellW, h: px(18) }, fill, line, cell === "empty" ? 100 : 0);
    });

    const stateLabel = upper(track.status);
    const stateTone =
      track.tone === "active"
        ? BRAND.accent
        : track.tone === "done"
        ? BRAND.foreground
        : BRAND.mutedText;
    addRoleText(slide, stateLabel, "timelineStatus", { x: x + w - stateW, y: rowY + px(20), w: stateW - px(8), h: px(22) }, { color: stateTone, align: "right" });
    if (track.stage) {
      addRoleText(slide, track.stage, "timelineStageHint", { x: x + w - stateW, y: rowY + px(46), w: stateW - px(8), h: px(20) }, { color: BRAND.mutedText, align: "right" });
    }
  });
  addLine(slide, pptx, x, lanesY + laneH * laneCount, w, 0, BRAND.mutedBorder);

  if (data.callout?.text) addCallout(slide, pptx, data.callout.label, data.callout.text);
}

function renderNumbers(slide: Slide, pptx: Pptx, presentation: Presentation, footerLabel: string): void {
  const data = presentation.numbers_data;
  addChrome(slide, pptx, "cream", cornersFor(presentation), false);
  addHeader(slide, pptx, "02 · Numbers", data.title ?? "By the numbers", footerLabel);

  const stats = Array.isArray(data.stats) ? data.stats : [];
  const visible = stats.slice(0, 4);
  const cols = Math.max(1, Math.min(visible.length, 4));
  const gap = px(56);
  const cardW = (px(1760) - gap * Math.max(cols - 1, 0)) / cols;

  // Top divider sits above the cards, matching `.numbers-snapshot { border-top }`.
  addLine(slide, pptx, px(80), px(280), px(1760), 0, BRAND.foreground);
  addRoleText(slide, "BUILD SNAPSHOT", "sectionEyebrow", { x: px(80), y: px(298), w: px(540), h: px(24) }, { color: BRAND.mutedText });

  visible.forEach((stat, index) => {
    const x = px(80) + (cardW + gap) * index;
    const y = px(360);
    const accent = clean(stat.value).startsWith("+");
    addLine(slide, pptx, x, y, cardW, 0, BRAND.foreground);
    addRoleText(slide, stat.value, "statValue", { x, y: y + px(24), w: cardW, h: px(120) }, {
      color: accent ? BRAND.accent : BRAND.foreground,
      valign: "top",
      fitSafety: 0.96,
    });
    addRoleText(slide, upper(stat.label), "statLabel", { x, y: y + px(160), w: cardW, h: px(34) }, { color: BRAND.foreground });
    addRoleText(slide, stat.context, "statContext", { x, y: y + px(204), w: cardW, h: px(80) }, { color: BRAND.mutedText, maxLines: 3 });
  });

  const breakdown = Array.isArray(data.breakdown) ? data.breakdown : [];
  if (breakdown.length > 0) {
    addRect(slide, pptx, { x: px(80), y: px(740), w: px(1760), h: px(160) }, BRAND.soft, BRAND.mutedBorder);
    addRoleText(slide, upper(data.breakdownTitle ?? "Status breakdown"), "sectionEyebrow", { x: px(108), y: px(764), w: px(800), h: px(24) }, { color: BRAND.foreground });
    let cursor = px(108);
    const totalW = px(1704);
    breakdown.forEach((bar) => {
      const width = totalW * Math.max(Math.min(bar.widthPct, 100), 1) / 100;
      const fill = bar.variant === "accent" ? BRAND.accent : bar.variant === "outline" ? BRAND.cream : BRAND.foreground;
      addRect(slide, pptx, { x: cursor, y: px(810), w: width, h: px(56) }, fill, bar.variant === "outline" ? BRAND.mutedBorder : fill);
      const labelText = `${bar.label} ${bar.value}`;
      addRoleText(slide, labelText, "scopeBarLabel", {
        x: cursor + px(14),
        y: px(825),
        w: Math.max(width - px(28), px(60)),
        h: px(28),
      }, { color: bar.variant === "outline" ? BRAND.foreground : BRAND.cream });
      cursor += width;
    });
  }
}

function renderWorkstreams(slide: Slide, pptx: Pptx, presentation: Presentation, footerLabel: string): void {
  const data = presentation.workstreams_data;
  addChrome(slide, pptx, "cream", cornersFor(presentation), false);
  addHeader(slide, pptx, "03 · This Week", data.title ?? "Current work in flight", footerLabel);

  // The HTML uses `repeat(3, 1fr)` with 24px gap. Real decks regularly carry a
  // 4th workstream (e.g. design / payments / QA / launch), so allow up to 4
  // columns and shrink the decorative index zone so titles still get room.
  const items = (Array.isArray(data.workstreams) ? data.workstreams : []).slice(0, 4);
  const cols = Math.max(items.length, 1);
  const gap = px(24);
  const cardW = (px(1760) - gap * Math.max(cols - 1, 0)) / cols;
  const cardH = px(560);
  const padding = px(28);
  const indexBlockW = cols >= 4 ? px(78) : px(120);

  items.forEach((item, index) => {
    const x = px(80) + (cardW + gap) * index;
    const y = px(280);
    addRect(slide, pptx, { x, y, w: cardW, h: cardH }, BRAND.cream, BRAND.mutedBorder);
    if (index === 0) {
      addRect(slide, pptx, { x, y, w: cardW, h: px(3) }, BRAND.accent, BRAND.accent);
    }

    // Topline: id ⇄ points (caps, muted text).
    addRoleText(slide, upper(item.id), "workstreamId", { x: x + padding, y: y + padding, w: cardW / 2, h: px(22) }, { color: BRAND.mutedText });
    if (item.points) {
      addRoleText(slide, item.points, "workstreamPoints", { x: x + cardW / 2, y: y + padding, w: cardW / 2 - padding, h: px(22) }, { color: BRAND.mutedText, align: "right" });
    }

    // Decorative ghost number, parked top-right with a faint tint so it
    // never overlaps the title (HTML: position absolute, right 26px, top 76px).
    // The role's nominal size (~42pt) covers both 3-col and 4-col layouts;
    // `allowGrow` lets the 3-col case scale up to fill the larger zone.
    addRoleText(
      slide,
      String(index + 1).padStart(2, "0"),
      "workstreamIndex",
      { x: x + cardW - indexBlockW - px(8), y: y + px(72), w: indexBlockW, h: px(80) },
      { color: BRAND.borderLight, align: "right", allowGrow: true },
    );

    // Title: HTML caps to `max-width: 12ch`. Subtract the index zone so the
    // text frame physically can't collide with "01"/"02"/"03"/"04".
    const titleW = cardW - padding * 2 - indexBlockW;
    addRoleText(slide, item.name, "workstreamTitle", { x: x + padding, y: y + px(160), w: titleW, h: px(150) }, {
      color: BRAND.foreground,
      maxLines: 3,
    });

    addRoleText(slide, item.impact, "workstreamImpact", { x: x + padding, y: y + px(330), w: cardW - padding * 2, h: px(170) }, {
      color: BRAND.mutedText,
      maxLines: 6,
    });

    if (item.status) {
      const pillText = upper(item.status);
      const maxPillW = cardW - padding * 2;
      const pillW = Math.min(maxPillW, Math.max(px(120), pillText.length * px(13) + px(36)));
      const pillY = y + cardH - px(60);
      addRect(slide, pptx, { x: x + padding, y: pillY, w: pillW, h: px(34) }, BRAND.foreground, BRAND.foreground);
      addRoleText(slide, pillText, "workstreamPill", { x: x + padding, y: pillY + px(8), w: pillW, h: px(18) }, {
        color: BRAND.cream,
        align: "center",
      });
    }
  });

  if (data.callout?.text) addCallout(slide, pptx, data.callout.label, data.callout.text);
}

function renderRecommendations(slide: Slide, pptx: Pptx, presentation: Presentation, footerLabel: string): void {
  const data = presentation.recommendations_data;
  addChrome(slide, pptx, "cream", cornersFor(presentation), false);
  addHeader(slide, pptx, "04 · Recommendations", data?.title ?? "Our recommendations", footerLabel);
  if (data?.subtitle) {
    addRoleText(slide, data.subtitle, "slideSubtitle", { x: px(80), y: px(220), w: px(1260), h: px(44) }, { color: BRAND.mutedText });
  }
  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const lead = recommendations[0];
  const supporting = recommendations.slice(1, 4);
  const gridY = data?.subtitle ? px(298) : px(268);
  const leadW = px(960);
  const sideX = px(1068);
  const sideW = px(772);

  if (lead) {
    const leadInset = px(40);
    const leadInnerW = leadW - leadInset * 2;
    const leadH = px(580);
    addRect(slide, pptx, { x: px(80), y: gridY, w: leadW, h: leadH }, BRAND.foreground, BRAND.foreground);
    if (lead.priority) {
      const priorityText = upper(lead.priority);
      const pillW = Math.min(px(360), Math.max(px(180), priorityText.length * px(10)));
      addRect(slide, pptx, { x: px(80) + leadInset, y: gridY + px(30), w: pillW, h: px(32) }, BRAND.accentWarm, BRAND.accentWarm);
      addRoleText(slide, priorityText, "heroChip", { x: px(80) + leadInset, y: gridY + px(37), w: pillW, h: px(20) }, { color: BRAND.accent, align: "center" });
    }
    // Vertical rhythm packed tightly so the impact paragraph doesn't spill
    // below the hero card's bottom edge (gridY + leadH = 878px on the canvas).
    addRoleText(slide, lead.title, "heroTitle", { x: px(80) + leadInset, y: gridY + px(86), w: leadInnerW, h: px(180) }, { color: BRAND.cream, maxLines: 2 });
    addRoleText(slide, lead.rationale, "heroBody", { x: px(80) + leadInset, y: gridY + px(282), w: leadInnerW, h: px(120) }, { color: "D6D6D6", maxLines: 4 });
    addLine(slide, pptx, px(80) + leadInset, gridY + px(420), leadInnerW, 0, "444444");
    addRoleText(slide, "EXPECTED OUTCOME", "sectionEyebrow", { x: px(80) + leadInset, y: gridY + px(436), w: leadInnerW, h: px(20) }, { color: BRAND.accent });
    addRoleText(slide, lead.impact, "heroImpact", { x: px(80) + leadInset, y: gridY + px(462), w: leadInnerW, h: px(106) }, { color: BRAND.cream, maxLines: 4 });
  }

  // Supporting column (right). Match the hero card's vertical span so the
  // two columns line up, then split it evenly across however many supporting
  // cards we have. Each slot ends up ≈193–200px depending on count.
  const supportingTop = gridY;
  const supportingTotalH = px(600);
  const slotH = supportingTotalH / Math.max(supporting.length, 1);
  const indexW = px(82);
  const supportingBodyX = sideX + indexW + px(20);
  const supportingBodyW = sideW - indexW - px(20);
  // Layout per slot: index/chip top → title (≤2 lines) → rationale (≤3 lines)
  // → bold impact (≤2 lines). Block heights sum to ≈190px so a 200px slot
  // has predictable breathing room.
  const titleH = px(58);
  const rationaleH = px(58);
  const impactH = px(36);
  const blockGap = px(6);
  supporting.forEach((item, index) => {
    const y = supportingTop + index * slotH;
    addLine(slide, pptx, sideX, y, sideW, 0, index === 0 ? BRAND.dark : BRAND.mutedBorder);
    addRoleText(slide, String(index + 2).padStart(2, "0"), "supportingIndex", { x: sideX, y: y + px(18), w: indexW, h: px(46) }, { color: BRAND.accent });
    if (item.priority) {
      addRoleText(slide, upper(item.priority), "supportingChip", { x: supportingBodyX, y: y + px(20), w: supportingBodyW, h: px(18) }, { color: BRAND.accent, align: "right" });
    }
    const titleY = y + px(42);
    addRoleText(slide, item.title, "supportingTitle", { x: supportingBodyX, y: titleY, w: supportingBodyW, h: titleH }, { color: BRAND.foreground, maxLines: 2 });
    addRoleText(slide, item.rationale, "supportingBody", { x: supportingBodyX, y: titleY + titleH + blockGap, w: supportingBodyW, h: rationaleH }, { color: BRAND.mutedText, maxLines: 3 });
    if (item.impact) {
      addRoleText(slide, item.impact, "supportingImpact", { x: supportingBodyX, y: titleY + titleH + blockGap + rationaleH + blockGap, w: supportingBodyW, h: impactH }, { color: BRAND.foreground, maxLines: 2 });
    }
  });

  if (data?.callout?.text) addCallout(slide, pptx, data.callout.label, data.callout.text);
}

function groupsFor(data: Presentation["asks_data"]): AskGroup[] {
  if (Array.isArray(data?.groups) && data.groups.length > 0) return data.groups;
  const asks = Array.isArray(data?.asks) ? data.asks : [];
  return asks.length > 0 ? [{ label: "Client input needed", tone: "default", items: asks }] : [];
}

function renderAsks(slide: Slide, pptx: Pptx, presentation: Presentation, footerLabel: string): void {
  const data = presentation.asks_data;
  addChrome(slide, pptx, "cream", cornersFor(presentation), false);
  addHeader(slide, pptx, "05 · Asks", data.title ?? "What we need from you", footerLabel);

  const groups = groupsFor(data).slice(0, 3);
  if (groups.length === 0) {
    return;
  }

  // Side-rail copy column (group label + summary) and the rows column on the
  // right. Absolute coordinates keep every group aligned to the same vertical
  // grid even when summaries wrap to two lines.
  const railX = px(80);
  const railW = px(360);
  const rowsX = px(480);
  const rowsW = px(1360);
  // Long bold-uppercase pill labels like "BLOCKING DESIGN FREEZE" need ≈0.6
  // glyph width per pt, so a pillW around px(290) keeps them on one line at
  // ~9pt without clipping the trailing letter.
  const pillW = px(300);
  const ownerW = px(180);
  // Reserve space on the right for owner + priority pill, then the ask/detail
  // text occupies whatever remains. This keeps long pill labels like
  // "BLOCKING DESIGN FREEZE" from getting clipped at narrower rows.
  const askW = rowsW - ownerW - pillW - px(40);
  const ownerX = rowsX + askW + px(20);
  const pillX = rowsX + rowsW - pillW;

  // Distribute available vertical space (270 → 900) proportional to the total
  // number of items across groups so a 3-item group is taller than a 2-item
  // one and rows render at a uniform height (looks tidy + predictable).
  const sectionTopY = px(270);
  const sectionBottomY = px(900);
  const totalH = sectionBottomY - sectionTopY;
  const groupGap = px(24);
  const itemCounts = groups.map((g) => Math.max(g.items.length, 1));
  const totalItems = itemCounts.reduce((sum, count) => sum + count, 0);
  const availableForRows = totalH - groupGap * (groups.length - 1);
  const rowH = availableForRows / totalItems;

  let cursor = sectionTopY;
  groups.forEach((group, index) => {
    const itemCount = itemCounts[index];
    const groupH = rowH * itemCount;
    const sectionTop = cursor;
    const dot =
      group.tone === "urgent"
        ? "EF4444"
        : group.tone === "access"
        ? BRAND.warning
        : group.tone === "upcoming"
        ? "94A3B8"
        : BRAND.muted;

    addEllipse(slide, pptx, { x: railX, y: sectionTop + px(14), w: px(16), h: px(16) }, dot, dot);
    addRoleText(slide, group.label, "askGroupLabel", { x: railX + px(28), y: sectionTop + px(6), w: railW - px(28), h: px(34) }, { color: BRAND.foreground });
    if (group.summary) {
      addRoleText(slide, group.summary, "askGroupSummary", { x: railX + px(28), y: sectionTop + px(48), w: railW - px(28), h: groupH - px(56) }, { color: BRAND.mutedText, maxLines: 4 });
    }

    addLine(slide, pptx, rowsX, sectionTop, rowsW, 0, BRAND.dark);
    const items = group.items.slice(0, itemCount);
    items.forEach((row, rowIndex) => {
      const rowY = sectionTop + rowH * rowIndex;
      addRoleText(slide, row.ask, "askName", { x: rowsX, y: rowY + px(8), w: askW, h: px(34) }, { color: BRAND.foreground });
      if (row.detail) {
        addRoleText(slide, row.detail, "askDetail", { x: rowsX, y: rowY + px(42), w: askW, h: rowH - px(48) }, { color: BRAND.mutedText, maxLines: 3 });
      }
      if (row.owner) {
        addRoleText(slide, row.owner, "askOwner", { x: ownerX, y: rowY + px(12), w: ownerW, h: px(28) }, { color: BRAND.foreground });
      }
      const priorityText = upper(row.priority);
      if (priorityText) {
        addRect(slide, pptx, { x: pillX, y: rowY + px(10), w: pillW, h: px(28) }, BRAND.foreground, BRAND.foreground);
        addRoleText(slide, priorityText, "askPill", { x: pillX + px(8), y: rowY + px(15), w: pillW - px(16), h: px(20) }, { color: BRAND.cream, align: "center" });
      }
      if (rowIndex < items.length - 1) {
        addLine(slide, pptx, rowsX, rowY + rowH - px(2), rowsW, 0, BRAND.mutedBorder);
      }
    });
    cursor += groupH + groupGap;
  });

  if (data.callout?.text) addCallout(slide, pptx, data.callout.label, data.callout.text, px(940));
}

function renderClosing(slide: Slide, pptx: Pptx, presentation: Presentation, corners: CornerLabels): void {
  const data = presentation.closing_data;
  addChrome(slide, pptx, "dark", corners, true);
  addImageFrame(slide, pptx, data.closingImageUrl, { x: px(990), y: px(28), w: px(902), h: px(612) }, true);
  addDivider(slide, pptx, "3A3A3A");
  addRoleText(
    slide,
    formatPresentationDisplayTitle(data.heroText),
    "coverHero",
    { x: 0, y: px(680), w: PPTX_WIDTH, h: px(400) },
    { color: BRAND.accent, align: "center", valign: "mid" },
  );
  addRoleText(slide, data.thankYou, "coverMeta", { x: px(101), y: px(360), w: px(840), h: px(52) }, { color: BRAND.cream });
  addRoleText(slide, data.teamLine, "coverMeta", { x: px(101), y: px(430), w: px(840), h: px(36) }, { color: BRAND.cream });
  addRoleText(slide, data.dateLine, "coverMeta", { x: px(101), y: px(500), w: px(840), h: px(36) }, { color: BRAND.cream });
}

export async function renderDeckToPptx(presentation: Presentation, outputPath: string): Promise<void> {
  const pptx = new PptxGen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Imaginary Space";
  pptx.company = "Imaginary Space";
  pptx.subject = "Presentation";
  pptx.title = presentation.title || path.basename(outputPath, ".pptx");
  pptx.theme = {
    headFontFace: FONT.body,
    bodyFontFace: FONT.body,
    lang: "en-US",
  } as never;

  const corners = cornersFor(presentation);
  const footerLabel = footerLabelFor(presentation);
  let slideCount = 0;

  if (hasRenderableData(presentation.cover_data)) {
    renderCover(pptx.addSlide(), pptx, presentation, corners);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.timeline_data)) {
    renderTimeline(pptx.addSlide(), pptx, presentation.timeline_data, corners, footerLabel);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.numbers_data)) {
    renderNumbers(pptx.addSlide(), pptx, presentation, footerLabel);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.workstreams_data)) {
    renderWorkstreams(pptx.addSlide(), pptx, presentation, footerLabel);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.recommendations_data)) {
    renderRecommendations(pptx.addSlide(), pptx, presentation, footerLabel);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.asks_data)) {
    renderAsks(pptx.addSlide(), pptx, presentation, footerLabel);
    slideCount += 1;
  }
  if (hasRenderableData(presentation.closing_data)) {
    renderClosing(pptx.addSlide(), pptx, presentation, corners);
    slideCount += 1;
  }

  if (slideCount === 0) {
    throw new Error("Presentation JSON did not contain any renderable slide data");
  }

  await pptx.writeFile({ fileName: outputPath });
}
