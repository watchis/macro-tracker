import { describe, expect, it } from 'vitest';
import { budgetSlice, computeDayBudget, scaleFood, sumEntries } from './totals';
import type { FoodEntry, Goals } from '../types';

function entry(partial: Partial<FoodEntry> & { calories: number }): FoodEntry {
  return {
    id: partial.id ?? 'id',
    name: partial.name ?? 'Food',
    grams: partial.grams ?? 100,
    calories: partial.calories,
    macros: partial.macros ?? {},
    createdAt: partial.createdAt ?? '2026-09-17T08:00:00.000Z',
  };
}

const goals: Goals = { calories: 2000, macros: { protein: 150, carbs: 200, fat: 65 } };

describe('sumEntries', () => {
  it('returns zeroed totals for an empty or missing day', () => {
    for (const entries of [undefined, []]) {
      const totals = sumEntries(entries);
      expect(totals.calories).toBe(0);
      expect(totals.entryCount).toBe(0);
      expect(totals.macros).toEqual({
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        satFat: 0,
        sodium: 0,
      });
    }
  });

  it('sums calories and every macro across entries', () => {
    const totals = sumEntries([
      entry({ calories: 165, macros: { protein: 31, fat: 3.6, sodium: 74 } }),
      entry({ calories: 130, macros: { protein: 2.7, carbs: 28, fiber: 0.4 } }),
    ]);

    expect(totals.calories).toBe(295);
    expect(totals.entryCount).toBe(2);
    expect(totals.macros.protein).toBe(33.7);
    expect(totals.macros.carbs).toBe(28);
    expect(totals.macros.fat).toBe(3.6);
    expect(totals.macros.fiber).toBe(0.4);
    expect(totals.macros.sodium).toBe(74);
    expect(totals.macros.sugar).toBe(0);
  });

  it('treats absent and non-numeric values as zero', () => {
    const broken = {
      id: 'x',
      name: 'Broken',
      grams: 50,
      calories: Number.NaN,
      macros: { protein: Number.POSITIVE_INFINITY },
      createdAt: '',
    } as FoodEntry;

    const totals = sumEntries([broken, entry({ calories: 100 })]);
    expect(totals.calories).toBe(100);
    expect(totals.macros.protein).toBe(0);
  });

  it('rounds away floating point noise', () => {
    const totals = sumEntries([
      entry({ calories: 0.1, macros: { fat: 0.1 } }),
      entry({ calories: 0.2, macros: { fat: 0.2 } }),
    ]);
    expect(totals.calories).toBe(0.3);
    expect(totals.macros.fat).toBe(0.3);
  });
});

describe('budgetSlice', () => {
  it('starts full and depletes as the budget is consumed', () => {
    const empty = budgetSlice(0, 2000);
    expect(empty.remaining).toBe(2000);
    expect(empty.percentRemaining).toBe(100);
    expect(empty.percentConsumed).toBe(0);
    expect(empty.isOver).toBe(false);

    const half = budgetSlice(1000, 2000);
    expect(half.remaining).toBe(1000);
    expect(half.percentRemaining).toBe(50);
    expect(half.percentConsumed).toBe(50);

    const spent = budgetSlice(2000, 2000);
    expect(spent.remaining).toBe(0);
    expect(spent.percentRemaining).toBe(0);
    expect(spent.isOver).toBe(false);
  });

  it('reports an over-budget day with a clamped bar and positive overBy', () => {
    const over = budgetSlice(2350, 2000);
    expect(over.remaining).toBe(-350);
    expect(over.overBy).toBe(350);
    expect(over.isOver).toBe(true);
    expect(over.percentRemaining).toBe(0);
    expect(over.percentConsumed).toBe(100);
  });

  it('stays neutral when no goal is set', () => {
    for (const goal of [0, -100, Number.NaN]) {
      const slice = budgetSlice(500, goal);
      expect(slice.hasGoal).toBe(false);
      expect(slice.isOver).toBe(false);
      expect(slice.percentRemaining).toBe(100);
      expect(slice.percentConsumed).toBe(0);
    }
  });
});

describe('computeDayBudget', () => {
  it('builds calorie and per-macro slices from a day of entries', () => {
    const budget = computeDayBudget(
      [
        entry({ calories: 500, macros: { protein: 40, carbs: 50, fat: 15, sodium: 300 } }),
        entry({ calories: 700, macros: { protein: 60, carbs: 70, fat: 20 } }),
      ],
      goals,
    );

    expect(budget.totals.calories).toBe(1200);
    expect(budget.calories.remaining).toBe(800);
    expect(budget.calories.percentRemaining).toBe(40);

    expect(budget.macros.protein?.consumed).toBe(100);
    expect(budget.macros.protein?.remaining).toBe(50);
    expect(budget.macros.fat?.remaining).toBe(30);
    // No goal for sodium, so no slice even though it was logged.
    expect(budget.macros.sodium).toBeUndefined();
    expect(budget.totals.macros.sodium).toBe(300);
  });

  it('flags an over-budget macro independently of calories', () => {
    const budget = computeDayBudget([entry({ calories: 400, macros: { fat: 80 } })], goals);
    expect(budget.calories.isOver).toBe(false);
    expect(budget.macros.fat?.isOver).toBe(true);
    expect(budget.macros.fat?.overBy).toBe(15);
  });
});

describe('scaleFood', () => {
  it('scales calories and macros from the reference grams', () => {
    const scaled = scaleFood(
      { name: 'Chicken breast', grams: 100, calories: 165, macros: { protein: 31, fat: 3.6 } },
      150,
    );

    expect(scaled).toEqual({
      name: 'Chicken breast',
      grams: 150,
      calories: 247.5,
      macros: { protein: 46.5, fat: 5.4 },
    });
  });

  it('zeroes out rather than dividing by a zero reference weight', () => {
    const scaled = scaleFood({ name: 'Bad', grams: 0, calories: 100, macros: { fat: 5 } }, 50);
    expect(scaled.calories).toBe(0);
    expect(scaled.macros.fat).toBe(0);
  });
});
