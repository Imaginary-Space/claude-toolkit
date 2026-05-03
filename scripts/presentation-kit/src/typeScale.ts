/**
 * Shared type scale for the presentation-kit deck.
 *
 * Values mirror the CSS in `src/styles/presentations.css` (everything is in
 * CSS pixels, the same coordinate system the React HTML preview uses) and
 * `src/pptx/renderDeck.ts` converts them to PowerPoint points via `pt()`.
 *
 * Each role describes:
 *   - `cssPx`       Nominal CSS pixel size (matches the corresponding CSS rule).
 *   - `weight`      Font weight (only `bold` / `regular` survive into PPTX).
 *   - `lineHeight`  Used for multi-line text frames; PPTX treats this as
 *                   `lineSpacingMultiple`.
 *   - `tracking`    Letter spacing in 1/100 of a point. The renderer divides
 *                   by 100 again before passing to pptxgenjs because the lib
 *                   re-multiplies on output (see comment in `renderDeck.ts`).
 *   - `charWidth`   Average glyph width as a fraction of the font's pt size.
 *                   ~0.50 for sentence-case display copy, ~0.55–0.62 for bold
 *                   uppercase. Used by `fitText` to pick a font size that
 *                   keeps a string on the requested number of lines.
 *   - `minRatio`    Lower bound for width-aware shrink (e.g. 0.55 means we
 *                   will never shrink below 55% of the nominal size before
 *                   wrapping or clipping).
 *
 * Adding a new visual role? Define it here once. Both the React component
 * (via the existing CSS class) and the PPTX renderer (via `roleStyle`) will
 * follow the same scale.
 */

export interface TypeRole {
  cssPx: number;
  weight: 400 | 500 | 600 | 700 | 800;
  lineHeight: number;
  tracking?: number;
  charWidth: number;
  minRatio?: number;
}

function role(spec: TypeRole): TypeRole {
  return spec;
}

