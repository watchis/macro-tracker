import { fromDateKey } from './dates';
import { sumEntries } from './totals';
import type { DateKey, FoodEntry, Goals } from '../types';

export type DatedPoint = {
  date: DateKey;
  /** Local-midnight epoch ms — handy for linear regression and axis ticks. */
  t: number;
  value: number;
};

export type CalorieDeltaPoint = DatedPoint & {
  calories: number;
  goal: number;
  /** Positive = over goal, negative = under. */
  delta: number;
};

function toEpoch(date: DateKey): number {
  return fromDateKey(date).getTime();
}

/** Sorted weight points from the persisted kg map. */
export function weightSeries(weights: Record<DateKey, number>): DatedPoint[] {
  return Object.keys(weights)
    .sort()
    .filter((date) => Number.isFinite(weights[date]))
    .map((date) => ({
      date,
      t: toEpoch(date),
      value: weights[date] as number,
    }));
}

/** Daily calorie totals for every day that has at least one food entry. */
export function calorieSeries(days: Record<DateKey, FoodEntry[]>): DatedPoint[] {
  return Object.keys(days)
    .sort()
    .map((date) => {
      const totals = sumEntries(days[date]);
      return { date, t: toEpoch(date), value: totals.calories };
    })
    .filter((point) => point.value > 0 || (days[point.date]?.length ?? 0) > 0);
}

/**
 * Calorie overage/underage vs the active goal. Days without a meaningful goal
 * are omitted so the chart stays empty rather than flat-lining at consumed.
 */
export function calorieDeltaSeries(
  days: Record<DateKey, FoodEntry[]>,
  goals: Goals,
): CalorieDeltaPoint[] {
  const goal = goals.calories;
  if (!(typeof goal === 'number' && Number.isFinite(goal) && goal > 0)) return [];

  return Object.keys(days)
    .sort()
    .map((date) => {
      const calories = sumEntries(days[date]).calories;
      const delta = calories - goal;
      return { date, t: toEpoch(date), value: delta, calories, goal, delta };
    });
}

export type LinearTrend = {
  /** Predicted y at time t (epoch ms). */
  at: (t: number) => number;
  /** Slope in value-units per day. */
  slopePerDay: number;
  mean: number;
};

/**
 * Ordinary least-squares fit of value against time. Returns null when there
 * are fewer than two distinct points — a single reading has no trend.
 */
export function linearTrend(points: readonly DatedPoint[]): LinearTrend | null {
  if (points.length < 2) return null;

  let sumT = 0;
  let sumY = 0;
  for (const point of points) {
    sumT += point.t;
    sumY += point.value;
  }
  const n = points.length;
  const meanT = sumT / n;
  const meanY = sumY / n;

  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const dt = point.t - meanT;
    numerator += dt * (point.value - meanY);
    denominator += dt * dt;
  }
  if (denominator === 0) return null;

  const slopePerMs = numerator / denominator;
  const intercept = meanY - slopePerMs * meanT;
  const msPerDay = 86_400_000;

  return {
    at: (t) => intercept + slopePerMs * t,
    slopePerDay: slopePerMs * msPerDay,
    mean: meanY,
  };
}
