import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import {
  Pill,
  RecapColumn,
  RecapColumns,
  RecapDivider,
  RecapItem,
  SlideContent,
} from "../components/slideKit";
import type { CornerLabels, RecapData } from "../types/presentation";

export type { RecapData };

const REQUIRED = [
  { key: "shipped", description: "Array of { id, name, impact } for shipped items" },
  { key: "blockers", description: "Array of { id, name, impact, pill? } for blockers" },
];

export interface RecapSlideProps {
  data?: RecapData;
  corners?: CornerLabels;
  active?: boolean;
}

export function RecapSlide({ data, corners, active }: RecapSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={4} variant="cream" corners={corners}>
        <MissingData column="recap_data" fields={missing} />
      </Slide>
    );
  }

  const shipped = Array.isArray(data?.shipped) ? data.shipped : [];
  const blockers = Array.isArray(data?.blockers) ? data.blockers : [];

  return (
    <Slide index={4} variant="cream" corners={corners}>
      <SlideContent
        title="This Week"
        subtitle="Key wins shipped and items that need attention"
        subtitleMarginBottom={32}
      >
        <RecapColumns>
          <RecapColumn headerVariant="wins" title="Shipped">
            {shipped.map(({ id, name, impact }) => (
              <RecapItem key={id} id={id} name={name} impact={impact} dotClass="dot--dark" />
            ))}
          </RecapColumn>

          <RecapDivider />

          <RecapColumn headerVariant="blockers" title="Blockers & Risks">
            {blockers.map(({ id, name, impact, pill }) => (
              <RecapItem key={id} id={id} name={name} impact={impact} dotClass="dot--warning">
                {pill ? (
                  <Pill variant={pill === "client" ? "client" : "vendor"}>
                    {pill === "client" ? "Needs Client Action" : "Pending Vendor"}
                  </Pill>
                ) : null}
              </RecapItem>
            ))}
          </RecapColumn>
        </RecapColumns>
      </SlideContent>
    </Slide>
  );
}
