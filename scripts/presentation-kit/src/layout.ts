export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;
export const PPTX_WIDTH = 13.333333;
export const PPTX_HEIGHT = 7.5;
export const PX_TO_IN = PPTX_WIDTH / SLIDE_WIDTH;

export const BRAND = {
  accent: "F05100",
  accentWarm: "FFF1E8",
  cream: "FFFFFF",
  dark: "0A0A0A",
  foreground: "171717",
  muted: "A3A3A3",
  mutedText: "737373",
  mutedBorder: "E5E5E5",
  borderLight: "F0F0F0",
  soft: "FAFAFA",
  warm: "F5F5F5",
  success: "22C55E",
  warning: "F59E0B",
} as const;

export const FONT = {
  body: "Funnel Display",
  fallback: "Inter",
} as const;

export function px(value: number): number {
  return value * PX_TO_IN;
}

export function pt(cssPx: number): number {
  return cssPx * 0.75;
}
