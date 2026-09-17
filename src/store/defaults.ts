import type { FoodLibraryItem, PersistedState, Settings } from '../types';
import usdaFoodLibrary from '../data/food-library-usda.json';

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
};

/**
 * Starter foods for quick-add on a fresh install.
 * Values come from USDA FoodData Central (see `src/data/food-library-usda.json`).
 */
export const DEFAULT_FOOD_LIBRARY: FoodLibraryItem[] = usdaFoodLibrary.foodLibrary.map((item) => ({
  name: item.name,
  grams: item.grams,
  calories: item.calories,
  macros: { ...item.macros },
}));

export function defaultPersistedState(): PersistedState {
  return {
    version: STORE_VERSION,
    days: {},
    foodLibrary: DEFAULT_FOOD_LIBRARY.map((item) => ({ ...item, macros: { ...item.macros } })),
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
