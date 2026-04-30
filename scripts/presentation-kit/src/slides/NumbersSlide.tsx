import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import {
  HeroStat,
  HeroStatGrid,
  ScopeSectionTitle,
  SlideContent,
  StackedBar,
  type StackedBarSegment,
} from "../components/slideKit";
import type { CornerLabels, NumbersData } from "../types/presentation";

export type { NumbersData };

const REQUIRED = [
  { key: "stats", description: "Array of { value, label, context? } stat cards" },
];

export interface NumbersSlideProps {
  data?: NumbersData;
  corners?: CornerLabels;
  footerLabel?: string;
  active?: boolean;
}

export function NumbersSlide({ data, corners, footerLabel, active }: NumbersSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={2} variant="cream" corners={corners}>
        <MissingData column="numbers_data" fields={missing} />
      </Slide>
    );
  }

  const stats = Array.isArray(data?.stats) ? data.stats : [];
  const breakdown = Array.isArray(data?.breakdown) ? data.breakdown : [];
  const breakdownTitle = data?.breakdownTitle;

  // Highlight one stat in accent (typically a "growth" / standout metric).
  const accentIndex = stats.findIndex((s) =>
    typeof s.value === "string" && s.value.trim().startsWith("+")
  );

  const cols: 2 | 3 | 4 = stats.length <= 2 ? 2 : stats.length === 3 ? 3 : 4;

  const segments: StackedBarSegment[] = breakdown.map((b, i) => {
    const numeric = parseFloat(String(b.value).replace(/[^\d.-]/g, ""));
    return {
      label: b.label,
      value: Number.isFinite(numeric) ? Math.max(numeric, 0) : Math.max(b.widthPct, 1),
      variant: b.variant ?? (i === 0 ? "dark" : "outline"),
    };
  });

  return (
    <Slide index={2} variant="cream" corners={corners} showCorners={false}>
      <SlideContent
        eyebrow="02 · Numbers"
        title={data?.title ?? "By the numbers"}
        footerLabel={footerLabel}
        contentClassName="slide-content--from-top slide-content--numbers"
      >
        <div className="numbers-snapshot">
          <div className="numbers-snapshot-label">Build snapshot</div>
          <HeroStatGrid cols={cols}>
            {stats.map((s, i) => (
              <HeroStat
                key={`${s.label}-${i}`}
                value={s.value}
                label={s.label}
                context={s.context ?? null}
                accent={i === accentIndex}
              />
            ))}
          </HeroStatGrid>
        </div>

        {segments.length > 0 ? (
          <div className="numbers-breakdown-panel">
            {breakdownTitle ? (
              <ScopeSectionTitle>{breakdownTitle}</ScopeSectionTitle>
            ) : null}
            <StackedBar segments={segments} />
          </div>
        ) : null}
      </SlideContent>
    </Slide>
  );
}
