import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import {
  GanttBar,
  GanttLegend,
  SlideCallout,
  SlideContent,
} from "../components/slideKit";
import type { CornerLabels, TimelineData } from "../types/presentation";

export type { TimelineData };

const REQUIRED = [
  { key: "dates", description: 'Array of column date labels, e.g. ["Apr 20", "Apr 27", ...]' },
  { key: "sections", description: "Array of { label, tasks: [{ name, cells }] }" },
];

export interface TimelineSlideProps {
  data?: TimelineData;
  corners?: CornerLabels;
  /** Shared small-caps ribbon for slides 2–6, e.g. "LANDIBLE · CYCLE 21 · APR 30, 2026". */
  footerLabel?: string;
  active?: boolean;
}

export function TimelineSlide({ data, corners, footerLabel, active }: TimelineSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={1} variant="cream" corners={corners}>
        <MissingData column="timeline_data" fields={missing} />
      </Slide>
    );
  }

  const dates = data?.dates ?? [];
  const todayCol = data?.todayColumn ?? 0;
  const sections = data?.sections ?? [];
  const numCols = dates.length;
  const safeCols = Math.max(numCols, 1);
  const callout = data?.callout;
  const taskCount = sections.reduce((count, section) => count + section.tasks.length, 0);
  const isDense = numCols >= 7 || taskCount >= 9;

  return (
    <Slide index={1} variant="cream" dataBg="slide-2.jpg" corners={corners} showCorners={false}>
      <SlideContent
        eyebrow="01 · Timeline"
        title={data?.title ?? "Where we are"}
        footerLabel={footerLabel}
        contentClassName={[
          "slide-content--from-top",
          "slide-content--timeline",
          isDense ? "slide-content--timeline-dense" : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className="gantt-grid"
          style={{ gridTemplateColumns: `var(--gantt-task-col-width) repeat(${numCols}, 1fr)` }}
        >
          <div
            className="today-line"
            style={{
              left: `calc(var(--gantt-task-col-width) + ((${todayCol} + 0.5) / ${safeCols}) * (100% - var(--gantt-task-col-width)))`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="today-label">Today</div>
          </div>

          <div className="gantt-header">
            <div>Cycle / work</div>
            {dates.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {sections.map((section) => (
            <div key={section.label} style={{ display: "contents" }}>
              <div className="gantt-section-label">{section.label}</div>
              {section.tasks.map((task) => (
                <div key={task.name} className="gantt-row">
                  <div className="gantt-task-cell">
                    <span className="task-name">{task.name}</span>
                  </div>
                  {task.cells.map((cell, ci) => (
                    <div key={ci}>
                      <GanttBar status={cell as "done" | "ongoing" | "future" | "empty"} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        <GanttLegend
          items={[
            { barClass: "bar-done", label: "Done" },
            { barClass: "bar-ongoing", label: "In flight" },
            { barClass: "bar-future", label: "Upcoming" },
          ]}
        />

        {callout?.text ? (
          <SlideCallout label={callout.label}>{callout.text}</SlideCallout>
        ) : null}
      </SlideContent>
    </Slide>
  );
}
