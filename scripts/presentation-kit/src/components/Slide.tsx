import type { ReactNode } from "react";
import type { CornerLabels } from "../types/presentation";

const DEFAULT_CORNERS = [
  ["corner-tl", "Imaginary Space"],
  ["corner-tr", "Feb 13, 2026"],
  ["corner-bl", "53 Stations"],
  ["corner-br", "Cycle 16"],
] as const;

export type SlideVariant = "cream" | "dark";

export interface SlideProps {
  /** Zero-based slide index — surfaced as `data-slide` for export tooling. */
  index: number;
  variant?: SlideVariant;
  /** Optional `data-bg` attribute (used by some host apps to swap background images). */
  dataBg?: string;
  corners?: CornerLabels;
  children: ReactNode;
}

/**
 * Fixed 1920×1080 slide frame with optional cream/dark background and four
 * corner labels. The frame is positioned + scaled by the parent presentation
 * container (CSS variables `--slide-w`, `--slide-h`, `--scale`).
 */
export function Slide({
  index,
  variant = "cream",
  dataBg,
  corners,
  children,
}: SlideProps) {
  const variantClass = variant === "dark" ? "slide--dark" : "slide--cream";
  const className = `slide ${variantClass}`;

  const cornerEntries: [string, string][] = corners
    ? [
        ["corner-tl", corners.tl ?? DEFAULT_CORNERS[0][1]],
        ["corner-tr", corners.tr ?? DEFAULT_CORNERS[1][1]],
        ["corner-bl", corners.bl ?? DEFAULT_CORNERS[2][1]],
        ["corner-br", corners.br ?? DEFAULT_CORNERS[3][1]],
      ]
    : DEFAULT_CORNERS.map(([cls, text]) => [cls, text]);

  return (
    <section
      className={className}
      data-slide={index}
      data-export-slide=""
      {...(dataBg ? { "data-bg": dataBg } : {})}
    >
      {children}
      {cornerEntries.map(([cls, text]) => (
        <div key={cls} className={`slide-corner ${cls}`}>
          {text}
        </div>
      ))}
    </section>
  );
}

export type { CornerLabels };
