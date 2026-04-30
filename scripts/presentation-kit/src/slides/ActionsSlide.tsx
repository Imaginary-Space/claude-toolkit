import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import {
  ActionRow,
  ItemStack,
  SlideCallout,
  SlideContent,
} from "../components/slideKit";
import type { ActionsData, CornerLabels } from "../types/presentation";

export type { ActionsData };

const REQUIRED = [
  {
    key: "actions",
    description: "Array of { owner, task, status } action items",
  },
];

export interface ActionsSlideProps {
  data?: ActionsData;
  corners?: CornerLabels;
  footerLabel?: string;
  active?: boolean;
}

function statusVariant(status: string): "client" | "vendor" {
  return status.trim().toUpperCase() === "DONE" ? "client" : "vendor";
}

export function ActionsSlide({ data, corners, footerLabel, active }: ActionsSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={4} variant="cream" corners={corners}>
        <MissingData column="actions_data" fields={missing} />
      </Slide>
    );
  }

  const actions = Array.isArray(data?.actions) ? data.actions : [];
  const callout = data?.callout;

  return (
    <Slide index={4} variant="cream" corners={corners} showCorners={false}>
      <SlideContent
        eyebrow="04 · Actions"
        title={data?.title ?? "Action items"}
        footerLabel={footerLabel}
        contentClassName="slide-content--from-top"
      >
        <ItemStack>
          {actions.map((action, i) => (
            <ActionRow
              key={`${action.owner}-${i}`}
              owner={action.owner}
              task={action.task}
              status={action.status}
              statusVariant={statusVariant(action.status)}
            />
          ))}
        </ItemStack>

        {callout ? <SlideCallout>{callout}</SlideCallout> : null}
      </SlideContent>
    </Slide>
  );
}
