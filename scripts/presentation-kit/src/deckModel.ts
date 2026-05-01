import type { CornerLabels, Presentation } from "./types/presentation";

export function hasRenderableData(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(hasRenderableData);
  }
  if (typeof value === "object") {
    return Object.values(value).some(hasRenderableData);
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

export function cornersFor(presentation: Presentation): CornerLabels {
  const clientName =
    presentation.client?.company?.trim() ||
    presentation.client?.name?.trim() ||
    presentation.title;
  return {
    tl: "Imaginary Space",
    tr: presentation.meeting_date ?? new Date().toISOString().slice(0, 10),
    bl: clientName,
    br: presentation.cycle_name ?? presentation.sprint_name ?? presentation.meeting_type ?? "Presentation",
  };
}

/**
 * Build the small-caps ribbon shown on slides 2-6, e.g.
 * "LANDIBLE · CYCLE 21 · APR 30, 2026". Honours an explicit
 * `presentation.footer_label` and otherwise derives one from the client +
 * cycle + meeting date.
 */
export function footerLabelFor(presentation: Presentation): string {
  const explicit = presentation.footer_label?.trim();
  if (explicit) {
    return explicit;
  }
  const company =
    presentation.client?.company?.trim() ||
    presentation.client?.name?.trim() ||
    presentation.title;
  const cycle = presentation.cycle_name ?? presentation.sprint_name;
  const date = presentation.meeting_date;
  return [company, cycle, date].filter(Boolean).join(" · ").toUpperCase();
}
