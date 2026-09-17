/** Foreground colors used on top of a filled accent surface. */
export const ACCENT_ON_LIGHT = '#0b0b0c';
export const ACCENT_ON_DARK = '#ffffff';

const SHORT_HEX = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG_HEX = /^#?([0-9a-f]{6})$/i;

/** Normalizes `#abc`, `abc`, `#AABBCC` to `#aabbcc`; returns null when unparsable. */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  const short = SHORT_HEX.exec(value);
  if (short) {
    const [, r, g, b] = short;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const long = LONG_HEX.exec(value);
  return long?.[1] ? `#${long[1].toLowerCase()}` : null;
}

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex) ?? '#000000';
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Text/icon color that stays legible on a solid accent fill. Every other accent
 * shade is derived in CSS with `color-mix()`; only the contrast pick needs the
 * luminance math, which CSS cannot express yet.
 */
export function accentForeground(hex: string): string {
  return relativeLuminance(hex) > 0.55 ? ACCENT_ON_LIGHT : ACCENT_ON_DARK;
}
