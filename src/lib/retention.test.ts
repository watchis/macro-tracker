import { describe, expect, it } from 'vitest';
import { applyDataRetention, oldestLoggedMonths, retainCutoffKey } from './retention';
import { formatBytes, measureLocalStorageUsage, stringStorageBytes } from './storage';
import type { FoodEntry } from '../types';

function entry(name: string): FoodEntry {
  return {
    id: name,
    name,
    grams: 100,
    calories: 100,
    macros: {},
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('formatBytes', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(12_288)).toBe('12 KB');
    expect(formatBytes(1_572_864)).toBe('1.50 MB');
  });
});

describe('measureLocalStorageUsage', () => {
  it('counts UTF-16 bytes for every key and isolates the app key', () => {
    localStorage.setItem('macro-tracker/v1', '{"ok":true}');
    localStorage.setItem('other', 'xx');

    const usage = measureLocalStorageUsage('macro-tracker/v1');
    expect(usage.appBytes).toBe(
      stringStorageBytes('macro-tracker/v1') + stringStorageBytes('{"ok":true}'),
    );
    expect(usage.totalBytes).toBe(
      usage.appBytes + stringStorageBytes('other') + stringStorageBytes('xx'),
    );
    expect(usage.usedRatio).toBeGreaterThan(0);
    expect(usage.usedRatio).toBeLessThan(1);
  });
});

describe('retainCutoffKey', () => {
  it('rolls back by calendar months from today', () => {
    expect(retainCutoffKey(12, new Date(2026, 8, 17))).toBe('2025-09-17');
    expect(retainCutoffKey(6, new Date(2026, 8, 17))).toBe('2026-03-17');
  });
});

describe('applyDataRetention', () => {
  const days = {
    '2024-01-10': [entry('old')],
    '2025-10-01': [entry('mid')],
    '2026-09-17': [entry('new')],
  };

  it('keeps everything when the policy is forever', () => {
    expect(applyDataRetention(days, 'forever', { storageUsedBytes: 0 })).toEqual(days);
  });

  it('drops days older than one year', () => {
    const pruned = applyDataRetention(days, 'retain-1-year', {
      storageUsedBytes: 0,
      now: new Date(2026, 8, 17),
    });
    expect(Object.keys(pruned).sort()).toEqual(['2025-10-01', '2026-09-17']);
  });

  it('drops days older than six months', () => {
    const pruned = applyDataRetention(days, 'retain-6-months', {
      storageUsedBytes: 0,
      now: new Date(2026, 8, 17),
    });
    expect(Object.keys(pruned)).toEqual(['2026-09-17']);
  });

  it('does nothing under the storage pressure threshold', () => {
    const pruned = applyDataRetention(days, 'pressure-90-drop-3-months', {
      storageUsedBytes: 1000,
      quotaBytes: 10_000,
    });
    expect(pruned).toEqual(days);
  });

  it('deletes the oldest three months when storage is over 90%', () => {
    const dense = {
      '2025-01-01': [entry('jan')],
      '2025-02-01': [entry('feb')],
      '2025-03-01': [entry('mar')],
      '2025-04-01': [entry('apr')],
      '2026-09-17': [entry('now')],
    };
    expect(oldestLoggedMonths(dense)).toEqual([
      '2025-01',
      '2025-02',
      '2025-03',
      '2025-04',
      '2026-09',
    ]);

    const pruned = applyDataRetention(dense, 'pressure-90-drop-3-months', {
      storageUsedBytes: 9500,
      quotaBytes: 10_000,
      // Force a single 3-month drop to land under the threshold.
      estimateDaysBytes: (map) => Object.keys(map).length * 1000,
    });

    expect(Object.keys(pruned).sort()).toEqual(['2025-04-01', '2026-09-17']);
  });
});
