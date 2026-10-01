import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ageYearsFromBirthday, isDateKey, todayKey } from '../lib/dates';
import {
  removeCustomFavorite,
  syncCustomFavorite,
  toggleFoodFavoriteList,
} from '../lib/foodFavorites';
import { createId } from '../lib/id';
import { normalizeMacros, sortMacros } from '../lib/macros';
import {
  applyAutoOptimize,
  normalizeAutoOptimizeThreshold,
  OPTIMIZE_STORAGE_TARGET_RATIO,
  optimizeStorageBundle,
  sameDayKeys,
} from '../lib/retention';
import { measureLocalStorageUsage } from '../lib/storage';
import { toCanonicalKg } from '../lib/weight';
import { normalizeHex } from '../theme/color';
import { STORAGE_KEY, STORE_VERSION, defaultPersistedState } from './defaults';
import { migratePersistedState, parsePersistedState } from './migrate';
import type {
  DateKey,
  FoodEntry,
  FoodEntryInput,
  FoodFavoriteSource,
  FoodLibraryItem,
  MacroKey,
  PersistedState,
  ProjectionProfile,
  Settings,
  ThemeMode,
  ViewName,
  WeekStart,
  WeightUnit,
} from '../types';

/** Transient UI state. Deliberately excluded from persistence. */
export type UiState = {
  view: ViewName;
  /** The day the day view shows and the calendar highlights as selected. */
  selectedDate: DateKey;
};

