import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  daysInMonth,
  fromDateKey,
  isDateKey,
  monthDateKeys,
  monthKeyOf,
  toDateKey,
  todayKey,
  weekdayLabels,
} from './dates';

describe('date keys', () => {
  it('round-trips a local date without drifting across time zones', () => {
    const key = '2026-09-17';
    expect(toDateKey(fromDateKey(key))).toBe(key);
    expect(fromDateKey(key).getDate()).toBe(17);
    expect(fromDateKey(key).getHours()).toBe(0);
  });

  it('validates the key format', () => {
    expect(isDateKey('2026-09-17')).toBe(true);
    expect(isDateKey('2026-9-17')).toBe(false);
    expect(isDateKey('nope')).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
  });

  it('uses the local day for today', () => {
    const now = new Date(2026, 8, 17, 23, 30);
    expect(todayKey(now)).toBe('2026-09-17');
  });

  it('crosses month and year boundaries when adding days', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });
});

describe('months', () => {
  it('derives and shifts month keys', () => {
    expect(monthKeyOf('2026-09-17')).toBe('2026-09');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('counts days including leap years', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-09')).toBe(30);
    expect(monthDateKeys('2026-02').at(-1)).toBe('2026-02-28');
  });
});

describe('buildMonthGrid', () => {
  it('pads to whole weeks starting on Sunday', () => {
    const grid = buildMonthGrid('2026-09', 'sunday');
    expect(grid.length % 7).toBe(0);
    // 2026-09-01 is a Tuesday, so the grid opens on the preceding Sunday.
    expect(grid[0]).toBe('2026-08-30');
    expect(grid).toContain('2026-09-01');
    expect(grid).toContain('2026-09-30');
    expect(grid.at(-1)).toBe('2026-10-03');
  });

  it('pads to whole weeks starting on Monday', () => {
    const grid = buildMonthGrid('2026-09', 'monday');
    expect(grid.length % 7).toBe(0);
    expect(grid[0]).toBe('2026-08-31');
  });

  it('does not pad a month that already aligns to the week start', () => {
    // 2026-02-01 is a Sunday and February 2026 has exactly 28 days.
    expect(buildMonthGrid('2026-02', 'sunday')).toHaveLength(28);
  });

  it('orders weekday labels by the week start', () => {
    expect(weekdayLabels('sunday')[0]).toBe('Sun');
    expect(weekdayLabels('monday')[0]).toBe('Mon');
    expect(weekdayLabels('monday').at(-1)).toBe('Sun');
  });
});
