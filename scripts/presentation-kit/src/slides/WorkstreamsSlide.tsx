import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import {
  ItemStack,
  SlideCallout,
  SlideContent,
  WorkstreamCard,
} from "../components/slideKit";
import type { CornerLabels, WorkstreamsData } from "../types/presentation";

export type { WorkstreamsData };

const REQUIRED = [
  {
    key: "workstreams",
    description: "Array of { id, name, impact, status?, points? } workstream cards",
  },
];

export interface WorkstreamsSlideProps {
  data?: WorkstreamsData;
  corners?: CornerLabels;
  footerLabel?: string;
  active?: boolean;
}

function statusVariant(status: string | undefined): "client" | "vendor" {
  if (!status) {
    return "vendor";
  }
  const normalized = status.trim().toUpperCase();
  if (
    normalized === "QA" ||
    normalized === "DONE" ||
    normalized === "SHIPPED" ||
    normalized === "COMPLETE"
  ) {
    return "client";
  }
  return "vendor";
}

export function WorkstreamsSlide({
  data,
  corners,
  footerLabel,
  active,
}: WorkstreamsSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={3} variant="cream" corners={corners}>
        <MissingData column="workstreams_data" fields={missing} />
      </Slide>
    );
  }

  const workstreams = Array.isArray(data?.workstreams) ? data.workstreams : [];
  const callout = data?.callout;

  return (
    <Slide index={3} variant="cream" corners={corners} showCorners={false}>
      <SlideContent
        eyebrow="03 · This Week"
        title={data?.title ?? "Workstreams in flight"}
        footerLabel={footerLabel}
        contentClassName="slide-content--from-top"
      >
        <ItemStack>
          {workstreams.map(({ id, name, impact, status, points }) => (
            <WorkstreamCard
              key={id}
              id={id}
              name={name}
              impact={impact}
              status={status}
              statusVariant={statusVariant(status)}
              points={points}
            />
          ))}
        </ItemStack>

        {callout?.text ? (
          <SlideCallout label={callout.label}>{callout.text}</SlideCallout>
        ) : null}
      </SlideContent>
    </Slide>
  );
}
