import { Slide } from "../components/Slide";
import { GenerativeImage, type ImageLoader } from "../components/GenerativeImage";
import { MissingData, getMissing } from "../components/MissingData";
import { SlideDivider, TextBox } from "../components/slideKit";
import type { ClosingData, CornerLabels } from "../types/presentation";
import { formatPresentationDisplayTitle } from "../utils/presentation-title";

export type { ClosingData };

const REQUIRED = [
  { key: "heroText", description: 'Main closing text, e.g. "LET\'S BUILD"' },
  { key: "thankYou", description: 'Thank you line, e.g. "THANK YOU"' },
  { key: "teamLine", description: 'Team credit, e.g. "IMAGINARY SPACE × 53 STATIONS"' },
  { key: "dateLine", description: 'Date line, e.g. "FEB 13, 2026"' },
];

export interface ClosingSlideProps {
  data?: ClosingData;
  corners?: CornerLabels;
  onImageGenerated?: (url: string, prompt: string) => void;
  active?: boolean;
  imageLoader?: ImageLoader;
}

export function ClosingSlide({
  data,
  corners,
  onImageGenerated,
  active,
  imageLoader,
}: ClosingSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length === REQUIRED.length) {
    return (
      <Slide index={6} variant="dark" corners={corners}>
        <MissingData column="closing_data" fields={REQUIRED} />
      </Slide>
    );
  }

  return (
    <Slide index={6} variant="dark" dataBg="slide-7.jpg" corners={corners}>
      <GenerativeImage
        defaultSrc={data?.closingImageUrl ?? ""}
        defaultPrompt={data?.closingImagePrompt ?? ""}
        style={{ left: 990, top: 28, width: 902, height: 612 }}
        onGenerated={onImageGenerated}
        imageLoader={imageLoader}
      />
      <SlideDivider variant="light" />

      <TextBox
        variant="hero"
        role="hero"
        left={0}
        top={680}
        width={1920}
        height={400}
        textAlign="center"
      >
        <p
          style={{
            fontSize: "150pt",
            color: "var(--brand-accent)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {formatPresentationDisplayTitle(data?.heroText ?? "")}
        </p>
      </TextBox>
      <TextBox variant="meta" role="meta" left={101} top={360} width={840} height={69}>
        <p style={{ color: "var(--brand-cream)", whiteSpace: "nowrap" }}>{data?.thankYou ?? ""}</p>
      </TextBox>
      <TextBox variant="meta" role="meta" left={101} top={430} width={840} height={34}>
        <p style={{ color: "var(--brand-cream)", whiteSpace: "nowrap" }}>{data?.teamLine ?? ""}</p>
      </TextBox>
      <TextBox variant="meta" role="meta" left={101} top={500} width={840} height={34}>
        <p style={{ color: "var(--brand-cream)", whiteSpace: "nowrap" }}>{data?.dateLine ?? ""}</p>
      </TextBox>
    </Slide>
  );
}
