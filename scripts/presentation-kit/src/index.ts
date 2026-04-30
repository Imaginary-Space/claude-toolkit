/**
 * @imaginaryspace/presentation-kit
 *
 * Standalone slide-deck design system. The default deck shape is the seven-
 * slide "tech sync" layout used for IMS client decks:
 *
 *   1. CoverSlide
 *   2. TimelineSlide       ("01 · TIMELINE")
 *   3. NumbersSlide        ("02 · NUMBERS")
 *   4. WorkstreamsSlide    ("03 · THIS WEEK")
 *   5. ActionsSlide        ("04 · ACTIONS")
 *   6. AsksSlide           ("05 · ASKS")
 *   7. ClosingSlide
 *
 * The legacy `VelocitySlide` / `SprintScopeSlide` / `RecapSlide` /
 * `DevUpdatesSlide` components are still exported for ad-hoc composition,
 * but are no longer part of the default deck consumed by the CLI.
 *
 * Quick start:
 *
 * ```tsx
 * import "@imaginaryspace/presentation-kit/styles";
 * import "@imaginaryspace/presentation-kit/fonts"; // optional, Funnel Display brand font
 * import { CoverSlide, NumbersSlide } from "@imaginaryspace/presentation-kit";
 * ```
 */

// Frame + corners
export { Slide } from "./components/Slide";
export type { SlideProps, SlideVariant } from "./components/Slide";

// Composable building blocks
export {
  SlideContent,
  SlideCallout,
  TextBox,
  SlideDivider,
  StatGroup,
  Stat,
  HeroStatGrid,
  HeroStat,
  StackedBar,
  ItemStack,
  WorkstreamCard,
  ActionRow,
  AskRow,
  ScopeBarRow,
  ScopeSectionTitle,
  ScopeDivider,
  ScopeItemGrid,
  GanttBar,
  GanttLegend,
  ChartLegend,
  RecapColumns,
  RecapColumn,
  RecapDivider,
  RecapItem,
  Pill,
} from "./components/slideKit";
export type {
  TextBoxVariant,
  ScopeBarVariant,
  ChartLegendEntry,
  StackedBarSegment,
} from "./components/slideKit";

// Helper components
export { MissingData, getMissing } from "./components/MissingData";
export type { MissingField } from "./components/MissingData";
export { GenerativeImage } from "./components/GenerativeImage";
export type { GenerativeImageProps, ImageLoader } from "./components/GenerativeImage";

// Default deck — the seven slides the CLI renders.
export { CoverSlide } from "./slides/CoverSlide";
export type { CoverSlideProps } from "./slides/CoverSlide";
export { TimelineSlide } from "./slides/TimelineSlide";
export type { TimelineSlideProps } from "./slides/TimelineSlide";
export { NumbersSlide } from "./slides/NumbersSlide";
export type { NumbersSlideProps } from "./slides/NumbersSlide";
export { WorkstreamsSlide } from "./slides/WorkstreamsSlide";
export type { WorkstreamsSlideProps } from "./slides/WorkstreamsSlide";
export { ActionsSlide } from "./slides/ActionsSlide";
export type { ActionsSlideProps } from "./slides/ActionsSlide";
export { AsksSlide } from "./slides/AsksSlide";
export type { AsksSlideProps } from "./slides/AsksSlide";
export { ClosingSlide } from "./slides/ClosingSlide";
export type { ClosingSlideProps } from "./slides/ClosingSlide";

// Orphan slides — not part of the default deck, but available for custom decks.
export { BreathingSlide } from "./slides/BreathingSlide";
export type { BreathingSlideProps } from "./slides/BreathingSlide";
export { VelocitySlide } from "./slides/VelocitySlide";
export type { VelocitySlideProps } from "./slides/VelocitySlide";
export { SprintScopeSlide } from "./slides/SprintScopeSlide";
export type { SprintScopeSlideProps } from "./slides/SprintScopeSlide";
export { RecapSlide } from "./slides/RecapSlide";
export type { RecapSlideProps } from "./slides/RecapSlide";
export { DevUpdatesSlide } from "./slides/DevUpdatesSlide";
export type { DevUpdatesSlideProps } from "./slides/DevUpdatesSlide";

// Geometry helpers (useful if building custom chart slides)
export {
  valuesToXY,
  xyToPath,
  valuesToPath,
  fillBetweenPaths,
  valuesToPoints,
  padVelocitySeries,
} from "./geometry/velocity-chart-geometry";
export {
  resolvePresentationCornerBr,
  stripTechSyncMeetingPrefix,
} from "./geometry/corner-br";

// Title formatting helper used by CoverSlide / ClosingSlide
export { formatPresentationDisplayTitle } from "./utils/presentation-title";
export { cn } from "./utils/cn";

// Data shapes
export type {
  CornerLabels,
  Presentation,
  PresentationClient,
  CoverData,
  TimelineData,
  NumbersData,
  NumbersStat,
  NumbersBreakdownBar,
  WorkstreamsData,
  Workstream,
  ActionsData,
  Action,
  AsksData,
  Ask,
  ClosingData,
} from "./types/presentation";