export const TypeScale = {
  // ── Slide chrome ──────────────────────────────────────────────────────
  /** Ribbon eyebrow above each slide title (`01 · TIMELINE`). */
  slideEyebrow: role({ cssPx: 13, weight: 700, lineHeight: 1.0, tracking: 200, charWidth: 0.55 }),
  /** Right-aligned client/cycle ribbon paired with the eyebrow. */
  slideFooter: role({ cssPx: 13, weight: 400, lineHeight: 1.0, tracking: 100, charWidth: 0.55 }),
  /** Big slide H1 set under the chrome divider. */
  slideTitle: role({ cssPx: 60, weight: 700, lineHeight: 1.05, charWidth: 0.5, minRatio: 0.55 }),
  /** Optional secondary line below the slide title. */
  slideSubtitle: role({ cssPx: 18, weight: 400, lineHeight: 1.4, charWidth: 0.5 }),
  /** Tiny corner labels (top-left, top-right, bottom corners on cover/closing). */
  cornerLabel: role({ cssPx: 9, weight: 600, lineHeight: 1.0, tracking: 200, charWidth: 0.55 }),

  // ── Numbers slide ─────────────────────────────────────────────────────
  /** Caps eyebrow above each scope/section grouping (`BUILD SNAPSHOT`). */
  sectionEyebrow: role({ cssPx: 13, weight: 700, lineHeight: 1.0, tracking: 200, charWidth: 0.55 }),
  /** Hero number value (e.g. "27 / 35"). */
  statValue: role({ cssPx: 96, weight: 700, lineHeight: 0.95, charWidth: 0.52, minRatio: 0.4 }),
  /** Caps label under each stat value. */
  statLabel: role({ cssPx: 13, weight: 600, lineHeight: 1.0, tracking: 200, charWidth: 0.6 }),
  /** Muted descriptor below the stat label. */
  statContext: role({ cssPx: 14, weight: 400, lineHeight: 1.4, charWidth: 0.52 }),
  /** Label inside a bar of the cycle-scope stacked bar. */
  scopeBarLabel: role({ cssPx: 12, weight: 400, lineHeight: 1.0, charWidth: 0.55 }),

  // ── Workstreams slide (cards) ─────────────────────────────────────────
  /** Caps issue / workstream id on the card top-line. */
  workstreamId: role({ cssPx: 12, weight: 700, lineHeight: 1.0, tracking: 200, charWidth: 0.6 }),
  /** Right-aligned story-points count on the card top-line. */
  workstreamPoints: role({ cssPx: 12, weight: 700, lineHeight: 1.0, tracking: 200, charWidth: 0.6 }),
  /** Decorative ghost number ("01"/"02"/...) parked top-right of each card. */
  workstreamIndex: role({ cssPx: 56, weight: 700, lineHeight: 1.0, charWidth: 0.5 }),
  /** Workstream name (display, often bold uppercase like "STRIPE SUBSCRIPTIONS"). */
  workstreamTitle: role({ cssPx: 32, weight: 700, lineHeight: 1.05, charWidth: 0.62, minRatio: 0.5 }),
  /** Body sentence beneath the workstream title. */
  workstreamImpact: role({ cssPx: 16, weight: 400, lineHeight: 1.35, charWidth: 0.52 }),
  /** Black status pill at the foot of each workstream card. */
  workstreamPill: role({ cssPx: 11, weight: 700, lineHeight: 1.0, tracking: 150, charWidth: 0.6 }),

  // ── Recommendations slide (hero + supporting) ─────────────────────────
  /** Cream-on-accent priority chip at the top of the hero recommendation. */
  heroChip: role({ cssPx: 11, weight: 700, lineHeight: 1.0, tracking: 150, charWidth: 0.6 }),
  /** Hero recommendation title (large, white-on-black). */
  heroTitle: role({ cssPx: 56, weight: 700, lineHeight: 1.05, charWidth: 0.5, minRatio: 0.5 }),
  /** Hero rationale paragraph (muted-on-black). */
  heroBody: role({ cssPx: 18, weight: 400, lineHeight: 1.35, charWidth: 0.52 }),
  /** Bold "expected outcome" paragraph below the divider in the hero card. */
  heroImpact: role({ cssPx: 16, weight: 600, lineHeight: 1.3, charWidth: 0.52 }),
  /** Numeric badge ("02"/"03"/...) on supporting recommendations. */
  supportingIndex: role({ cssPx: 30, weight: 700, lineHeight: 1.0, charWidth: 0.5 }),
  /** Right-aligned priority eyebrow on supporting cards. */
  supportingChip: role({ cssPx: 10, weight: 700, lineHeight: 1.0, tracking: 100, charWidth: 0.6 }),
  /** Supporting recommendation title. */
  supportingTitle: role({ cssPx: 20, weight: 700, lineHeight: 1.05, charWidth: 0.5 }),
  /** Supporting rationale (muted). PPTX gets less vertical room than the
   * HTML version (≈193px slot vs flex grow), so this is a hair smaller than
   * its CSS sibling (`.recommendation-card p` 18px) on purpose. */
  supportingBody: role({ cssPx: 11, weight: 400, lineHeight: 1.3, charWidth: 0.52, minRatio: 0.6 }),
  /** Bold impact line below the supporting rationale. Likewise tightened so
   * three text blocks fit inside the supporting card. */
  supportingImpact: role({ cssPx: 10, weight: 600, lineHeight: 1.2, charWidth: 0.52, minRatio: 0.6 }),

  // ── Asks slide (left rail + right rows) ───────────────────────────────
  /** Group header label on the side rail (e.g. "Urgent — needed this week"). */
  askGroupLabel: role({ cssPx: 14, weight: 700, lineHeight: 1.05, charWidth: 0.5 }),
  /** Muted summary under the group label. */
  askGroupSummary: role({ cssPx: 12, weight: 400, lineHeight: 1.35, charWidth: 0.52 }),
  /** Ask row name. */
  askName: role({ cssPx: 18, weight: 700, lineHeight: 1.05, charWidth: 0.5 }),
  /** Ask row detail / one-line context. */
  askDetail: role({ cssPx: 12, weight: 400, lineHeight: 1.3, charWidth: 0.52 }),
  /** Owner column (right of detail). */
  askOwner: role({ cssPx: 13, weight: 700, lineHeight: 1.0, charWidth: 0.5 }),
  /** Black priority pill on the ask row. */
  askPill: role({ cssPx: 9, weight: 700, lineHeight: 1.0, tracking: 150, charWidth: 0.62 }),

  // ── Timeline slide ────────────────────────────────────────────────────
  /** "PROJECT SCOPE" / "STATUS" headers on the stage row. */
  timelineHeader: role({ cssPx: 11, weight: 800, lineHeight: 1.0, tracking: 200, charWidth: 0.55 }),
  /** Stage names ("Now", "Next", "Then", "Launch") under each header dot. */
  timelineStage: role({ cssPx: 13, weight: 700, lineHeight: 1.0, tracking: 100, charWidth: 0.55 }),
  /** Tiny "CURRENT" badge above the today-stage dot. */
  timelineCurrent: role({ cssPx: 10, weight: 700, lineHeight: 1.0, tracking: 150, charWidth: 0.55 }),
  /** Caps section label inside each lane ("PHASE 2 — ENHANCEMENT"). */
  timelineSection: role({ cssPx: 11, weight: 800, lineHeight: 1.0, tracking: 150, charWidth: 0.55 }),
  /** Lane name (e.g. "Design freeze", "Stripe + premium"). */
  timelineLane: role({ cssPx: 24, weight: 700, lineHeight: 1.05, charWidth: 0.5 }),
  /** Right-side state label ("IN PROGRESS", "COMPLETE", etc.). */
  timelineStatus: role({ cssPx: 11, weight: 700, lineHeight: 1.0, tracking: 150, charWidth: 0.6 }),
  /** Right-side stage name under the state label. */
  timelineStageHint: role({ cssPx: 10, weight: 400, lineHeight: 1.0, charWidth: 0.5 }),

  // ── Callout (footer ribbon present on most content slides) ───────────
  /** Caps label inside the orange callout strip. */
  calloutLabel: role({ cssPx: 12, weight: 700, lineHeight: 1.0, tracking: 200, charWidth: 0.55 }),
  /** Body copy in the callout strip. */
  calloutBody: role({ cssPx: 16, weight: 400, lineHeight: 1.4, charWidth: 0.52 }),

  // ── Cover & closing slides ───────────────────────────────────────────
  /** Massive centered hero word on cover/closing. */
  coverHero: role({ cssPx: 200, weight: 700, lineHeight: 0.95, charWidth: 0.5, minRatio: 0.4 }),
  /** "TEAM:" / "DATE:" / "CYCLE:" lines on the cover. */
  coverMeta: role({ cssPx: 18, weight: 600, lineHeight: 1.2, charWidth: 0.5 }),
} as const;

export type TypeRoleName = keyof typeof TypeScale;
