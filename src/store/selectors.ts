import { useMemo } from 'react';
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
  WeightUnit,
} from '../types';
import type { AppStore } from './useAppStore';

/** Shared empty array so `useDayEntries` keeps a stable reference for untouched days. */
const NO_ENTRIES: readonly FoodEntry[] = [];

export const selectView = (state: AppStore): ViewName => state.view;
export const selectSelectedDate = (state: AppStore): DateKey => state.selectedDate;
export const selectSettings = (state: AppStore): Settings => state.settings;
export const selectGoals = (state: AppStore): Goals => state.settings.goals;
export const selectVisibleMacros = (state: AppStore): MacroKey[] => state.settings.visibleMacros;
export const selectWeightUnit = (state: AppStore): WeightUnit => state.settings.weightUnit;
export const selectWeights = (state: AppStore): Record<DateKey, number> => state.weights;

/** User-added custom foods only (persisted). */
export const selectCustomFoods = (state: AppStore): FoodLibraryItem[] => state.foodLibrary;

/**
 * @deprecated Prefer `useCustomFoods` plus `queryStarterFoods`. Returns customs only —
 * the USDA catalog is lazy-loaded and no longer merged synchronously.
 */
export const selectFoodLibrary = selectCustomFoods;

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

export function useWeightUnit(): WeightUnit {
  return useAppStore(selectWeightUnit);
}

export function useWeights(): Record<DateKey, number> {
  return useAppStore(selectWeights);
}

/** Persisted custom foods only. */
export function useCustomFoods(): FoodLibraryItem[] {
  return useAppStore(selectCustomFoods);
}

/**
 * @deprecated Alias of `useCustomFoods`. Starter foods are loaded asynchronously
 * via `queryStarterFoods` so the initial bundle stays small.
 */
export function useFoodLibrary(): FoodLibraryItem[] {
  return useCustomFoods();
}

export function useDayEntries(date: DateKey): readonly FoodEntry[] {
  return useAppStore(selectDayEntries(date));
}

/** Body weight in kilograms for one day, or `undefined` when unset. */
export function useDayWeightKg(date: DateKey): number | undefined {
  return useAppStore((state) => state.weights[date]);
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
