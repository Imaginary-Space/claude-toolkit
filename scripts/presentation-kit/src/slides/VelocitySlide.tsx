import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import { ChartLegend, SlideContent, Stat, StatGroup } from "../components/slideKit";
import {
  fillBetweenPaths,
  padVelocitySeries,
  valuesToPath,
  valuesToPoints,
} from "../geometry/velocity-chart-geometry";
import type { CornerLabels } from "../types/presentation";

/**
 * Legacy "velocity chart" data — orphaned from the default deck. The shipping
 * deck composes Linear/Supabase numbers via `NumbersData` instead. This type
 * lives here (rather than in `types/presentation.ts`) so the slide stays a
 * self-contained, optional building block.
 */
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
  scopeDoneThisWeekActive?: number;
  scopeNewMidSprintThisWeek?: number;
  scopeRemainingPlusNext?: number;
}

const REQUIRED = [
  { key: "completed", description: "Completed story points, e.g. 42" },
  { key: "total", description: "Total story points in scope, e.g. 100" },
  { key: "progressPct", description: "Percent complete, e.g. 84" },
  { key: "remaining", description: "Remaining story points, e.g. 58" },
  { key: "subtitle", description: 'e.g. "Cycle 16 — Feb 10–14 · Story points"' },
  { key: "scopeValues", description: "Scope points per chart step (5 values)" },
  { key: "startedValues", description: "Started-line points per chart step (5 values)" },
  { key: "completedValues", description: "Completed-line points per chart step (5 values)" },
];

const GRID_POSITIONS = [
  { bottom: "0%" },
  { bottom: "25%" },
  { bottom: "50%" },
  { bottom: "75%" },
  { bottom: "100%" },
] as const;

const GRID_COLS = ["20%", "40%", "60%", "80%"] as const;

export interface VelocitySlideProps {
  data?: VelocityData;
  corners?: CornerLabels;
  active?: boolean;
}

function hasLinearScopeAlignedStats(
  d: VelocityData | undefined,
): d is VelocityData & {
  scopeDoneThisWeekActive: number;
  scopeNewMidSprintThisWeek: number;
  scopeRemainingPlusNext: number;
} {
  return (
    d != null &&
    typeof d.scopeDoneThisWeekActive === "number" &&
    typeof d.scopeNewMidSprintThisWeek === "number" &&
    typeof d.scopeRemainingPlusNext === "number"
  );
}

