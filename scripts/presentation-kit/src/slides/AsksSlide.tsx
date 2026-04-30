import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import { AskRow, ItemStack, SlideContent } from "../components/slideKit";
import type { AsksData, CornerLabels } from "../types/presentation";

export type { AsksData };

const REQUIRED = [
  {
    key: "asks",
    description: "Array of { ask, detail, priority } ask rows",
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

export function AsksSlide({ data, corners, footerLabel, active }: AsksSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={5} variant="cream" corners={corners}>
        <MissingData column="asks_data" fields={missing} />
      </Slide>
    );
  }

  const asks = Array.isArray(data?.asks) ? data.asks : [];

  return (
    <Slide index={5} variant="cream" corners={corners} showCorners={false}>
      <SlideContent
        eyebrow="05 · Asks"
        title={data?.title ?? "What we need"}
        footerLabel={footerLabel}
        contentClassName="slide-content--from-top"
      >
        <ItemStack>
          {asks.map((row, i) => (
            <AskRow
              key={`${row.ask}-${i}`}
              ask={row.ask}
              detail={row.detail}
              priority={row.priority}
              priorityVariant={priorityVariant(row.priority)}
            />
          ))}
        </ItemStack>
      </SlideContent>
    </Slide>
  );
}
