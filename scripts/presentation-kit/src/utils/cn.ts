/**
 * Tiny className joiner — drops falsy values (undefined / null / false / "").
 * Replaces the `cn` helper from the host app's design system so this package
 * has zero external runtime dependencies.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
