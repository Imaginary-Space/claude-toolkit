import { Slide } from "../components/Slide";
import { TextBox } from "../components/slideKit";
import type { CornerLabels } from "../types/presentation";

export interface BreathingSlideProps {
  corners?: CornerLabels;
  /** Override the headline (defaults to "NEW EXERCISE"). */
  heroText?: string;
  /** Override the subline (defaults to a guided breath cue). */
  bodyText?: string;
}

/**
 * Decorative slide with an animated SVG breathing ring + hero copy. Useful as
 * a section break or palate cleanser between data slides.
 */
export function BreathingSlide({
  corners,
  heroText = "NEW EXERCISE",
  bodyText = "4 BREATHS IN - ONE LONG BREATH OUT",
}: BreathingSlideProps) {
  return (
    <Slide index={1} variant="cream" dataBg="slide-1.jpg" corners={corners}>
      <svg className="breathing-bg" viewBox="0 0 400 400">
        <circle cx="200" cy="200" r="160" fill="none" stroke="#6366f1" strokeWidth={1.5} opacity={0.5}>
          <animate attributeName="r" values="150;160;150" dur="8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.35;0.5" dur="8s" repeatCount="indefinite" />
        </circle>
        <circle cx="200" cy="200" r="120" fill="none" stroke="#1a1a1a" strokeWidth={1.5} opacity={0.35}>
          <animate attributeName="r" values="115;125;115" dur="8s" repeatCount="indefinite" />
        </circle>
        <circle cx="200" cy="200" r="60" fill="none" stroke="#1a1a1a" strokeWidth={0.8}>
          <animate
            attributeName="r"
            values="55;75;55"
            dur="12s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
          />
        </circle>
        <circle cx="200" cy="200" r="4" fill="#6366f1">
          <animate attributeName="r" values="4;6;4" dur="8s" repeatCount="indefinite" />
        </circle>
        <circle cx="200" cy="110" r="5" fill="#1a1a1a" opacity={0.4}>
          <animate
            attributeName="opacity"
            values="0.15;1;0.15;0.15;0.15;0.15;0.15;0.15;0.15;0.15"
            dur="8s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="290" cy="200" r="5" fill="#1a1a1a" opacity={0.4}>
          <animate
            attributeName="opacity"
            values="0.15;0.15;0.15;1;0.15;0.15;0.15;0.15;0.15;0.15"
            dur="8s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="200" cy="290" r="5" fill="#1a1a1a" opacity={0.4}>
          <animate
            attributeName="opacity"
            values="0.15;0.15;0.15;0.15;0.15;1;0.15;0.15;0.15;0.15"
            dur="8s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="110" cy="200" r="5" fill="#1a1a1a" opacity={0.4}>
          <animate
            attributeName="opacity"
            values="0.15;0.15;0.15;0.15;0.15;0.15;0.15;1;0.15;0.15"
            dur="8s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      <TextBox
        variant="hero"
        role="hero"
        left={0}
        top={351}
        width={1920}
        height={258}
        textAlign="center"
      >
        <p style={{ fontSize: "144pt", color: "var(--brand-dark)" }}>{heroText}</p>
      </TextBox>
      <TextBox variant="body" role="body" left={0} top={667} width={1920} height={34} textAlign="center">
        <p style={{ fontSize: "16pt", letterSpacing: "0.1em" }}>{bodyText}</p>
      </TextBox>
    </Slide>
  );
}
