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
};

/** Starter foods so the day view has something to quick-add on a fresh install. */
export const DEFAULT_FOOD_LIBRARY: FoodLibraryItem[] = [
  {
    name: 'Chicken breast',
    grams: 100,
    calories: 165,
    macros: { protein: 31, carbs: 0, fat: 3.6, satFat: 1, sodium: 74 },
  },
  {
    name: 'White rice, cooked',
    grams: 100,
    calories: 130,
    macros: { protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium: 1 },
  },
  {
    name: 'Rolled oats',
    grams: 100,
    calories: 379,
    macros: { protein: 13, carbs: 68, fat: 6.5, fiber: 10, sugar: 1, satFat: 1.2, sodium: 6 },
  },
  {
    name: 'Whole egg',
    grams: 100,
    calories: 143,
    macros: { protein: 12.6, carbs: 0.7, fat: 9.5, satFat: 3.1, sodium: 142 },
  },
  {
    name: 'Greek yogurt, 2%',
    grams: 100,
    calories: 73,
    macros: { protein: 10, carbs: 3.9, fat: 1.9, sugar: 3.9, satFat: 1.2, sodium: 34 },
  },
];

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
