import { useEffect, useSyncExternalStore } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PREFERS_DARK_QUERY, applyTheme, resolveTheme, systemPrefersDark } from './applyTheme';
import type { ResolvedTheme } from './applyTheme';

function subscribeToColorScheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(PREFERS_DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * Keeps `<html>` in sync with `settings.themeMode` and `settings.accent`, and
 * returns the theme actually in effect so components can label a system choice.
 * Mount once, from `App`.
 */
export function useTheme(): ResolvedTheme {
  const mode = useAppStore((state) => state.settings.themeMode);
  const accent = useAppStore((state) => state.settings.accent);
  const prefersDark = useSyncExternalStore(subscribeToColorScheme, systemPrefersDark, () => false);

  useEffect(() => {
    applyTheme(document.documentElement, { mode, accent, prefersDark });
  }, [mode, accent, prefersDark]);

  return resolveTheme(mode, prefersDark);
}

/** Applies the persisted theme before the first paint; called from `main.tsx`. */
export function applyStoredTheme(): void {
  const { themeMode, accent } = useAppStore.getState().settings;
  applyTheme(document.documentElement, { mode: themeMode, accent });
}
