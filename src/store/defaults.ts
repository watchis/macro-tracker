import type { FoodLibraryItem, PersistedState, Settings } from '../types';

/** localStorage key for the whole persisted store. Bump with a migration, never in place. */
export const STORAGE_KEY = 'macro-tracker/v1';

/** Matches the `version` field of `PersistedState` and the zustand persist version. */
export const STORE_VERSION = 1 as const;

export const DEFAULT_ACCENT = '#3b82f6';

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  accent: DEFAULT_ACCENT,
  visibleMacros: ['protein', 'carbs', 'fat'],
  goals: {
    calories: 2000,
    macros: { protein: 150, carbs: 200, fat: 65 },
  },
  weekStart: 'sunday',
  dataRetention: 'forever',
  weightUnit: 'lb',
};

/**
 * Historical export alias. The whole-foods starter catalog is lazy-loaded from
 * `src/data/starter/`; persisted `foodLibrary` is customs only.
 */
export const DEFAULT_FOOD_LIBRARY: readonly FoodLibraryItem[] = [];

/**
 * Persisted `foodLibrary` holds only user-added custom foods. The starter
 * catalog is merged in at read time so a large library does not bloat storage.
 */
export function defaultPersistedState(): PersistedState {
  return {
    version: STORE_VERSION,
    days: {},
    weights: {},
    foodLibrary: [],
    settings: {
      ...DEFAULT_SETTINGS,
      visibleMacros: [...DEFAULT_SETTINGS.visibleMacros],
      goals: {
        calories: DEFAULT_SETTINGS.goals.calories,
        macros: { ...DEFAULT_SETTINGS.goals.macros },
      },
    },
  };
}
