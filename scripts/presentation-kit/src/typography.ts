import { fitText, pt } from "./layout";
import { TypeScale, type TypeRoleName } from "./typeScale";

export interface RoleStyleOptions {
  /**
   * If provided, the helper computes a font size that keeps the value on at
   * most `maxLines` lines inside this width (in PowerPoint inches). Without
   * a `fitWidth` the role's nominal `cssPx → pt` size is used unchanged.
   */
  fitWidth?: number;
  /** Max number of lines to allow when fitting. Defaults to 1. */
  maxLines?: number;
  /** Override the value used to size the text (defaults to the rendered text). */
  fitValue?: unknown;
  /** Optional safety multiplier for the rendered width when fitting (0–1). */
  safety?: number;
  /**
   * Allow the helper to *grow* the font above the role's `cssPx` value. Off
   * by default — most callers want to honour the design system, not float
   * above it.
   */
  allowGrow?: boolean;
}

export interface RoleStyle {
  fontSize: number;
  bold: boolean;
  charSpacing?: number;
  lineSpacingMultiple: number;
  /** True for single-line roles so callers can default `wrap: false`. */
  singleLine: boolean;
}

const SINGLE_LINE_ROLES: Set<TypeRoleName> = new Set([
  "slideEyebrow",
  "slideFooter",
  "cornerLabel",
  "sectionEyebrow",
  "statLabel",
  "scopeBarLabel",
  "workstreamId",
  "workstreamPoints",
  "workstreamIndex",
  "workstreamPill",
  "heroChip",
  "supportingIndex",
  "supportingChip",
  "askOwner",
  "askPill",
  "timelineHeader",
  "timelineStage",
  "timelineCurrent",
  "timelineSection",
  "timelineStatus",
  "timelineStageHint",
  "calloutLabel",
  "coverHero",
  "coverMeta",
]);

/**
 * Resolve a type-scale role into the props pptxgenjs needs. When `fitWidth`
 * is given, the size is shrunk (down to `role.minRatio * cssPx`) so the text
 * stays on the requested number of lines without overflowing the frame.
 */
export function roleStyle(name: TypeRoleName, opts: RoleStyleOptions = {}): RoleStyle {
  const role = TypeScale[name];
  const nominalPt = pt(role.cssPx);
  const minRatio = role.minRatio ?? 0.65;
  const minPt = nominalPt * minRatio;
  const maxPt = opts.allowGrow ? nominalPt * 1.5 : nominalPt;

  let fontSize = nominalPt;
  if (typeof opts.fitWidth === "number" && opts.fitWidth > 0) {
    // role.tracking is in 1/100 of a point (matches the OOXML serialization).
    // Convert to points so fitText can subtract it from the per-character
    // width budget.
    const trackingPt = (role.tracking ?? 0) / 100;
    fontSize = fitText({
      text: opts.fitValue ?? "",
      widthInches: opts.fitWidth,
      maxLines: opts.maxLines ?? 1,
      maxFontPt: maxPt,
      minFontPt: minPt,
      charWidth: role.charWidth,
      safety: opts.safety,
      trackingPt,
    });
  }

  return {
    fontSize,
    bold: role.weight >= 600,
    // tracking is encoded in 1/100 of a point. The renderer divides by 100
    // again before passing through to pptxgenjs (which itself multiplies by
    // 100 on serialize), so callers see "200 = 2pt of letter spacing".
    charSpacing: role.tracking,
    lineSpacingMultiple: role.lineHeight,
    singleLine: SINGLE_LINE_ROLES.has(name),
  };
}
