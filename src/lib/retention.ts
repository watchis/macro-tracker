import { monthKeyOf } from './dates';
import { LOCAL_STORAGE_QUOTA_BYTES, stringStorageBytes } from './storage';
import type { DateKey, FoodEntry, MonthKey } from '../types';

/** Default auto-optimize threshold when the setting is enabled. */
export const DEFAULT_AUTO_OPTIMIZE_THRESHOLD = 90;

/**
 * Usage at or above this ratio locks inputs across the app and shows a top-bar
 * warning. Auto-optimize thresholds must stay below this.
 */
export const STORAGE_CRITICAL_RATIO = 0.99;

/** Inclusive percent bounds for a configured auto-optimize threshold. */
export const AUTO_OPTIMIZE_THRESHOLD_MIN = 50;
export const AUTO_OPTIMIZE_THRESHOLD_MAX = 98;

/** Target fill ratio for a manual Optimize storage pass. */
export const OPTIMIZE_STORAGE_TARGET_RATIO = 0.7;

export type RetentionContext = {
  /** Bytes currently used across this origin’s `localStorage`. */
  storageUsedBytes: number;
  /** Estimated bytes for a days map (JSON UTF-16). */
  estimateDaysBytes?: (days: Record<DateKey, FoodEntry[]>) => number;
  quotaBytes?: number;
};

export type RetentionBundle = {
  days: Record<DateKey, FoodEntry[]>;
  weights: Record<DateKey, number>;
};

export type OptimizeStorageResult = RetentionBundle & {
  monthsDropped: number;
  estimatedFreedBytes: number;
};

function defaultEstimateDaysBytes(days: Record<DateKey, FoodEntry[]>): number {
  return stringStorageBytes(JSON.stringify(days));
}

/** Oldest calendar months that still have at least one keyed day, ascending. */
export function oldestLoggedMonths(
  days: Record<DateKey, unknown>,
  extraKeys: Iterable<DateKey> = [],
): MonthKey[] {
  const months = new Set<MonthKey>();
  for (const key of Object.keys(days)) {
    months.add(monthKeyOf(key));
  }
  for (const key of extraKeys) {
    months.add(monthKeyOf(key));
  }
  return [...months].sort();
}

function dropOldestMonths<T>(
  record: Record<DateKey, T>,
  monthCount: number,
  monthSource: MonthKey[] = oldestLoggedMonths(record),
): Record<DateKey, T> {
  if (monthCount <= 0) return record;
  const drop = new Set(monthSource.slice(0, monthCount));
  if (drop.size === 0) return record;
  const next: Record<DateKey, T> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!drop.has(monthKeyOf(key))) next[key] = value;
  }
  return next;
}

/**
 * Clamps a percent threshold into the allowed auto-optimize range, or returns
 * `null` when auto-optimize is disabled.
 */
export function normalizeAutoOptimizeThreshold(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < AUTO_OPTIMIZE_THRESHOLD_MIN || rounded > AUTO_OPTIMIZE_THRESHOLD_MAX) {
    return null;
  }
  return rounded;
}

/**
 * Maps a legacy `dataRetention` policy onto the auto-optimize threshold.
 * `forever` stays disabled; every other known policy becomes 90%.
 */
export function thresholdFromLegacyRetention(value: unknown): number | null {
  if (value === 'forever') return null;
  if (
    value === 'retain-6-months' ||
    value === 'retain-1-year' ||
    value === 'pressure-90-drop-3-months'
  ) {
    return DEFAULT_AUTO_OPTIMIZE_THRESHOLD;
  }
  return DEFAULT_AUTO_OPTIMIZE_THRESHOLD;
}

/**
 * Frees local storage by dropping the oldest logged months first, while keeping
 * settings/library untouched and preserving the newest month of history.
 * Stops once usage is at or under `targetRatio` of quota.
 */
export function optimizeStorageBundle(
  days: Record<DateKey, FoodEntry[]>,
  weights: Record<DateKey, number>,
  context: RetentionContext & { targetRatio?: number },
): OptimizeStorageResult {
  const quotaBytes = context.quotaBytes ?? LOCAL_STORAGE_QUOTA_BYTES;
  const targetRatio = context.targetRatio ?? OPTIMIZE_STORAGE_TARGET_RATIO;
  const threshold = quotaBytes * targetRatio;
  const estimate = context.estimateDaysBytes ?? defaultEstimateDaysBytes;

  let currentDays = days;
  let currentWeights = weights;
  let used = context.storageUsedBytes;
  let monthsDropped = 0;
  let estimatedFreedBytes = 0;

  for (let step = 0; step < 120 && used > threshold; step += 1) {
    const months = oldestLoggedMonths(currentDays, Object.keys(currentWeights));
    // Keep at least the newest month so recent logging is never wiped entirely.
    if (months.length <= 1) break;

    const beforeBytes = estimate(currentDays) + stringStorageBytes(JSON.stringify(currentWeights));
    const nextDays = dropOldestMonths(currentDays, 1, months);
    const nextWeights = dropOldestMonths(currentWeights, 1, months);
    if (
      Object.keys(nextDays).length === Object.keys(currentDays).length &&
      Object.keys(nextWeights).length === Object.keys(currentWeights).length
    ) {
      break;
    }
    const afterBytes = estimate(nextDays) + stringStorageBytes(JSON.stringify(nextWeights));
    const freed = Math.max(0, beforeBytes - afterBytes);
    estimatedFreedBytes += freed;
    used = Math.max(0, used - freed);
    currentDays = nextDays;
    currentWeights = nextWeights;
    monthsDropped += 1;
  }

  return {
    days: currentDays,
    weights: currentWeights,
    monthsDropped,
    estimatedFreedBytes,
  };
}

/**
 * Runs optimize when a threshold is configured and current usage is at or above
 * it. `null` threshold means auto-optimize is disabled.
 */
export function applyAutoOptimize(
  days: Record<DateKey, FoodEntry[]>,
  weights: Record<DateKey, number>,
  thresholdPercent: number | null,
  context: RetentionContext,
): OptimizeStorageResult {
  if (thresholdPercent === null) {
    return { days, weights, monthsDropped: 0, estimatedFreedBytes: 0 };
  }
  const quotaBytes = context.quotaBytes ?? LOCAL_STORAGE_QUOTA_BYTES;
  const targetRatio = thresholdPercent / 100;
  if (context.storageUsedBytes / quotaBytes < targetRatio) {
    return { days, weights, monthsDropped: 0, estimatedFreedBytes: 0 };
  }
  return optimizeStorageBundle(days, weights, { ...context, targetRatio });
}

/** True when two day maps share the same keys (entries assumed unchanged). */
export function sameDayKeys(a: Record<DateKey, unknown>, b: Record<DateKey, unknown>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => key in b);
}
