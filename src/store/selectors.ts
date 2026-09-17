import { useMemo } from 'react';
import { mergeFoodLibraries, STARTER_FOOD_LIBRARY } from '../data/starterFoodLibrary';
import { computeDayBudget, sumEntries } from '../lib/totals';
import { useAppStore } from './useAppStore';
import type { DayBudget, DayTotals } from '../lib/totals';
import type {
  DateKey,
  FoodEntry,
  FoodLibraryItem,
  Goals,
  MacroKey,
  Settings,
  ViewName,
} from '../types';
import type { AppStore } from './useAppStore';

/** Shared empty array so `useDayEntries` keeps a stable reference for untouched days. */
const NO_ENTRIES: readonly FoodEntry[] = [];

export const selectView = (state: AppStore): ViewName => state.view;
export const selectSelectedDate = (state: AppStore): DateKey => state.selectedDate;
export const selectSettings = (state: AppStore): Settings => state.settings;
export const selectGoals = (state: AppStore): Goals => state.settings.goals;
export const selectVisibleMacros = (state: AppStore): MacroKey[] => state.settings.visibleMacros;

/** User-added custom foods only (persisted). */
export const selectCustomFoods = (state: AppStore): FoodLibraryItem[] => state.foodLibrary;

/** Starter catalog + custom foods, for quick-add and search. */
export const selectFoodLibrary = (state: AppStore): FoodLibraryItem[] =>
  mergeFoodLibraries(state.foodLibrary, STARTER_FOOD_LIBRARY);

export const selectDayEntries =
  (date: DateKey) =>
  (state: AppStore): readonly FoodEntry[] =>
    state.days[date] ?? NO_ENTRIES;

export function useView(): ViewName {
  return useAppStore(selectView);
}

export function useSelectedDate(): DateKey {
  return useAppStore(selectSelectedDate);
}

export function useSettings(): Settings {
  return useAppStore(selectSettings);
}

export function useGoals(): Goals {
  return useAppStore(selectGoals);
}

export function useVisibleMacros(): MacroKey[] {
  return useAppStore(selectVisibleMacros);
}

/** Combined starter + custom library. */
export function useFoodLibrary(): FoodLibraryItem[] {
  const custom = useAppStore(selectCustomFoods);
  return useMemo(() => mergeFoodLibraries(custom, STARTER_FOOD_LIBRARY), [custom]);
}

/** Persisted custom foods only. */
export function useCustomFoods(): FoodLibraryItem[] {
  return useAppStore(selectCustomFoods);
}

export function useStarterFoods(): readonly FoodLibraryItem[] {
  return STARTER_FOOD_LIBRARY;
}

export function useDayEntries(date: DateKey): readonly FoodEntry[] {
  return useAppStore(selectDayEntries(date));
}

/** Calorie and macro sums for one day. */
export function useDayTotals(date: DateKey): DayTotals {
  const entries = useDayEntries(date);
  return useMemo(() => sumEntries(entries), [entries]);
}

/** Remaining-budget view of one day, including per-macro slices where goals exist. */
export function useDayBudget(date: DateKey): DayBudget {
  const entries = useDayEntries(date);
  const goals = useGoals();
  return useMemo(() => computeDayBudget(entries, goals), [entries, goals]);
}
