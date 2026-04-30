import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import {
  ScopeBarRow,
  ScopeDivider,
  ScopeItemGrid,
  ScopeSectionTitle,
  SlideContent,
} from "../components/slideKit";
import type { CornerLabels } from "../types/presentation";

/**
 * Legacy "sprint scope" data — orphaned from the default deck. Kept inline so
 * the slide remains a self-contained, optional building block.
 */
export interface SprintScopeData {
  subtitle?: string;
  carriedOver?: number;
  newCount?: number;
  totalScope?: number;
  newItems?: { id: string; text: string }[];
  newItemsSource?: "feedback" | "linear";
  scopeBarsArePoints?: boolean;
}

const REQUIRED = [
  { key: "carriedOver", description: "First bar value (pts or count from deck data)" },
  { key: "newCount", description: "Second bar value" },
  { key: "totalScope", description: "Third bar value" },
];

export interface SprintScopeSlideProps {
  data?: SprintScopeData;
  corners?: CornerLabels;
  active?: boolean;
}

export function SprintScopeSlide({ data, corners, active }: SprintScopeSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={5} variant="cream" corners={corners}>
        <MissingData column="sprint_scope_data" fields={missing} />
      </Slide>
    );
  }

  const carriedOver = data?.carriedOver ?? 0;
  const newCount = data?.newCount ?? 0;
  const totalScope = data?.totalScope ?? 0;
  const newItems = Array.isArray(data?.newItems) ? data.newItems : [];
  const maxVal = Math.max(carriedOver, newCount, totalScope, 1);
  const isFeedback = data?.newItemsSource === "feedback";
  const showPts = data?.scopeBarsArePoints ?? !isFeedback;
  const barVal = (n: number) => (showPts ? `${n} pts` : n);

  return (
    <Slide index={5} variant="cream" dataBg="slide-4.jpg" corners={corners}>
      <SlideContent
        title="Sprint Scope"
        subtitle={data?.subtitle ?? ""}
        subtitleMarginBottom={40}
      >
        <ScopeBarRow
          label={isFeedback ? "Carried over" : "Done this week · In progress"}
          variant="dark"
          widthPct={(carriedOver / maxVal) * 100}
          value={barVal(carriedOver)}
          valuePlacement="inside"
        />
        <ScopeBarRow
          label={isFeedback ? "New items" : "New mid-sprint (this week)"}
          variant="accent"
          widthPct={(newCount / maxVal) * 100}
          value={barVal(newCount)}
          valuePlacement="inside"
        />
        <ScopeBarRow
          label={
            isFeedback
              ? "Total scope"
              : "Total scope (remaining sprint + next cycle)"
          }
          labelMuted
          variant="outline"
          widthPct={(totalScope / maxVal) * 100}
          value={barVal(totalScope)}
          valuePlacement="inside"
        />

        <ScopeDivider />
        <ScopeSectionTitle>
          {isFeedback ? "Open feedback" : "New mid-sprint this week"}
        </ScopeSectionTitle>
        <ScopeItemGrid items={newItems} />
      </SlideContent>
    </Slide>
  );
}
