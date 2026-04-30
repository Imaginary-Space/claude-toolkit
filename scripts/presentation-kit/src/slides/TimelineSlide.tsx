import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import { SlideCallout, SlideContent } from "../components/slideKit";
import type { CornerLabels, TimelineData } from "../types/presentation";

export type { TimelineData };

const REQUIRED = [
  { key: "dates", description: 'Array of broad stage labels, e.g. ["Now", "Next", "Launch"]' },
  { key: "sections", description: "Array of { label, tasks: [{ name, cells }] }" },
];

type TimelineCell = "done" | "ongoing" | "future" | "empty";

function normalizeCell(value: string): TimelineCell {
  if (value === "done" || value === "ongoing" || value === "future" || value === "empty") {
    return value;
  }
  return "empty";
}

function clampIndex(index: number, dates: string[]) {
  return Math.min(Math.max(index, 0), Math.max(dates.length - 1, 0));
}

function trackState(cells: string[], dates: string[]) {
  const normalized = cells.map(normalizeCell);
  const ongoingIndex = normalized.indexOf("ongoing");
  const doneIndexes = normalized
    .map((cell, index) => (cell === "done" ? index : -1))
    .filter((index) => index >= 0);
  const futureIndex = normalized.indexOf("future");
  const hasFuture = futureIndex >= 0;
  const lastDoneIndex = doneIndexes.length > 0 ? doneIndexes[doneIndexes.length - 1] : -1;
  const hasDone = lastDoneIndex >= 0;

  if (ongoingIndex >= 0) {
    const position = clampIndex(ongoingIndex, dates);
    return {
      status: "In progress",
      tone: "active",
      position,
      stage: dates[position],
    };
  }

  if (hasDone && !hasFuture) {
    const position = clampIndex(lastDoneIndex, dates);
    return {
      status: "Complete",
      tone: "done",
      position,
      stage: dates[position],
    };
  }

  if (hasDone && hasFuture) {
    const position = clampIndex(futureIndex, dates);
    return {
      status: "Next",
      tone: "next",
      position,
      stage: dates[position],
    };
  }

  if (hasFuture) {
    const position = clampIndex(futureIndex, dates);
    return {
      status: "Queued",
      tone: "future",
      position,
      stage: dates[position],
    };
  }

  return {
    status: "Planned",
    tone: "future",
    position: 0,
    stage: dates[0],
  };
}

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
  const todayCol = Math.min(Math.max(data?.todayColumn ?? 0, 0), Math.max(dates.length - 1, 0));
  const sections = data?.sections ?? [];
  const numCols = dates.length;
  const callout = data?.callout;
  const taskCount = sections.reduce((count, section) => count + section.tasks.length, 0);
  const isDense = taskCount >= 7;
  const tracks = sections.flatMap((section) =>
    section.tasks.map((task) => ({
      section: section.label,
      name: task.name,
      ...trackState(task.cells, dates),
    })),
  );

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
        <div className="timeline-overview">
          <div className="timeline-stage-row">
            {dates.map((date, index) => (
              <div
                key={date}
                className={index === todayCol ? "timeline-stage timeline-stage--today" : "timeline-stage"}
              >
                <span className="timeline-stage-dot" />
                <span className="timeline-stage-label">{date}</span>
                {index === todayCol ? <span className="timeline-stage-today">Today</span> : null}
              </div>
            ))}
          </div>

          <div className="timeline-track-list">
            {tracks.map((track) => (
              <div key={`${track.section}-${track.name}`} className="timeline-track-card">
                <div className="timeline-track-copy">
                  <div className="timeline-track-section">{track.section}</div>
                  <div className="timeline-track-name">{track.name}</div>
                </div>
                <div className="timeline-track-state">
                  <span className={`timeline-status timeline-status--${track.tone}`}>{track.status}</span>
                  {track.stage ? <span className="timeline-track-stage">{track.stage}</span> : null}
                </div>
                <div
                  className="timeline-track-rail"
                  style={{ gridTemplateColumns: `repeat(${Math.max(numCols, 1)}, 1fr)` }}
                >
                  {dates.map((date, index) => (
                    <span
                      key={date}
                      className={[
                        "timeline-track-step",
                        index < track.position ? "timeline-track-step--past" : null,
                        index === track.position ? `timeline-track-step--${track.tone}` : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {callout?.text ? (
          <SlideCallout label={callout.label}>{callout.text}</SlideCallout>
        ) : null}
      </SlideContent>
    </Slide>
  );
}
