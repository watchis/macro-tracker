/**
 * Shared domain types for Macro Tracker.
 *
 * `PersistedState` is the exact shape written to `localStorage` under the
 * `macro-tracker/v1` key and produced by the JSON export, so it must stay in
 * sync with the migration logic in `src/store/migrate.ts`.
 */

export type MacroKey = 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'satFat' | 'sodium';

/** Partial map of macro amounts. Units are grams except `sodium`, which is mg. */
export type MacroAmounts = Partial<Record<MacroKey, number>>;

/** Every macro resolved to a number, used for totals where absent means 0. */
export type MacroTotals = Record<MacroKey, number>;

/** `YYYY-MM-DD` in local time. */
export type DateKey = string;

/** `YYYY-MM` in local time. */
export type MonthKey = string;

export type FoodEntry = {
  id: string;
  name: string;
  grams: number;
  calories: number;
  macros: MacroAmounts;
  createdAt: string;
};

/** Fields callers supply when creating or editing an entry; the store owns `id`/`createdAt`. */
export type FoodEntryInput = Omit<FoodEntry, 'id' | 'createdAt'>;

/**
 * A reusable food. Amounts are stated for `grams` of the food (defaults to a
 * per-100g reference) and get scaled with `scaleFood` when logged.
 */
export type FoodLibraryItem = Omit<FoodEntry, 'id' | 'createdAt'>;

export type ThemeMode = 'light' | 'dark' | 'system';

export type WeekStart = 'sunday' | 'monday';

export type Goals = {
  calories: number;
  macros: MacroAmounts;
};

export type Settings = {
  themeMode: ThemeMode;
  /** Accent color as a `#rrggbb` hex string; every accent shade derives from it. */
  accent: string;
  visibleMacros: MacroKey[];
  goals: Goals;
  weekStart: WeekStart;
};

export type PersistedState = {
  version: 1;
  /** Food entries keyed by `YYYY-MM-DD`. */
  days: Record<DateKey, FoodEntry[]>;
  /**
   * User-added custom foods only. The USDA starter catalog is bundled with the
   * app and merged in at read time (see `mergeFoodLibraries`).
   */
  foodLibrary: FoodLibraryItem[];
  settings: Settings;
};

/** Views are switched in app state; there is no router (GitHub Pages has no rewrites). */
export type ViewName = 'calendar' | 'day' | 'settings';
