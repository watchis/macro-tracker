import { describe, expect, it } from 'vitest';
import { calorieDeltaSeries, calorieSeries, linearTrend, weightSeries } from './series';
import type { FoodEntry } from '../types';

function entry(calories: number): FoodEntry {
  return {
    id: String(calories),
    name: 'Food',
    grams: 100,
    calories,
    macros: {},
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('weightSeries', () => {
  it('sorts by date and drops non-finite values', () => {
    const series = weightSeries({
      '2026-09-17': 80,
      '2026-09-10': 81,
      '2026-09-12': Number.NaN,
    });
    expect(series.map((point) => point.date)).toEqual(['2026-09-10', '2026-09-17']);
    expect(series[0]?.value).toBe(81);
  });
});

describe('calorieSeries', () => {
  it('sums each logged day', () => {
    const series = calorieSeries({
      '2026-09-17': [entry(500), entry(300)],
      '2026-09-16': [entry(2000)],
    });
    expect(series).toEqual([
      expect.objectContaining({ date: '2026-09-16', value: 2000 }),
      expect.objectContaining({ date: '2026-09-17', value: 800 }),
    ]);
  });
});

describe('calorieDeltaSeries', () => {
  it('returns empty when no calorie goal is set', () => {
    expect(calorieDeltaSeries({ '2026-09-17': [entry(100)] }, { calories: 0, macros: {} })).toEqual(
      [],
    );
  });

  it('reports overages as positive and underages as negative', () => {
    const series = calorieDeltaSeries(
      {
        '2026-09-16': [entry(1800)],
        '2026-09-17': [entry(2200)],
      },
      { calories: 2000, macros: {} },
    );
    expect(series[0]?.delta).toBe(-200);
    expect(series[1]?.delta).toBe(200);
  });
});

describe('linearTrend', () => {
  it('returns null for fewer than two points', () => {
    expect(linearTrend([])).toBeNull();
    expect(linearTrend([{ date: '2026-09-17', t: 1, value: 80 }])).toBeNull();
  });

  it('fits a rising line and exposes the mean', () => {
    const day = 86_400_000;
    const points = [
      { date: '2026-09-10', t: 0, value: 80 },
      { date: '2026-09-11', t: day, value: 81 },
      { date: '2026-09-12', t: day * 2, value: 82 },
    ];
    const trend = linearTrend(points);
    expect(trend).not.toBeNull();
    expect(trend!.mean).toBe(81);
    expect(trend!.slopePerDay).toBeCloseTo(1, 6);
    expect(trend!.at(day)).toBeCloseTo(81, 6);
  });
});
