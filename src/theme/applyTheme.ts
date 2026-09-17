import { accentForeground, normalizeHex } from './color';
import { DEFAULT_ACCENT } from '../store/defaults';
import type { ThemeMode } from '../types';

export type ResolvedTheme = 'light' | 'dark';

export const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(PREFERS_DARK_QUERY).matches;
}

/**
 * Writes the theme onto `<html>`: `data-theme` selects the neutral palette and
 * `--accent` seeds every accent shade, which the stylesheet derives with
 * `color-mix()`. `--accent-contrast` is the one value CSS can't compute.
 */
export function applyTheme(
  root: HTMLElement,
  options: { mode: ThemeMode; accent: string; prefersDark?: boolean },
): ResolvedTheme {
  const resolved = resolveTheme(options.mode, options.prefersDark ?? systemPrefersDark());
  const accent = normalizeHex(options.accent) ?? DEFAULT_ACCENT;
  root.dataset.theme = resolved;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-contrast', accentForeground(accent));
  root.style.colorScheme = resolved;
  return resolved;
}
