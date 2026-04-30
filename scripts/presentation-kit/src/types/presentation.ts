/**
 * Data shapes the slide components consume. These are the "view-model" types —
 * the host app is responsible for producing them from whatever data source it
 * uses (Linear cycles, manual editor, generated content, etc.).
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
  dates?: string[];
  todayColumn?: number;
  sections?: {
    label: string;
    tasks: { name: string; cells: string[] }[];
  }[];
}

export interface VelocityData {
  subtitle?: string;
  completed?: number;
  total?: number;
  progressPct?: number;
  remaining?: number;
  /** Column 0..4 = Mon..Fri for the current local work week. */
  todayColumn?: number;
  scopeValues?: number[];
  startedValues?: number[];
  completedValues?: number[];
  /**
   * Optional Linear-aligned stats — when all three are set, the velocity
   * header stats match Sprint Scope bars (story points). The chart remains
   * a cycle-wide trend (scope / started / completed ramps).
   */
  scopeDoneThisWeekActive?: number;
  scopeNewMidSprintThisWeek?: number;
  scopeRemainingPlusNext?: number;
}

export interface SprintScopeData {
  subtitle?: string;
  /** First bar — story points done this week + in progress (or carried-over count). */
  carriedOver?: number;
  /** Second bar — new mid-sprint points this week (or new-items count). */
  newCount?: number;
  /** Third bar — remaining sprint + next-cycle points (or total count). */
  totalScope?: number;
  newItems?: { id: string; text: string }[];
  /** Switches list rows + header copy between "feedback" and "linear" modes. */
  newItemsSource?: "feedback" | "linear";
  /** When true, bars show "N pts"; otherwise show "N". */
  scopeBarsArePoints?: boolean;
}

export interface RecapData {
  shipped?: { id: string; name: string; impact: string }[];
  blockers?: {
    id: string;
    name: string;
    impact: string;
    /** Omit for placeholder rows (no chip). */
    pill?: "client" | "vendor";
  }[];
}

/** One dev video slot (Loom, YouTube, Vimeo embed, or direct .mp4/.webm). */
export interface DevVideoSlot {
  presenter?: string;
  /** Watch or embed URL — YouTube, Loom, Vimeo, or direct video file. */
  videoUrl?: string;
  /** Short line on what they shipped / did. */
  summary?: string;
}

export interface DevUpdatesData {
  subtitle?: string;
  /** Two slots — video 1 and video 2; empty slots show placeholders. */
  slots?: DevVideoSlot[];
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
 * Aggregate deck data — all fields are optional so partial decks render
 * with the per-slide "missing data" affordance when `active` is true.
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
  cover_data: CoverData;
  timeline_data: TimelineData;
  velocity_data: VelocityData;
  sprint_scope_data: SprintScopeData;
  recap_data: RecapData;
  dev_updates_data: DevUpdatesData;
  closing_data: ClosingData;
  created_at: string;
  client: PresentationClient | null;
}
