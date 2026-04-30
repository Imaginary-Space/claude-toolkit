/**
 * @imaginaryspace/presentation-kit
 *
 * Standalone slide-deck design system extracted from the ionous-ai dashboard.
 * Framework-agnostic React components + a single CSS file.
 *
 * Quick start:
 *
 * ```tsx
 * import "@imaginaryspace/presentation-kit/styles";
 * import "@imaginaryspace/presentation-kit/fonts"; // optional, for Newsreader + Inter
 * import { CoverSlide, VelocitySlide } from "@imaginaryspace/presentation-kit";
 *
 * function Deck() {
 *   return (
 *     <div className="ims-presentation" style={{ ["--scale" as string]: "0.5" }}>
 *       <CoverSlide data={{ heroText: "WEEK 17", team: "Imaginary Space", date: "Apr 30", cycle: "Retro" }} />
 *       <VelocitySlide data={{ ... }} />
 *     </div>
 *   );
 * }
 * ```
 */

// Frame + corners
export { Slide } from "./components/Slide";
export type { SlideProps, SlideVariant } from "./components/Slide";

// Composable building blocks
export {
  SlideContent,
  TextBox,
  SlideDivider,
  StatGroup,
  Stat,
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
export type { TextBoxVariant, ScopeBarVariant, ChartLegendEntry } from "./components/slideKit";

// Helper components
export { MissingData, getMissing } from "./components/MissingData";
export type { MissingField } from "./components/MissingData";
export { GenerativeImage } from "./components/GenerativeImage";
export type { GenerativeImageProps, ImageLoader } from "./components/GenerativeImage";

// Pre-assembled slide variants
export { CoverSlide } from "./slides/CoverSlide";
export type { CoverSlideProps } from "./slides/CoverSlide";
export { ClosingSlide } from "./slides/ClosingSlide";
export type { ClosingSlideProps } from "./slides/ClosingSlide";
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
export { TimelineSlide } from "./slides/TimelineSlide";
export type { TimelineSlideProps } from "./slides/TimelineSlide";

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
  VelocityData,
  SprintScopeData,
  RecapData,
  DevUpdatesData,
  DevVideoSlot,
  ClosingData,
} from "./types/presentation";
