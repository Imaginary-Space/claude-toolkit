export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;
export const PPTX_WIDTH = 13.333333;
export const PPTX_HEIGHT = 7.5;
export const PX_TO_IN = PPTX_WIDTH / SLIDE_WIDTH;

export const BRAND = {
  accent: "F05100",
  accentWarm: "FFF1E8",
  cream: "FFFFFF",
  dark: "0A0A0A",
  foreground: "171717",
  muted: "A3A3A3",
  mutedText: "737373",
  mutedBorder: "E5E5E5",
  borderLight: "F0F0F0",
  soft: "FAFAFA",
  warm: "F5F5F5",
  success: "22C55E",
  warning: "F59E0B",
} as const;

export const FONT = {
  body: "Funnel Display",
  fallback: "Inter",
} as const;

export function px(value: number): number {
  return value * PX_TO_IN;
}

export function pt(cssPx: number): number {
  return cssPx * 0.75;
}

/**
 * pptxgenjs renders text inside a fixed text frame and will wrap or clip when
 * the rendered string is wider than the frame. Its built-in `fit: "shrink"`
 * applies at PowerPoint open time only and is unreliable for long values like
 * "27 / 35" inside narrow stat cards. This helper computes a font size in
 * points that keeps `text` on at most `maxLines` lines inside `widthInches`.
 *
 * `charWidth` is the average glyph width as a fraction of the font size in pt.
 * 0.55 is a safe default for sans-serif body text; titles can use 0.50 since
 * tighter tracking is typical at large display sizes.
 */
export function fitText({
  text,
  widthInches,
  maxLines = 1,
  maxFontPt,
  minFontPt,
  charWidth = 0.55,
  safety = 0.92,
  trackingPt = 0,
}: {
  text: unknown;
  widthInches: number;
  maxLines?: number;
  maxFontPt: number;
  minFontPt: number;
  charWidth?: number;
  safety?: number;
  /** Extra letter spacing applied to each character, in points. Letter-spaced
   * caps (e.g. "STORE READINESS") render meaningfully wider than the bare
   * char-width estimate suggests, so callers should pass the role's tracking
   * value here to avoid overflow. */
  trackingPt?: number;
}): number {
  const value = String(text ?? "").trim();
  if (!value) {
    return maxFontPt;
  }
  const longestWord = value.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);
  // Rendered width per line is N × (charWidth × fontPt + trackingPt). We need
  //   N × (charWidth × fontPt + trackingPt) ≤ widthInches × 72 × safety
  // solving for fontPt:
  //   fontPt ≤ (widthInches × 72 × safety / N − trackingPt) / charWidth
  // Use the larger of avg-line length and the longest unbreakable word so
  // tokens like "Phenometrix" stay on a single line.
  const widthPt = widthInches * 72 * safety;
  const avgPerLine = Math.max(value.length / Math.max(maxLines, 1), longestWord, 1);
  const fitFromWidth = (widthPt / avgPerLine - trackingPt) / Math.max(charWidth, 0.0001);
  return Math.min(Math.max(fitFromWidth, minFontPt), maxFontPt);
}
