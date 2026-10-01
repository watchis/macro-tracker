import { describe, expect, it } from 'vitest';
import {
  applyAutoOptimize,
  normalizeAutoOptimizeThreshold,
  oldestLoggedMonths,
  optimizeStorageBundle,
  thresholdFromLegacyRetention,
} from './retention';
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

describe('normalizeAutoOptimizeThreshold', () => {
  it('accepts integers in range and rejects everything else', () => {
    expect(normalizeAutoOptimizeThreshold(90)).toBe(90);
    expect(normalizeAutoOptimizeThreshold('75')).toBe(75);
    expect(normalizeAutoOptimizeThreshold(49)).toBeNull();
    expect(normalizeAutoOptimizeThreshold(99)).toBeNull();
    expect(normalizeAutoOptimizeThreshold(null)).toBeNull();
    expect(normalizeAutoOptimizeThreshold('nope')).toBeNull();
  });
});

describe('thresholdFromLegacyRetention', () => {
  it('maps forever to disabled and other policies to 90%', () => {
    expect(thresholdFromLegacyRetention('forever')).toBeNull();
    expect(thresholdFromLegacyRetention('retain-1-year')).toBe(90);
    expect(thresholdFromLegacyRetention('pressure-90-drop-3-months')).toBe(90);
  });
});

describe('applyAutoOptimize', () => {
  const days = {
    '2025-01-01': [entry('jan')],
    '2025-02-01': [entry('feb')],
    '2026-09-17': [entry('now')],
  };

  it('does nothing when auto-optimize is disabled', () => {
    const result = applyAutoOptimize(days, {}, null, {
      storageUsedBytes: 9500,
      quotaBytes: 10_000,
    });
    expect(result.monthsDropped).toBe(0);
    expect(result.days).toEqual(days);
  });

  it('does nothing under the configured threshold', () => {
    const result = applyAutoOptimize(days, {}, 90, {
      storageUsedBytes: 1000,
      quotaBytes: 10_000,
    });
    expect(result.monthsDropped).toBe(0);
    expect(result.days).toEqual(days);
  });

  it('drops oldest months when usage is at or above the threshold', () => {
    expect(oldestLoggedMonths(days)).toEqual(['2025-01', '2025-02', '2026-09']);
    const result = applyAutoOptimize(days, {}, 90, {
      storageUsedBytes: 9500,
      quotaBytes: 10_000,
      estimateDaysBytes: (map) => Object.keys(map).length * 2000,
    });
    expect(result.monthsDropped).toBeGreaterThan(0);
    expect(Object.keys(result.days)).toContain('2026-09-17');
    expect(Object.keys(result.days)).not.toContain('2025-01-01');
  });
});

describe('optimizeStorageBundle', () => {
  it('does nothing when usage is already under the target', () => {
    const days = {
      '2025-01-01': [entry('old')],
      '2026-09-17': [entry('new')],
    };
    const result = optimizeStorageBundle(
      days,
      {},
      {
        storageUsedBytes: 1000,
        quotaBytes: 10_000,
      },
    );
    expect(result.monthsDropped).toBe(0);
    expect(result.estimatedFreedBytes).toBe(0);
    expect(result.days).toEqual(days);
  });

  it('drops oldest months one at a time until under the target', () => {
    const days = {
      '2025-01-01': [entry('jan')],
      '2025-02-01': [entry('feb')],
      '2025-03-01': [entry('mar')],
      '2026-09-17': [entry('now')],
    };
    const result = optimizeStorageBundle(
      days,
      { '2025-01-15': 70 },
      {
        storageUsedBytes: 9000,
        quotaBytes: 10_000,
        targetRatio: 0.7,
        estimateDaysBytes: (map) => Object.keys(map).length * 2000,
      },
    );

    expect(result.monthsDropped).toBe(1);
    expect(Object.keys(result.days).sort()).toEqual(['2025-02-01', '2025-03-01', '2026-09-17']);
    expect(result.weights).toEqual({});
    expect(result.estimatedFreedBytes).toBeGreaterThan(0);
  });

  it('keeps the newest month even when still over the target', () => {
    const days = {
      '2025-01-01': [entry('jan')],
      '2026-09-17': [entry('now')],
    };
    const result = optimizeStorageBundle(
      days,
      {},
      {
        storageUsedBytes: 9500,
        quotaBytes: 10_000,
        targetRatio: 0.5,
        estimateDaysBytes: (map) => Object.keys(map).length * 4000,
      },
    );

    expect(result.monthsDropped).toBe(1);
    expect(Object.keys(result.days)).toEqual(['2026-09-17']);
  });
});
