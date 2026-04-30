/**
 * Single-line presentation / hero titles: take the leading segment before a dash
 * (e.g. "WEEK 2 — SCOPE REVIEW" → "WEEK 2"), then trim length for huge labels.
 */
const PRIMARY_SPLITTERS = [" — ", " – ", " - "] as const;
const MAX_TITLE_CHARS = 56;

export function formatPresentationDisplayTitle(raw: string | null | undefined): string {
  if (raw == null) {
    return "";
  }
  let s = raw.trim();
  if (!s) {
    return "";
  }
  for (const sep of PRIMARY_SPLITTERS) {
    const i = s.indexOf(sep);
    if (i !== -1) {
      s = s.slice(0, i).trim();
      break;
    }
  }
  if (s.length > MAX_TITLE_CHARS) {
    s = `${s.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…`;
  }
  return s;
}
