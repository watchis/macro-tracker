import { MACRO_KEYS, emptyMacroTotals, normalizeMacros } from './macros';
import type {
  FoodEntry,
  FoodEntryInput,
  FoodLibraryItem,
  Goals,
  MacroKey,
  MacroTotals,
} from '../types';

export type DayTotals = {
  calories: number;
  macros: MacroTotals;
  entryCount: number;
};

/** Remaining-budget view of a single number against its goal. */
export type BudgetSlice = {
  consumed: number;
  goal: number;
  /** Goal minus consumed. Negative once the goal is exceeded. */
  remaining: number;
  /**
   * Share of the budget still available, 0-100. Starts at 100 for an empty day
   * and depletes toward 0, which is what the inverted budget bar renders.
   */
  percentRemaining: number;
  /** Share of the budget consumed, 0-100. */
  percentConsumed: number;
  isOver: boolean;
  /** How far past the goal, never negative. */
  overBy: number;
  /** True when no meaningful goal is set, so the bar should stay neutral. */
  hasGoal: boolean;
};

export type DayBudget = {
  calories: BudgetSlice;
  macros: Partial<Record<MacroKey, BudgetSlice>>;
  totals: DayTotals;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function toNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Sums calories and every macro across a day's entries. */
export function sumEntries(entries: readonly FoodEntry[] | undefined): DayTotals {
  const macros = emptyMacroTotals();
  let calories = 0;
  for (const entry of entries ?? []) {
    calories += toNumber(entry.calories);
    for (const key of MACRO_KEYS) {
      macros[key] += toNumber(entry.macros?.[key]);
    }
  }
  for (const key of MACRO_KEYS) {
    macros[key] = round(macros[key]);
  }
  return { calories: round(calories), macros, entryCount: entries?.length ?? 0 };
}

/** Remaining budget for one goal/consumed pair. A goal of 0 or less counts as unset. */
export function budgetSlice(consumed: number, goal: number): BudgetSlice {
  const safeConsumed = toNumber(consumed);
  const safeGoal = toNumber(goal);
  const hasGoal = safeGoal > 0;
  const remaining = round(safeGoal - safeConsumed);
  const percentConsumed = hasGoal ? clampPercent((safeConsumed / safeGoal) * 100) : 0;
  return {
    consumed: round(safeConsumed),
    goal: round(safeGoal),
    remaining,
    percentRemaining: hasGoal ? round(100 - percentConsumed, 4) : 100,
    percentConsumed: hasGoal ? round(percentConsumed, 4) : 0,
    isOver: hasGoal && remaining < 0,
    overBy: remaining < 0 ? round(-remaining) : 0,
    hasGoal,
  };
}

/**
 * Full budget for a day: calorie budget plus one slice per macro that has a goal.
 * Macros without a goal are omitted so callers can fall back to plain totals.
 */
export function computeDayBudget(
  entries: readonly FoodEntry[] | undefined,
  goals: Goals,
): DayBudget {
  const totals = sumEntries(entries);
  const macros: Partial<Record<MacroKey, BudgetSlice>> = {};
  for (const key of MACRO_KEYS) {
    const goal = goals.macros?.[key];
    if (typeof goal === 'number' && Number.isFinite(goal) && goal > 0) {
      macros[key] = budgetSlice(totals.macros[key], goal);
    }
  }
  return { calories: budgetSlice(totals.calories, goals.calories), macros, totals };
}

/**
 * Scales a library food (stated for `item.grams`) to `grams`, producing an entry
 * input ready for `addEntry`.
 */
export function scaleFood(item: FoodLibraryItem, grams: number): FoodEntryInput {
  const base = toNumber(item.grams);
  const target = toNumber(grams);
  const factor = base > 0 ? target / base : 0;
  const macros = normalizeMacros(item.macros);
  const scaled: FoodEntryInput['macros'] = {};
  for (const key of MACRO_KEYS) {
    const value = macros[key];
    if (typeof value === 'number') {
      scaled[key] = round(value * factor);
    }
  }
  return {
    name: item.name,
    grams: round(target),
    calories: round(toNumber(item.calories) * factor),
    macros: scaled,
  };
}

/** `1,850` style formatting for calorie readouts. */
export function formatCalories(value: number): string {
  return Math.round(value).toLocaleString();
}
