import { Slide } from "../components/Slide";
import { GenerativeImage, type ImageLoader } from "../components/GenerativeImage";
import { MissingData, getMissing } from "../components/MissingData";
import { SlideDivider, TextBox } from "../components/slideKit";
import type { CornerLabels, CoverData } from "../types/presentation";
import { formatPresentationDisplayTitle } from "../utils/presentation-title";

export type { CoverData };

const REQUIRED = [
  { key: "heroText", description: 'Main title, e.g. cycle name in caps' },
  { key: "team", description: 'Team names, e.g. "IMAGINARY SPACE, 53 STATIONS!"' },
  { key: "date", description: 'Display date, e.g. "FEB 13TH"' },
  { key: "cycle", description: 'Cycle label, e.g. "RETRO"' },
];

export interface CoverSlideProps {
  data?: CoverData;
  corners?: CornerLabels;
  /** Called when the user generates a new cover image via the prompt bar. */
  onImageGenerated?: (url: string, prompt: string) => void;
  /** When true, missing-data placeholders are shown for absent fields. */
  active?: boolean;
  /** Pluggable image generator — omit to render the image read-only. */
  imageLoader?: ImageLoader;
}

export function CoverSlide({
  data,
  corners,
  onImageGenerated,
  active,
  imageLoader,
}: CoverSlideProps) {
  const missing = active ? getMissing(data, REQUIRED) : [];

  if (active && missing.length === REQUIRED.length) {
    return (
      <Slide index={0} variant="cream" corners={corners}>
        <MissingData column="cover_data" fields={REQUIRED} />
      </Slide>
    );
  }

  return (
    <Slide index={0} variant="cream" dataBg="slide-0.jpg" corners={corners}>
      <GenerativeImage
        defaultSrc={data?.coverImageUrl ?? ""}
        defaultPrompt={data?.coverImagePrompt ?? ""}
        style={{ left: 990, top: 28, width: 902, height: 612 }}
        onGenerated={onImageGenerated}
        imageLoader={imageLoader}
      />
      <SlideDivider variant="dark" />

      <TextBox
        variant="hero"
        role="hero"
        left={0}
        top={680}
        width={1920}
        height={400}
        textAlign="center"
      >
        <p style={{ fontSize: "226pt", color: "var(--brand-accent)" }}>
          {formatPresentationDisplayTitle(data?.heroText ?? "")}
        </p>
      </TextBox>
      <TextBox variant="meta" role="meta" left={101} top={360} width={840} height={69}>
        <p style={{ whiteSpace: "nowrap" }}>TEAM: {data?.team ?? ""}</p>
      </TextBox>
      <TextBox variant="meta" role="meta" left={101} top={453} width={840} height={34}>
        <p style={{ whiteSpace: "nowrap" }}>DATE: {data?.date ?? ""}</p>
      </TextBox>
      <TextBox variant="meta" role="meta" left={101} top={520} width={840} height={34}>
        <p style={{ whiteSpace: "nowrap" }}>CYCLE: {data?.cycle ?? ""}</p>
      </TextBox>
    </Slide>
  );
}
