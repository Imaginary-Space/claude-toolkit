import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import { GanttBar, GanttLegend, SlideContent } from "../components/slideKit";
import type { CornerLabels, TimelineData } from "../types/presentation";

export type { TimelineData };

const REQUIRED = [
  { key: "dates", description: 'Array of column date labels, e.g. ["18 Jan", "25 Jan", ...]' },
  { key: "sections", description: "Array of { label, tasks: [{ name, cells }] }" },
];

export interface TimelineSlideProps {
  data?: TimelineData;
  corners?: CornerLabels;
  active?: boolean;
}

export function TimelineSlide({ data, corners, active }: TimelineSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={2} variant="cream" corners={corners}>
        <MissingData column="timeline_data" fields={missing} />
      </Slide>
    );
  }

  const dates = data?.dates ?? [];
  const todayCol = data?.todayColumn ?? 0;
  const sections = data?.sections ?? [];
  const numCols = dates.length;
  const safeCols = Math.max(numCols, 1);

  return (
    <Slide index={2} variant="cream" dataBg="slide-2.jpg" corners={corners}>
      <SlideContent
        title="Project Timeline"
        subtitle="Sprint milestones across workstreams"
        subtitleMarginBottom={28}
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
            { barClass: "bar-done", label: "Complete" },
            { barClass: "bar-ongoing", label: "In Progress" },
            { barClass: "bar-future", label: "Planned" },
          ]}
        />
      </SlideContent>
    </Slide>
  );
}