export type AppActions = {
  // --- navigation -----------------------------------------------------------
  setView: (view: ViewName) => void;
  setSelectedDate: (date: DateKey) => void;
  /** Selects a day and switches to the day view; the calendar's cell click handler. */
  openDay: (date: DateKey) => void;

  // --- day entries ---------------------------------------------------------
  /** Appends an entry to `date` and returns its generated id. */
  addEntry: (date: DateKey, input: FoodEntryInput) => string;
  updateEntry: (date: DateKey, id: string, patch: Partial<FoodEntryInput>) => void;
  removeEntry: (date: DateKey, id: string) => void;
  clearDay: (date: DateKey) => void;

  // --- body weight ---------------------------------------------------------
  /**
   * Sets or clears the weigh-in for `date`. Pass `null`/`undefined` to remove.
   * `value` is in the preferred display unit (`settings.weightUnit`); the store
   * converts to kilograms before persisting.
   */
  setWeight: (date: DateKey, value: number | null | undefined, unit?: WeightUnit) => void;
  setWeightUnit: (unit: WeightUnit) => void;

  // --- food library --------------------------------------------------------
  /**
   * Custom foods only (persisted). The whole-foods starter catalog is bundled and
   * merged via selectors; edits address custom items by index into `foodLibrary`.
   */
  addFood: (item: FoodLibraryItem) => void;
  updateFood: (index: number, patch: Partial<FoodLibraryItem>) => void;
  removeFood: (index: number) => void;
  /** Star or unstar a custom or catalog food for Day quick-add favorites. */
  toggleFoodFavorite: (source: FoodFavoriteSource, item: FoodLibraryItem) => void;

  // --- settings ------------------------------------------------------------
  updateSettings: (patch: Partial<Settings>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  /** Ignores unparsable hex values so a half-typed input can't blank the accent. */
  setAccent: (hex: string) => void;
  setVisibleMacros: (macros: readonly MacroKey[]) => void;
  toggleMacro: (macro: MacroKey) => void;
  setCalorieGoal: (calories: number) => void;
  /** Pass `undefined` to clear a macro goal. */
  setMacroGoal: (macro: MacroKey, value: number | undefined) => void;
  setWeekStart: (weekStart: WeekStart) => void;
  /** Merges fields into the weight-loss projection profile. */
  setProjectionProfile: (patch: Partial<ProjectionProfile>) => void;
  /**
   * Sets the auto-optimize percent threshold, or `null` to disable. Out-of-range
   * numbers are ignored so a half-typed field cannot blank the setting.
   */
  setAutoOptimizeThreshold: (threshold: number | null) => void;
  /** Re-runs auto-optimize against current days (e.g. after import). */
  applyAutoOptimizeNow: () => void;

  // --- data management -----------------------------------------------------
  /** Pretty-printed `PersistedState` JSON, ready for a download. */
  exportJson: () => string;
  importJson: (raw: string) => { ok: true } | { ok: false; error: string };
  /**
   * Drops oldest day/weight months until storage is under ~70% of quota.
   * Keeps settings, custom foods, favorites, and the newest month of logs.
   */
  optimizeStorage: () => { freedBytes: number; monthsDropped: number };
};

export type AppStore = PersistedState & UiState & AppActions;

function initialUiState(): UiState {
  return { view: 'home', selectedDate: todayKey() };
}

function sanitizeEntryInput(input: FoodEntryInput): FoodEntryInput {
  return {
    name: input.name.trim(),
    grams: Number.isFinite(input.grams) ? input.grams : 0,
    calories: Number.isFinite(input.calories) ? input.calories : 0,
    macros: normalizeMacros(input.macros),
  };
}

/** Drops days whose entry list is empty so exports and storage stay tidy. */
function withDay(
  days: Record<DateKey, FoodEntry[]>,
  date: DateKey,
  entries: FoodEntry[],
): Record<DateKey, FoodEntry[]> {
  const next = { ...days };
  if (entries.length === 0) {
    delete next[date];
  } else {
    next[date] = entries;
  }
  return next;
}

function withWeight(
  weights: Record<DateKey, number>,
  date: DateKey,
  kg: number | null,
): Record<DateKey, number> {
  const next = { ...weights };
  if (kg === null || !Number.isFinite(kg) || kg <= 0) {
    delete next[date];
  } else {
    next[date] = kg;
  }
  return next;
}

function pruneBundle(
  days: Record<DateKey, FoodEntry[]>,
  weights: Record<DateKey, number>,
  thresholdPercent: number | null,
): { days: Record<DateKey, FoodEntry[]>; weights: Record<DateKey, number> } {
  const usage = measureLocalStorageUsage(STORAGE_KEY);
  const result = applyAutoOptimize(days, weights, thresholdPercent, {
    storageUsedBytes: usage.totalBytes,
  });
  return { days: result.days, weights: result.weights };
}

function withAutoOptimize(
  days: Record<DateKey, FoodEntry[]>,
  weights: Record<DateKey, number>,
  thresholdPercent: number | null,
): { days: Record<DateKey, FoodEntry[]>; weights: Record<DateKey, number> } {
  const pruned = pruneBundle(days, weights, thresholdPercent);
  const daysSame = sameDayKeys(days, pruned.days);
  const weightsSame = sameDayKeys(weights, pruned.weights);
  return {
    days: daysSame ? days : pruned.days,
    weights: weightsSame ? weights : pruned.weights,
  };
}

/**
 * Every rehydrated payload is re-parsed, not only the ones a version bump sends
 * through `migrate`: persist skips that hook when the stored version already
 * matches, so a hand-edited or half-written payload would otherwise land in the
 * store as-is and crash the first render. Auto-optimize runs here too so a long
 * absence still trims history on the next load.
 */
export function mergePersistedState(persisted: unknown, current: AppStore): AppStore {
  const parsed = parsePersistedState(persisted);
  const optimized = withAutoOptimize(
    parsed.days,
    parsed.weights,
    parsed.settings.autoOptimizeThreshold,
  );
  return {
    ...current,
    ...parsed,
    days: optimized.days,
    weights: optimized.weights,
  };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...defaultPersistedState(),
      ...initialUiState(),

      setView: (view) => set({ view }),
      setSelectedDate: (selectedDate) => set({ selectedDate }),
      openDay: (date) => set({ selectedDate: date, view: 'day' }),

      addEntry: (date, input) => {
        const entry: FoodEntry = {
          id: createId(),
          createdAt: new Date().toISOString(),
          ...sanitizeEntryInput(input),
        };
        set((state) => {
          const optimized = withAutoOptimize(
            withDay(state.days, date, [...(state.days[date] ?? []), entry]),
            state.weights,
            state.settings.autoOptimizeThreshold,
          );
          return { days: optimized.days, weights: optimized.weights };
        });
        return entry.id;
      },

      updateEntry: (date, id, patch) =>
        set((state) => {
          const entries = state.days[date];
          if (!entries) return state;
          const next = entries.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  ...sanitizeEntryInput({
                    name: patch.name ?? entry.name,
                    grams: patch.grams ?? entry.grams,
                    calories: patch.calories ?? entry.calories,
                    macros: patch.macros ?? entry.macros,
                  }),
                }
              : entry,
          );
          const optimized = withAutoOptimize(
            withDay(state.days, date, next),
            state.weights,
            state.settings.autoOptimizeThreshold,
          );
          return { days: optimized.days, weights: optimized.weights };
        }),

      removeEntry: (date, id) =>
        set((state) => {
          const entries = state.days[date];
          if (!entries) return state;
          const optimized = withAutoOptimize(
            withDay(
              state.days,
              date,
              entries.filter((entry) => entry.id !== id),
            ),
            state.weights,
            state.settings.autoOptimizeThreshold,
          );
          return { days: optimized.days, weights: optimized.weights };
        }),

      clearDay: (date) =>
        set((state) => {
          const optimized = withAutoOptimize(
            withDay(state.days, date, []),
            state.weights,
            state.settings.autoOptimizeThreshold,
          );
          return { days: optimized.days, weights: optimized.weights };
        }),

      setWeight: (date, value, unit) =>
        set((state) => {
          const displayUnit = unit ?? state.settings.weightUnit;
          const kg =
            value === null || value === undefined || !Number.isFinite(value) || value <= 0
              ? null
              : toCanonicalKg(value, displayUnit);
          const optimized = withAutoOptimize(
            state.days,
            withWeight(state.weights, date, kg),
            state.settings.autoOptimizeThreshold,
          );
          return { days: optimized.days, weights: optimized.weights };
        }),

      setWeightUnit: (weightUnit) => get().updateSettings({ weightUnit }),

      addFood: (item) =>
        set((state) => ({
          foodLibrary: [
            ...state.foodLibrary,
            {
              name: item.name.trim(),
              grams: item.grams > 0 ? item.grams : 100,
              calories: Number.isFinite(item.calories) ? item.calories : 0,
              macros: normalizeMacros(item.macros),
            },
          ],
        })),

      updateFood: (index, patch) =>
        set((state) => {
          const existing = state.foodLibrary[index];
          if (!existing) return state;
          const merged: FoodLibraryItem = { ...existing, ...patch };
          const nextItem: FoodLibraryItem = {
            name: merged.name.trim(),
            grams: merged.grams > 0 ? merged.grams : 100,
            calories: Number.isFinite(merged.calories) ? merged.calories : 0,
            macros: normalizeMacros(merged.macros),
          };
          const next = [...state.foodLibrary];
          next[index] = nextItem;
          return {
            foodLibrary: next,
            foodFavorites: syncCustomFavorite(state.foodFavorites, existing.name, nextItem),
          };
        }),

      removeFood: (index) =>
        set((state) => {
          const existing = state.foodLibrary[index];
          if (!existing) return state;
          return {
            foodLibrary: state.foodLibrary.filter((_, i) => i !== index),
            foodFavorites: removeCustomFavorite(state.foodFavorites, existing.name),
          };
        }),

      toggleFoodFavorite: (source, item) =>
        set((state) => ({
          foodFavorites: toggleFoodFavoriteList(state.foodFavorites, source, item),
        })),

      updateSettings: (patch) =>
        set((state) => {
          const merged: Settings = { ...state.settings, ...patch };
          const threshold =
            patch.autoOptimizeThreshold !== undefined
              ? patch.autoOptimizeThreshold === null
                ? null
                : (normalizeAutoOptimizeThreshold(patch.autoOptimizeThreshold) ??
                  state.settings.autoOptimizeThreshold)
              : merged.autoOptimizeThreshold;
          return {
            settings: {
              ...merged,
              accent: normalizeHex(merged.accent) ?? state.settings.accent,
              visibleMacros: sortMacros(merged.visibleMacros),
              weightUnit: merged.weightUnit === 'kg' ? 'kg' : 'lb',
              autoOptimizeThreshold: threshold,
              goals: {
                calories: Math.max(0, merged.goals.calories),
                macros: normalizeMacros(merged.goals.macros),
              },
              projection: {
                ...state.settings.projection,
                ...merged.projection,
              },
            },
          };
        }),

      setThemeMode: (themeMode) => get().updateSettings({ themeMode }),

      setAccent: (hex) => {
        const accent = normalizeHex(hex);
        if (accent) get().updateSettings({ accent });
      },

      setVisibleMacros: (macros) => get().updateSettings({ visibleMacros: sortMacros(macros) }),

      toggleMacro: (macro) => {
        const current = get().settings.visibleMacros;
        const next = current.includes(macro)
          ? current.filter((key) => key !== macro)
          : [...current, macro];
        get().updateSettings({ visibleMacros: sortMacros(next) });
      },

      setCalorieGoal: (calories) =>
        set((state) => ({
          settings: {
            ...state.settings,
            goals: {
              ...state.settings.goals,
              calories: Number.isFinite(calories) ? Math.max(0, calories) : 0,
            },
          },
        })),

      setMacroGoal: (macro, value) =>
        set((state) => {
          const macros = { ...state.settings.goals.macros };
          if (value === undefined || !Number.isFinite(value)) {
            delete macros[macro];
          } else {
            macros[macro] = Math.max(0, value);
          }
          return { settings: { ...state.settings, goals: { ...state.settings.goals, macros } } };
        }),

      setWeekStart: (weekStart) => get().updateSettings({ weekStart }),

      setProjectionProfile: (patch) =>
        set((state) => {
          const current = state.settings.projection;
          const next: ProjectionProfile = { ...current, ...patch };

          if (patch.sex !== undefined) {
            next.sex = patch.sex === 'male' || patch.sex === 'female' ? patch.sex : null;
          }
          if (patch.birthday !== undefined) {
            const birthday = patch.birthday;
            if (birthday === null) {
              next.birthday = null;
            } else {
              const age = ageYearsFromBirthday(birthday);
              next.birthday =
                isDateKey(birthday) && age !== null && age >= 0 && age <= 120 ? birthday : null;
            }
          }
          if (patch.heightCm !== undefined) {
            const height = patch.heightCm;
            next.heightCm =
              height === null || !Number.isFinite(height) || height < 50 || height > 300
                ? null
                : height;
          }
          if (patch.activity !== undefined) {
            const activity = patch.activity;
            next.activity =
              activity === 1.2 ||
              activity === 1.375 ||
              activity === 1.55 ||
              activity === 1.725 ||
              activity === 1.9
                ? activity
                : current.activity;
          }

          return {
            settings: {
              ...state.settings,
              projection: next,
            },
          };
        }),

      setAutoOptimizeThreshold: (threshold) => {
        const next = threshold === null ? null : normalizeAutoOptimizeThreshold(threshold);
        if (threshold !== null && next === null) return;
        set((state) => {
          const optimized = withAutoOptimize(state.days, state.weights, next);
          return {
            settings: { ...state.settings, autoOptimizeThreshold: next },
            days: optimized.days,
            weights: optimized.weights,
          };
        });
      },

      applyAutoOptimizeNow: () =>
        set((state) => {
          const optimized = withAutoOptimize(
            state.days,
            state.weights,
            state.settings.autoOptimizeThreshold,
          );
          return { days: optimized.days, weights: optimized.weights };
        }),

      exportJson: () => {
        const { version, days, weights, foodLibrary, foodFavorites, settings } = get();
        const snapshot: PersistedState = {
          version,
          days,
          weights,
          foodLibrary,
          foodFavorites,
          settings,
        };
        return JSON.stringify(snapshot, null, 2);
      },

      importJson: (raw) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return { ok: false, error: 'That file is not valid JSON.' };
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return { ok: false, error: 'Expected a Macro Tracker export object.' };
        }
        const state = parsePersistedState(parsed);
        const optimized = withAutoOptimize(
          state.days,
          state.weights,
          state.settings.autoOptimizeThreshold,
        );
        set({
          version: state.version,
          days: optimized.days,
          weights: optimized.weights,
          foodLibrary: state.foodLibrary,
          foodFavorites: state.foodFavorites,
          settings: state.settings,
        });
        return { ok: true };
      },

      optimizeStorage: () => {
        const beforeBytes = measureLocalStorageUsage(STORAGE_KEY).totalBytes;
        const state = get();
        const result = optimizeStorageBundle(state.days, state.weights, {
          storageUsedBytes: beforeBytes,
          targetRatio: OPTIMIZE_STORAGE_TARGET_RATIO,
        });
        if (result.monthsDropped === 0) {
          return { freedBytes: 0, monthsDropped: 0 };
        }
        set({ days: result.days, weights: result.weights });
        const afterBytes = measureLocalStorageUsage(STORAGE_KEY).totalBytes;
        return {
          freedBytes: Math.max(0, beforeBytes - afterBytes),
          monthsDropped: result.monthsDropped,
        };
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: migratePersistedState,
      merge: mergePersistedState,
      partialize: (state): PersistedState => ({
        version: state.version,
        days: state.days,
        weights: state.weights,
        foodLibrary: state.foodLibrary,
        foodFavorites: state.foodFavorites,
        settings: state.settings,
      }),
    },
  ),
);

/** Fresh default state, for tests and the reset flow. */
export function resetAppStore(): void {
  useAppStore.setState({ ...defaultPersistedState(), ...initialUiState() });
}
