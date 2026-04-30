import { Slide } from "../components/Slide";
import { MissingData, getMissing } from "../components/MissingData";
import { SlideCallout, SlideContent } from "../components/slideKit";
import type { CornerLabels, RecommendationsData } from "../types/presentation";

export type { RecommendationsData };

const REQUIRED = [
  {
    key: "recommendations",
    description: "Array of { title, rationale, impact, priority? } recommendation cards",
  },
];

export interface RecommendationsSlideProps {
  data?: RecommendationsData;
  corners?: CornerLabels;
  footerLabel?: string;
  active?: boolean;
}

export function RecommendationsSlide({
  data,
  corners,
  footerLabel,
  active,
}: RecommendationsSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length > 0) {
    return (
      <Slide index={4} variant="cream" corners={corners}>
        <MissingData column="recommendations_data" fields={missing} />
      </Slide>
    );
  }

  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const lead = recommendations[0];
  const supporting = recommendations.slice(1, 4);
  const callout = data?.callout;

  return (
    <Slide index={4} variant="cream" corners={corners} showCorners={false}>
      <SlideContent
        eyebrow="04 · Recommendations"
        title={data?.title ?? "Our recommendations"}
        subtitle={data?.subtitle}
        footerLabel={footerLabel}
        contentClassName="slide-content--from-top slide-content--recommendations"
      >
        <div className="recommendations-layout">
          {lead ? (
            <article className="recommendation-hero-card">
              {lead.priority ? <div className="recommendation-chip">{lead.priority}</div> : null}
              <h2>{lead.title}</h2>
              <p>{lead.rationale}</p>
              <div className="recommendation-impact">
                <span>Expected outcome</span>
                {lead.impact}
              </div>
            </article>
          ) : null}

          <div className="recommendation-side-stack">
            {supporting.map((item, index) => (
              <article key={`${item.title}-${index}`} className="recommendation-card">
                <div className="recommendation-card-index">{String(index + 2).padStart(2, "0")}</div>
                <div className="recommendation-card-body">
                  <div className="recommendation-card-title-row">
                    <h3>{item.title}</h3>
                    {item.priority ? <span className="recommendation-chip">{item.priority}</span> : null}
                  </div>
                  <p>{item.rationale}</p>
                  <div className="recommendation-card-impact">{item.impact}</div>
                </div>
              </article>
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
