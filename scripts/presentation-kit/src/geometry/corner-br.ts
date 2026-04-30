import type { Presentation } from "../types/presentation";

/** Strip legacy "Tech Sync · …" / "Tech Sync | …" prefixes from stored labels. */
export function stripTechSyncMeetingPrefix(label: string): string {
  return label.replace(/^(tech\s*sync)(?:\s*[·.|]\s*)+/i, "").trim();
}

/**
 * Bottom-right deck corner: prefer cycle/sprint name, never show a lone "Tech Sync".
 * Useful when assembling the {@link CornerLabels} you pass to slide components.
 */
export function resolvePresentationCornerBr(p: Presentation): string | undefined {
  const parts = [p.cycle_name, p.sprint_name, p.meeting_type]
    .map((x) => x?.trim())
    .filter((x): x is string => Boolean(x));

  for (const raw of parts) {
    const rest = stripTechSyncMeetingPrefix(raw);
    const candidate = (rest || raw).trim();
    if (candidate && !/^tech\s*sync$/i.test(candidate)) {
      return candidate;
    }
  }

  return parts[0];
}