export function VelocitySlide({ data, corners, active }: VelocitySlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={2} variant="cream" corners={corners}>
        <MissingData column="velocity_data" fields={missing} />
      </Slide>
    );
  }

  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const xLabels = WEEKDAYS;
  const rawScope = Array.isArray(data?.scopeValues) ? data.scopeValues : [];
  const rawStarted = Array.isArray(data?.startedValues) ? data.startedValues : [];
  const rawCompleted = Array.isArray(data?.completedValues) ? data.completedValues : [];

  const scopeVals = padVelocitySeries(rawScope);
  const startedVals = padVelocitySeries(rawStarted);
  const completedVals = padVelocitySeries(rawCompleted);

  const allVals = [...scopeVals, ...startedVals, ...completedVals];
  const max = allVals.length > 0 ? Math.max(...allVals, 1) : 20;

  const scopePath = valuesToPath(scopeVals, max);
  const startedPath = valuesToPath(startedVals, max);
  const completedPath = valuesToPath(completedVals, max);
  const startedPoints = valuesToPoints(startedVals, max);
  const completedPoints = valuesToPoints(completedVals, max);

  const numLabels = xLabels.length;
  const xPositions = xLabels.map((_, i) => `${((i + 0.5) / numLabels) * 100}%`);

  const parsedToday = Number(data?.todayColumn);
  const todayCol = Number.isFinite(parsedToday)
    ? Math.min(Math.max(0, Math.round(parsedToday)), numLabels - 1)
    : 2;
  const todayLeftPct = ((todayCol + 0.5) / numLabels) * 100;
  const todayMarkerStyle = {
    left: `${todayLeftPct}%`,
    transform: "translateX(-50%)",
  } as const;

  const barHeights =
    completedVals.length >= 2
      ? completedVals.map((v, i) => {
          const prev = i === 0 ? 0 : completedVals[i - 1];
          const delta = v - prev;
          return `${(delta / max) * 100}%`;
        })
      : [];

  return (
    <Slide index={2} variant="cream" dataBg="slide-2.jpg" corners={corners}>
      <SlideContent
        title="Velocity"
        subtitle={data?.subtitle ?? ""}
        subtitleMarginBottom={28}
        headerRight={
          hasLinearScopeAlignedStats(data) ? (
            <StatGroup>
              <Stat
                value={data.scopeDoneThisWeekActive}
                label="This wk · Active"
                fraction=" pts"
              />
              <Stat
                value={data.scopeNewMidSprintThisWeek}
                label="New mid-sprint"
                fraction=" pts"
              />
              <Stat
                value={data.scopeRemainingPlusNext}
                label="Sprint + next"
                fraction=" pts"
              />
            </StatGroup>
          ) : (
            <StatGroup>
              <Stat
                value={data?.completed ?? 0}
                label="Completed"
                fraction={`/${data?.total ?? 0} pts`}
              />
              <Stat value={`${data?.progressPct ?? 0}%`} label="Progress" />
              <Stat value={data?.remaining ?? 0} label="Remaining pts" />
            </StatGroup>
          )
        }
      >
        <div className="velocity-chart">
          {GRID_POSITIONS.map((style, i) => (
            <div key={i}>
              <div className="grid-line" style={style} />
              <div className="y-label" style={style}>
                {Math.round((i / 4) * max)}
              </div>
            </div>
          ))}
          {GRID_COLS.map((left, i) => (
            <div key={i} className="grid-col" style={{ left }} />
          ))}
          {xLabels.map((label, i) => (
            <div key={label} className="x-label" style={{ left: xPositions[i] }}>
              {label}
            </div>
          ))}
          {barHeights.map((height, i) => (
            <div
              key={i}
              className="completion-bar"
              style={{
                left: `${(i / numLabels) * 100 + 3}%`,
                width: `${(1 / numLabels) * 100 - 6}%`,
                height,
              }}
            />
          ))}
          <svg className="chart-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            {scopePath && <path fill="none" stroke="#a09d98" strokeWidth={2} d={scopePath} />}
            <line
              x1="0"
              y1="1000"
              x2="1000"
              y2={1000 - ((scopeVals[scopeVals.length - 1] ?? max) / max) * 1000}
              stroke="#a09d98"
              strokeWidth={1.5}
              strokeDasharray="12,10"
            />
            {startedPath && <path fill="none" stroke="#1a1a1a" strokeWidth={2} d={startedPath} />}
            {completedPath && <path fill="none" stroke="#6366f1" strokeWidth={2.5} d={completedPath} />}
            {startedVals.length > 0 && completedVals.length > 0 && (
              <path fill="#6366f1" opacity={0.05} d={fillBetweenPaths(startedVals, completedVals, max)} />
            )}
            {startedPoints.map(([x, y], i) => (
              <rect
                key={`s${i}`}
                x={x}
                y={y}
                width={i === startedPoints.length - 1 ? 6 : 5}
                height={i === startedPoints.length - 1 ? 6 : 5}
                fill="#1a1a1a"
              />
            ))}
            {completedPoints.map(([x, y], i) => (
              <rect
                key={`c${i}`}
                x={x}
                y={y}
                width={i === completedPoints.length - 1 ? 7 : 5}
                height={i === completedPoints.length - 1 ? 7 : 5}
                fill="#6366f1"
                {...(i === completedPoints.length - 1 ? { stroke: "#fff", strokeWidth: 1.5 } : {})}
              />
            ))}
          </svg>
          <div className="velocity-today" style={todayMarkerStyle} />
          <div className="velocity-today-label" style={todayMarkerStyle}>
            Today
          </div>
          <ChartLegend
            entries={[
              { kind: "line", color: "#a09d98", label: "Scope (pts)" },
              { kind: "line", color: "#1a1a1a", label: "Started (pts)" },
              { kind: "line", color: "#6366f1", label: "Completed (pts)" },
              { kind: "dashed", label: "Target" },
            ]}
          />
        </div>
      </SlideContent>
    </Slide>
  );
}
