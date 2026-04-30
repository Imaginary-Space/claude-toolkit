import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import { Pill, SlideCallout, SlideContent } from "../components/slideKit";
import type { AskGroup, AsksData, CornerLabels } from "../types/presentation";

export type { AsksData };

const REQUIRED = [
  {
    key: "groups",
    description: "Grouped asks, or legacy asks array, with { ask, detail, priority, owner? } rows",
  },
];

export interface AsksSlideProps {
  data?: AsksData;
  corners?: CornerLabels;
  footerLabel?: string;
  active?: boolean;
}

function priorityVariant(priority: string): "client" | "vendor" {
  const normalized = priority.trim().toUpperCase();
  if (normalized.startsWith("BLOCKING") || normalized === "DECISION") {
    return "client";
  }
  return "vendor";
}

function toneForGroup(group: AskGroup): "urgent" | "access" | "upcoming" | "default" {
  if (group.tone) {
    return group.tone;
  }
  const normalized = group.label.trim().toLowerCase();
  if (normalized.includes("urgent") || normalized.includes("block")) {
    return "urgent";
  }
  if (normalized.includes("access")) {
    return "access";
  }
  if (normalized.includes("upcoming") || normalized.includes("not urgent")) {
    return "upcoming";
  }
  return "default";
}

function groupsFor(data?: AsksData): AskGroup[] {
  if (Array.isArray(data?.groups) && data.groups.length > 0) {
    return data.groups;
  }
  const asks = Array.isArray(data?.asks) ? data.asks : [];
  return asks.length > 0
    ? [{ label: "Client input needed", tone: "default", items: asks }]
    : [];
}

export function AsksSlide({ data, corners, footerLabel, active }: AsksSlideProps) {
  const missing = active && groupsFor(data).length === 0 ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={5} variant="cream" corners={corners}>
        <MissingData column="asks_data" fields={missing} />
      </Slide>
    );
  }

  const groups = groupsFor(data);
  const callout = data?.callout;

  return (
    <Slide index={5} variant="cream" corners={corners} showCorners={false}>
      <SlideContent
        eyebrow="05 · Asks"
        title={data?.title ?? "What we need from you"}
        footerLabel={footerLabel}
        contentClassName="slide-content--from-top slide-content--asks"
      >
        <div className="ask-section-stack">
          {groups.map((group) => {
            const tone = toneForGroup(group);
            return (
              <section key={group.label} className={`ask-section ask-section--${tone}`}>
                <div className="ask-section-header">
                  <span className="ask-section-dot" />
                  <div>
                    <h2>{group.label}</h2>
                    {group.summary ? <p>{group.summary}</p> : null}
                  </div>
                </div>
                <div className="ask-section-rows">
                  {group.items.map((row, i) => (
                    <div key={`${group.label}-${row.ask}-${i}`} className="ask-table-row">
                      <div className="ask-table-main">
                        <div className="ask-table-title">{row.ask}</div>
                        <div className="ask-table-detail">{row.detail}</div>
                      </div>
                      <div className="ask-table-owner">{row.owner ?? ""}</div>
                      <div className="ask-table-priority">
                        <Pill variant={priorityVariant(row.priority)}>{row.priority}</Pill>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {callout?.text ? (
          <SlideCallout label={callout.label}>{callout.text}</SlideCallout>
        ) : null}
      </SlideContent>
    </Slide>
  );
}
