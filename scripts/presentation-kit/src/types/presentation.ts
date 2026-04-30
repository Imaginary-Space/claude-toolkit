/**
 * Data shapes the slide components consume. These are the "view-model" types —
 * the host app is responsible for producing them from whatever data source it
 * uses (Linear cycles, manual editor, generated content, etc.).
 *
 * The default deck order is fixed:
 *
 *   1. cover_data       → CoverSlide
 *   2. timeline_data    → TimelineSlide       ("01 · TIMELINE")
 *   3. numbers_data     → NumbersSlide        ("02 · NUMBERS")
 *   4. workstreams_data → WorkstreamsSlide    ("03 · THIS WEEK")
 *   5. recommendations_data → RecommendationsSlide ("04 · RECOMMENDATIONS")
 *   6. asks_data        → AsksSlide           ("05 · ASKS")
 *   7. closing_data     → ClosingSlide
 *
 * Slides 2–6 share a small-caps footer ribbon (e.g. "LANDIBLE · CYCLE 21 ·
 * APR 30, 2026"). Provide it explicitly via `footer_label`, or let the CLI
 * derive one from `client.company` / `cycle_name` / `meeting_date`.
 */

export interface CornerLabels {
  tl?: string;
  tr?: string;
  bl?: string;
  br?: string;
}

export interface PresentationClient {
  id: string;
  name: string;
  company: string | null;
  photo_url: string | null;
}

export interface CoverData {
  heroText?: string;
  team?: string;
  date?: string;
  cycle?: string;
  coverImageUrl?: string;
  coverImagePrompt?: string;
}

export interface TimelineData {
  /** Short slide title, e.g. "Phase 2 progress". */
  title?: string;
  /** Broad stage labels, e.g. ["Now", "Next", "Then", "Launch"]. */
  dates?: string[];
  todayColumn?: number;
  sections?: {
    label: string;
    /** Track-level rows; despite the legacy name, these are not ticket tasks. */
    tasks: { name: string; cells: string[] }[];
  }[];
  /** Optional bottom callout, e.g. { label: "ON PACE", text: "Foundation closed…" }. */
  callout?: { label?: string; text: string };
}

export interface NumbersStat {
  /** Hero value, e.g. "8 / 27" or "+45%". */
  value: string;
  /** Small-caps label below the value, e.g. "ISSUES COMPLETE". */
  label: string;
  /** Optional contextual line, e.g. "30% of scope". */
  context?: string;
}

export interface NumbersBreakdownBar {
  label: string;
  value: string;
  /** 0–100. */
  widthPct: number;
  variant?: "dark" | "accent" | "outline";
}

export interface NumbersData {
  /** Slide-specific title, e.g. "Cycle 21 by the numbers". */
  title?: string;
  stats?: NumbersStat[];
  /** Section title above the breakdown bars, e.g. "STATUS BREAKDOWN". */
  breakdownTitle?: string;
  breakdown?: NumbersBreakdownBar[];
}

export interface Workstream {
  /** External identifier (e.g. Linear key like "LAN-213"). */
  id: string;
  /** Short workstream name, e.g. "REGRID PARCEL API". */
  name: string;
  /** One-line impact / description. */
  impact: string;
  /** Status pill copy, e.g. "QA" or "IN PROGRESS". */
  status?: string;
  /** Story points, e.g. "8 pt" or "—". */
  points?: string;
}

export interface WorkstreamsData {
  /** Slide-specific title, e.g. "Three workstreams in flight". */
  title?: string;
  workstreams?: Workstream[];
  callout?: { label?: string; text: string };
}

export interface Action {
  /** Owner / assignee name. */
  owner: string;
  /** Action description. */
  task: string;
  /** Status pill copy, e.g. "DONE" or "IN PROGRESS". */
  status: string;
}

export interface ActionsData {
  /** Slide-specific title, e.g. "From Monday's dev sync". */
  title?: string;
  actions?: Action[];
  /** Optional bottom callout text. */
  callout?: string;
}

export interface Recommendation {
  /** Short guidance headline, e.g. "Protect QA runway". */
  title: string;
  /** Why this recommendation matters now. */
  rationale: string;
  /** Expected outcome or client-facing benefit. */
  impact: string;
  /** Optional chip, e.g. "NEXT BEST MOVE", "RISK REDUCTION", "LAUNCH READINESS". */
  priority?: string;
}

export interface RecommendationsData {
  /** Slide-specific title, e.g. "Our recommendations". */
  title?: string;
  /** Optional framing line under the title. */
  subtitle?: string;
  recommendations?: Recommendation[];
  /** Optional bottom callout, e.g. { label: "WHY NOW", text: "..." }. */
  callout?: { label?: string; text: string };
}

export interface Ask {
  /** Short ask name, e.g. "Regrid paid API key". */
  ask: string;
  /** One-line detail. */
  detail: string;
  /** Priority chip, e.g. "BLOCKING WK 2" or "DECISION". */
  priority: string;
  /** Optional person or team the ask is needed from. */
  owner?: string;
}

export interface AskGroup {
  /** Section label, e.g. "Urgent for Week 4 submission". */
  label: string;
  /** Optional tone used for section marker color. */
  tone?: "urgent" | "access" | "upcoming" | "default";
  /** Optional concise section note. */
  summary?: string;
  items: Ask[];
}

export interface AsksData {
  /** Slide-specific title, e.g. "What we need from Nick". */
  title?: string;
  /** Grouped asks for the default client-facing layout. */
  groups?: AskGroup[];
  /** Legacy flat list; rendered as one default group when `groups` is absent. */
  asks?: Ask[];
  /** Optional bottom callout, e.g. store blocker summary. */
  callout?: { label?: string; text: string };
}

export interface ClosingData {
  heroText?: string;
  thankYou?: string;
  teamLine?: string;
  dateLine?: string;
  closingImageUrl?: string;
  closingImagePrompt?: string;
}

/**
 * Aggregate deck data — every section is optional so partial decks render with
 * the per-slide "missing data" affordance when `active` is true.
 */
export interface Presentation {
  id: string;
  title: string;
  project_id: string;
  /** Linear cycle id this deck is bound to (host-app concept; optional). */
  linear_cycle_id: string | null;
  sprint_name: string | null;
  meeting_date: string | null;
  meeting_type: string | null;
  cycle_name: string | null;
  /**
   * Shared small-caps ribbon shown on slides 2–6, e.g.
   * "LANDIBLE · CYCLE 21 · APR 30, 2026". Optional — the CLI derives a
   * default from `client.company` / `cycle_name` / `meeting_date` when absent.
   */
  footer_label?: string | null;
  cover_data: CoverData;
  timeline_data: TimelineData;
  numbers_data: NumbersData;
  workstreams_data: WorkstreamsData;
  recommendations_data?: RecommendationsData;
  /** Orphan/ad-hoc slide data retained for custom decks; not rendered by the default CLI. */
  actions_data?: ActionsData;
  asks_data: AsksData;
  closing_data: ClosingData;
  created_at: string;
  client: PresentationClient | null;
}
