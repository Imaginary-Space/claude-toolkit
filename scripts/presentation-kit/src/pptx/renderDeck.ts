import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { cornersFor, footerLabelFor, hasRenderableData } from "../deckModel";
import { BRAND, FONT, PPTX_HEIGHT, PPTX_WIDTH, pt, px } from "../layout";
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
  fit?: "shrink" | "resize";
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function upper(value: unknown): string {
  return clean(value).toUpperCase();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function compactLength(value: unknown): number {
  return clean(value).replace(/\s+/g, "").length;
}

function fontByLength(value: unknown, max: number, min: number, startChars: number, step = 2.4): number {
  return clamp(max - Math.max(0, compactLength(value) - startChars) * step, min, max);
}

function titleFont(value: unknown, max: number, min: number, startChars = 16): number {
  return fontByLength(value, max, min, startChars, 1.6);
}

function bodyFont(value: unknown, max: number, min: number, startChars = 90): number {
  return fontByLength(value, max, min, startChars, 0.12);
}

function maxItems<T>(items: T[], count: number): T[] {
  return items.slice(0, Math.max(count, 0));
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
  const opacity = dark ? 70 : 0;
  const style = {
    fontSize: 5.4,
    color,
    bold: false,
    margin: 0,
    fit: "shrink" as const,
  };
  addText(slide, upper(corners.tl ?? "Imaginary Space"), { x: px(40), y: px(32), w: px(360), h: px(24), ...style });
  addText(slide, upper(corners.tr ?? ""), { x: px(1480), y: px(32), w: px(400), h: px(24), align: "right", ...style });
  addText(slide, upper(corners.bl ?? ""), { x: px(40), y: px(1024), w: px(600), h: px(24), ...style });
  addText(slide, upper(corners.br ?? ""), { x: px(1280), y: px(1024), w: px(600), h: px(24), align: "right", ...style });

  if (opacity > 0) {
    // The dark-slide corner text intentionally stays subtle in the HTML. PPTX
    // lacks CSS opacity for text, so use a dimmer color instead of transparency.
  }
}

function addChrome(slide: Slide, pptx: Pptx, variant: "cream" | "dark", corners?: CornerLabels, showCorners = true): void {
  slide.background = { color: variant === "dark" ? BRAND.foreground : BRAND.cream };
  addRect(slide, pptx, { x: 0, y: 0, w: PPTX_WIDTH, h: PPTX_HEIGHT }, variant === "dark" ? BRAND.foreground : BRAND.cream);
  if (showCorners && corners) {
    addCorners(slide, corners, variant === "dark");
  }
}

function addHeader(slide: Slide, pptx: Pptx, eyebrow: string, title: string, footerLabel: string): void {
  addText(slide, upper(eyebrow), {
    x: px(80),
    y: px(88),
    w: px(700),
    h: px(22),
    fontSize: pt(13),
    color: BRAND.accent,
    bold: true,
    fit: "shrink",
  });
  addText(slide, upper(footerLabel), {
    x: px(960),
    y: px(88),
    w: px(880),
    h: px(22),
    fontSize: pt(13),
    color: BRAND.mutedText,
    align: "right",
    fit: "shrink",
  });
  addLine(slide, pptx, px(80), px(124), px(1760), 0, BRAND.mutedBorder);
  addText(slide, title, {
    x: px(80),
    y: px(138),
    w: px(1760),
    h: px(78),
    fontSize: pt(60),
    color: BRAND.foreground,
    bold: true,
    fit: "shrink",
  });
}

function addCallout(slide: Slide, pptx: Pptx, label: string | undefined, text: string, y = px(936)): void {
  addLine(slide, pptx, px(80), y, px(1620), 0, BRAND.mutedBorder);
  addLine(slide, pptx, px(96), y + px(16), 0, px(58), BRAND.accent);
  if (label) {
    addText(slide, upper(label), {
      x: px(128),
      y: y + px(18),
      w: px(210),
      h: px(24),
      fontSize: pt(13),
      color: BRAND.accent,
      bold: true,
      fit: "shrink",
    });
  }
  addText(slide, text, {
    x: px(label ? 350 : 128),
    y: y + px(14),
    w: px(label ? 1320 : 1535),
    h: px(66),
    fontSize: pt(18),
    color: BRAND.foreground,
    fit: "shrink",
  });
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
  addText(slide, formatPresentationDisplayTitle(data.heroText), {
    x: 0,
    y: px(680),
    w: PPTX_WIDTH,
    h: px(400),
    fontSize: 150,
    color: BRAND.accent,
    bold: true,
    align: "center",
    valign: "mid",
    fit: "shrink",
  });
  addText(slide, `TEAM: ${data.team ?? ""}`, { x: px(101), y: px(360), w: px(840), h: px(52), fontSize: 20, fit: "shrink" });
  addText(slide, `DATE: ${data.date ?? ""}`, { x: px(101), y: px(453), w: px(840), h: px(36), fontSize: 17, fit: "shrink" });
  addText(slide, `CYCLE: ${data.cycle ?? ""}`, { x: px(101), y: px(520), w: px(840), h: px(36), fontSize: 17, fit: "shrink" });
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
  const todayCol = Math.min(Math.max(data.todayColumn ?? 0, 0), Math.max(dates.length - 1, 0));
  const tracks = (data.sections ?? []).flatMap((section) =>
    section.tasks.map((task) => ({ section: section.label, name: task.name, cells: task.cells, ...trackState(task.cells, dates) })),
  );
  const x = px(80);
  const y = px(260);
  const w = px(1760);
  const introW = px(360);
  const statusW = px(150);
  const colW = (w - introW - statusW) / Math.max(dates.length, 1);

  addRect(slide, pptx, { x, y, w, h: px(92) }, BRAND.soft, BRAND.borderLight);
  addLine(slide, pptx, x, y, w, 0, BRAND.dark);
  addText(slide, "PROJECT SCOPE", { x: x + px(18), y: y + px(58), w: introW - px(36), h: px(20), fontSize: pt(11), color: BRAND.mutedText, bold: true, fit: "shrink" });
  dates.forEach((date, index) => {
    const cx = x + introW + colW * index;
    const tone = index === todayCol ? BRAND.accent : index < todayCol ? BRAND.foreground : BRAND.muted;
    addEllipse(slide, pptx, { x: cx + px(18), y: y + px(18), w: px(10), h: px(10) }, tone, tone);
    addText(slide, date, { x: cx + px(18), y: y + px(58), w: colW - px(26), h: px(22), fontSize: pt(14), color: BRAND.foreground, bold: true, fit: "shrink" });
    if (index === todayCol) {
      addText(slide, "CURRENT", { x: cx + px(18), y: y + px(40), w: colW - px(26), h: px(18), fontSize: pt(10), color: BRAND.accent, bold: true, fit: "shrink" });
    }
  });
  addText(slide, "STATUS", { x: x + w - statusW, y: y + px(58), w: statusW - px(18), h: px(20), fontSize: pt(11), color: BRAND.mutedText, bold: true, align: "right", fit: "shrink" });

  const laneH = Math.min(px(88), px(520) / Math.max(tracks.length, 1));
  tracks.forEach((track, index) => {
    const rowY = y + px(120) + laneH * index;
    addLine(slide, pptx, x, rowY + laneH - px(8), w, 0, BRAND.mutedBorder);
    addText(slide, upper(track.section), { x: x, y: rowY + px(14), w: introW - px(20), h: px(18), fontSize: pt(11), color: BRAND.accent, bold: true, fit: "shrink" });
    addText(slide, track.name, { x: x, y: rowY + px(36), w: introW - px(20), h: laneH - px(42), fontSize: pt(28), bold: true, color: BRAND.foreground, fit: "shrink" });
    dates.forEach((_, colIndex) => {
      const cell = normalizeCell(track.cells[colIndex] ?? "empty");
      const cx = x + introW + colW * colIndex + px(4);
      const cy = rowY + laneH / 2 - px(9);
      const fill =
        cell === "done" ? BRAND.foreground : cell === "ongoing" ? BRAND.accent : cell === "future" ? BRAND.accentWarm : BRAND.cream;
      const line = cell === "empty" ? BRAND.mutedBorder : fill;
      addRect(slide, pptx, { x: cx, y: cy, w: colW - px(12), h: px(18) }, fill, line, cell === "empty" ? 100 : 0);
    });
    const statusColor = track.tone === "active" ? BRAND.accent : track.tone === "done" ? BRAND.foreground : BRAND.mutedText;
    addText(slide, upper(track.status), { x: x + w - statusW + px(8), y: rowY + px(20), w: statusW - px(8), h: px(22), fontSize: pt(12), color: statusColor, bold: true, align: "right", fit: "shrink" });
    addText(slide, track.stage, { x: x + w - statusW + px(8), y: rowY + px(50), w: statusW - px(8), h: px(20), fontSize: pt(12), color: BRAND.mutedText, bold: true, align: "right", fit: "shrink" });
  });

  if (data.callout?.text) addCallout(slide, pptx, data.callout.label, data.callout.text);
}

function renderNumbers(slide: Slide, pptx: Pptx, presentation: Presentation, footerLabel: string): void {
  const data = presentation.numbers_data;
  addChrome(slide, pptx, "cream", cornersFor(presentation), false);
  addHeader(slide, pptx, "02 · Numbers", data.title ?? "By the numbers", footerLabel);
  addLine(slide, pptx, px(80), px(278), px(1760), 0, BRAND.dark);
  addText(slide, "BUILD SNAPSHOT", { x: px(80), y: px(296), w: px(380), h: px(24), fontSize: pt(13), color: BRAND.mutedText, bold: true, fit: "shrink" });

  const stats = Array.isArray(data.stats) ? data.stats : [];
  const cols = stats.length <= 2 ? 2 : stats.length === 3 ? 3 : 4;
  const gap = px(56);
  const cardW = (px(1760) - gap * (cols - 1)) / cols;
  stats.slice(0, 4).forEach((stat, index) => {
    const x = px(80) + (cardW + gap) * index;
    const y = px(360);
    const accent = clean(stat.value).startsWith("+");
    const valueFont = fontByLength(stat.value, pt(88), pt(38), 3, 6);
    const valueHeight = valueFont <= pt(48) ? px(76) : px(112);
    addLine(slide, pptx, x, y, cardW, 0, BRAND.foreground);
    addText(slide, stat.value, {
      x,
      y: y + px(24),
      w: cardW,
      h: valueHeight,
      fontSize: valueFont,
      color: accent ? BRAND.accent : BRAND.foreground,
      bold: true,
      fit: "shrink",
    });
    addText(slide, upper(stat.label), {
      x,
      y: y + px(150),
      w: cardW,
      h: px(34),
      fontSize: fontByLength(stat.label, pt(13), pt(9), 18, 0.45),
      color: BRAND.foreground,
      bold: true,
      fit: "shrink",
    });
    addText(slide, stat.context, { x, y: y + px(194), w: cardW, h: px(56), fontSize: bodyFont(stat.context, pt(14), pt(10), 42), color: BRAND.mutedText, fit: "shrink" });
  });

  const breakdown = Array.isArray(data.breakdown) ? data.breakdown : [];
  if (breakdown.length > 0) {
    addRect(slide, pptx, { x: px(80), y: px(730), w: px(1760), h: px(160) }, BRAND.soft, BRAND.mutedBorder);
    addText(slide, upper(data.breakdownTitle ?? "Status breakdown"), { x: px(108), y: px(756), w: px(520), h: px(24), fontSize: pt(13), color: BRAND.foreground, bold: true, fit: "shrink" });
    let cursor = px(108);
    const totalW = px(1704);
    breakdown.forEach((bar) => {
      const width = totalW * Math.max(Math.min(bar.widthPct, 100), 1) / 100;
      const fill = bar.variant === "accent" ? BRAND.accent : bar.variant === "outline" ? BRAND.cream : BRAND.foreground;
      addRect(slide, pptx, { x: cursor, y: px(800), w: width, h: px(56) }, fill, bar.variant === "outline" ? BRAND.mutedBorder : fill);
      addText(slide, `${bar.label} ${bar.value}`, { x: cursor + px(14), y: px(815), w: Math.max(width - px(28), px(80)), h: px(22), fontSize: pt(12), color: bar.variant === "outline" ? BRAND.foreground : BRAND.cream, fit: "shrink" });
      cursor += width;
    });
  }
}

function renderWorkstreams(slide: Slide, pptx: Pptx, presentation: Presentation, footerLabel: string): void {
  const data = presentation.workstreams_data;
  addChrome(slide, pptx, "cream", cornersFor(presentation), false);
  addHeader(slide, pptx, "03 · This Week", data.title ?? "Current work in flight", footerLabel);
  const items = (Array.isArray(data.workstreams) ? data.workstreams : []).slice(0, 4);
  const cols = Math.min(Math.max(items.length, 1), 4);
  const gap = px(24);
  const cardW = (px(1760) - gap * (cols - 1)) / cols;
  items.forEach((item, index) => {
    const x = px(80) + (cardW + gap) * index;
    const y = px(270);
    addRect(slide, pptx, { x, y, w: cardW, h: px(590) }, BRAND.cream, BRAND.mutedBorder);
    if (index === 0) {
      addRect(slide, pptx, { x, y, w: cardW, h: px(3) }, BRAND.accent, BRAND.accent);
    }
    addText(slide, upper(item.id), { x: x + px(28), y: y + px(28), w: cardW / 2, h: px(22), fontSize: pt(12), color: BRAND.mutedText, bold: true, fit: "shrink" });
    addText(slide, item.points, { x: x + cardW / 2, y: y + px(28), w: cardW / 2 - px(28), h: px(22), fontSize: pt(12), color: BRAND.mutedText, bold: true, align: "right", fit: "shrink" });
    addText(slide, String(index + 1).padStart(2, "0"), { x: x + cardW - px(132), y: y + px(72), w: px(104), h: px(76), fontSize: pt(64), color: BRAND.borderLight, bold: true, align: "right", fit: "shrink" });
    addText(slide, item.name, {
      x: x + px(28),
      y: y + px(150),
      w: cardW - px(56),
      h: px(160),
      fontSize: titleFont(item.name, pt(38), pt(21), 14),
      bold: true,
      color: BRAND.foreground,
      fit: "shrink",
    });
    addText(slide, item.impact, {
      x: x + px(28),
      y: y + px(330),
      w: cardW - px(56),
      h: px(128),
      fontSize: bodyFont(item.impact, pt(17), pt(10), 92),
      color: BRAND.mutedText,
      fit: "shrink",
    });
    if (item.status) {
      const pillW = px(170);
      addRect(slide, pptx, { x: x + px(28), y: y + px(520), w: pillW, h: px(34) }, BRAND.foreground, BRAND.foreground);
      addText(slide, upper(item.status), { x: x + px(42), y: y + px(529), w: pillW - px(28), h: px(16), fontSize: pt(11), color: BRAND.cream, align: "center", fit: "shrink" });
    }
  });
  if (data.callout?.text) addCallout(slide, pptx, data.callout.label, data.callout.text);
}

function renderRecommendations(slide: Slide, pptx: Pptx, presentation: Presentation, footerLabel: string): void {
  const data = presentation.recommendations_data;
  addChrome(slide, pptx, "cream", cornersFor(presentation), false);
  addHeader(slide, pptx, "04 · Recommendations", data?.title ?? "Our recommendations", footerLabel);
  if (data?.subtitle) {
    addText(slide, data.subtitle, { x: px(80), y: px(220), w: px(1260), h: px(44), fontSize: pt(18), color: BRAND.mutedText, fit: "shrink" });
  }
  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const lead = recommendations[0];
  const supporting = recommendations.slice(1, 4);
  const gridY = data?.subtitle ? px(300) : px(270);
  const leadW = px(960);
  const sideX = px(1068);
  if (lead) {
    addRect(slide, pptx, { x: px(80), y: gridY, w: leadW, h: px(570) }, BRAND.foreground, BRAND.foreground);
    if (lead.priority) {
      addRect(slide, pptx, { x: px(120), y: gridY + px(40), w: px(270), h: px(32) }, BRAND.accentWarm, BRAND.accentWarm);
      addText(slide, upper(lead.priority), { x: px(134), y: gridY + px(48), w: px(242), h: px(14), fontSize: pt(11), color: BRAND.accent, bold: true, align: "center", fit: "shrink" });
    }
    addText(slide, lead.title, {
      x: px(120),
      y: gridY + px(108),
      w: px(720),
      h: px(188),
      fontSize: titleFont(lead.title, pt(64), pt(28), 14),
      color: BRAND.cream,
      bold: true,
      fit: "shrink",
    });
    addText(slide, lead.rationale, {
      x: px(120),
      y: gridY + px(310),
      w: px(720),
      h: px(112),
      fontSize: bodyFont(lead.rationale, pt(20), pt(11), 110),
      color: "D6D6D6",
      fit: "shrink",
    });
    addLine(slide, pptx, px(120), gridY + px(466), px(720), 0, "444444");
    addText(slide, "EXPECTED OUTCOME", { x: px(120), y: gridY + px(492), w: px(320), h: px(20), fontSize: pt(12), color: BRAND.accent, bold: true, fit: "shrink" });
    addText(slide, lead.impact, { x: px(120), y: gridY + px(522), w: px(760), h: px(54), fontSize: bodyFont(lead.impact, pt(18), pt(11), 92), color: BRAND.cream, fit: "shrink" });
  }
  supporting.forEach((item, index) => {
    const y = gridY + index * px(178);
    addLine(slide, pptx, sideX, index === 0 ? y : y - px(1), px(772), 0, index === 0 ? BRAND.dark : BRAND.mutedBorder);
    addText(slide, String(index + 2).padStart(2, "0"), { x: sideX, y: y + px(28), w: px(76), h: px(42), fontSize: pt(34), color: BRAND.accent, bold: true, fit: "shrink" });
    addText(slide, item.title, { x: sideX + px(102), y: y + px(22), w: px(420), h: px(58), fontSize: titleFont(item.title, pt(26), pt(15), 18), bold: true, color: BRAND.foreground, fit: "shrink" });
    if (item.priority) addText(slide, upper(item.priority), { x: sideX + px(540), y: y + px(34), w: px(232), h: px(18), fontSize: pt(11), color: BRAND.accent, bold: true, align: "right", fit: "shrink" });
    addText(slide, item.rationale, { x: sideX + px(102), y: y + px(82), w: px(640), h: px(54), fontSize: bodyFont(item.rationale, pt(15), pt(9.5), 105), color: BRAND.mutedText, fit: "shrink" });
    addText(slide, item.impact, { x: sideX + px(102), y: y + px(140), w: px(640), h: px(34), fontSize: bodyFont(item.impact, pt(13), pt(9), 95), bold: true, color: BRAND.foreground, fit: "shrink" });
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
  let y = px(270);
  groups.forEach((group, index) => {
    const dot = group.tone === "urgent" ? "EF4444" : group.tone === "access" ? BRAND.warning : group.tone === "upcoming" ? "94A3B8" : BRAND.muted;
    const rowCount = Math.min(group.items.length, index === 0 ? 5 : 2);
    const sectionTop = y;
    const rowsX = px(464);
    const rowsW = px(1376);
    addEllipse(slide, pptx, { x: px(80), y: sectionTop + px(13), w: px(18), h: px(18) }, dot, dot);
    addText(slide, group.label, { x: px(116), y: sectionTop + px(6), w: px(320), h: px(34), fontSize: fontByLength(group.label, pt(12), pt(8.5), 22, 0.35), bold: true, color: BRAND.foreground, fit: "shrink" });
    addText(slide, group.summary, { x: px(116), y: sectionTop + px(44), w: px(320), h: px(54), fontSize: bodyFont(group.summary, pt(13), pt(9), 58), color: BRAND.mutedText, fit: "shrink" });
    addLine(slide, pptx, rowsX, sectionTop, rowsW, 0, BRAND.dark);
    maxItems(group.items, rowCount).forEach((row, rowIndex) => {
      const rowY = sectionTop + px(8) + rowIndex * px(50);
      addText(slide, row.ask, { x: rowsX, y: rowY, w: px(470), h: px(24), fontSize: titleFont(row.ask, pt(16), pt(10), 28), bold: true, color: BRAND.foreground, fit: "shrink" });
      addText(slide, row.detail, { x: rowsX, y: rowY + px(24), w: px(470), h: px(20), fontSize: bodyFont(row.detail, pt(11), pt(8), 58), color: BRAND.mutedText, fit: "shrink" });
      addText(slide, row.owner, { x: rowsX + px(930), y: rowY + px(10), w: px(220), h: px(24), fontSize: fontByLength(row.owner, pt(14), pt(9), 16, 0.45), bold: true, color: BRAND.foreground, fit: "shrink" });
      addRect(slide, pptx, { x: rowsX + px(1180), y: rowY + px(8), w: px(196), h: px(26) }, BRAND.foreground, BRAND.foreground);
      addText(slide, upper(row.priority), { x: rowsX + px(1190), y: rowY + px(15), w: px(176), h: px(12), fontSize: fontByLength(row.priority, pt(9), pt(6.2), 12, 0.35), color: BRAND.cream, align: "center", fit: "shrink" });
      addLine(slide, pptx, rowsX, sectionTop + px(50) * (rowIndex + 1), rowsW, 0, BRAND.mutedBorder);
    });
    y += px(Math.max(70, rowCount * 50) + (index === groups.length - 1 ? 0 : 22));
  });
  if (data.callout?.text) addCallout(slide, pptx, data.callout.label, data.callout.text, px(940));
}

function renderClosing(slide: Slide, pptx: Pptx, presentation: Presentation, corners: CornerLabels): void {
  const data = presentation.closing_data;
  addChrome(slide, pptx, "dark", corners, true);
  addImageFrame(slide, pptx, data.closingImageUrl, { x: px(990), y: px(28), w: px(902), h: px(612) }, true);
  addDivider(slide, pptx, "3A3A3A");
  addText(slide, formatPresentationDisplayTitle(data.heroText), {
    x: 0,
    y: px(680),
    w: PPTX_WIDTH,
    h: px(400),
    fontSize: 150,
    color: BRAND.accent,
    bold: true,
    align: "center",
    valign: "mid",
    fit: "shrink",
  });
  addText(slide, data.thankYou, { x: px(101), y: px(360), w: px(840), h: px(52), fontSize: 20, color: BRAND.cream, fit: "shrink" });
  addText(slide, data.teamLine, { x: px(101), y: px(430), w: px(840), h: px(36), fontSize: 16, color: BRAND.cream, fit: "shrink" });
  addText(slide, data.dateLine, { x: px(101), y: px(500), w: px(840), h: px(36), fontSize: 16, color: BRAND.cream, fit: "shrink" });
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
