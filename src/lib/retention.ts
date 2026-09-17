import { fromDateKey, monthKeyOf, toDateKey, todayKey } from './dates';
import { LOCAL_STORAGE_QUOTA_BYTES, stringStorageBytes } from './storage';
import type { DataRetentionPolicy, DateKey, FoodEntry, MonthKey } from '../types';

export type { DataRetentionPolicy };

export type DataRetentionOption = {
  value: DataRetentionPolicy;
  label: string;
  /** One-line explanation shown under the select. */
  description: string;
};

export const DATA_RETENTION_OPTIONS: ReadonlyArray<DataRetentionOption> = [
  {
    value: 'forever',
    label: 'Keep forever',
    description: 'Never delete logged days automatically.',
  },
  {
    value: 'retain-6-months',
    label: 'Retain 6 months of data',
    description: 'Delete day logs older than six months.',
  },
  {
    value: 'retain-1-year',
    label: 'Retain 1 year of data',
    description: 'Delete day logs older than one year.',
  },
  {
    value: 'pressure-90-drop-3-months',
    label: 'When storage is 90% full, delete the oldest 3 months',
    description: "Only trims history when this browser's local storage is nearly full.",
  },
];

const RETENTION_VALUES = new Set<string>(DATA_RETENTION_OPTIONS.map((option) => option.value));

export function isDataRetentionPolicy(value: unknown): value is DataRetentionPolicy {
  return typeof value === 'string' && RETENTION_VALUES.has(value);
}

export function retentionOption(policy: DataRetentionPolicy): DataRetentionOption {
  const found = DATA_RETENTION_OPTIONS.find((option) => option.value === policy);
  return found ?? DATA_RETENTION_OPTIONS[0]!;
}

/** First day that should still be kept for a rolling month window. */
export function retainCutoffKey(months: number, now: Date = new Date()): DateKey {
  const today = fromDateKey(todayKey(now));
  today.setMonth(today.getMonth() - months);
  return toDateKey(today);
}

function dropKeysBefore<T>(record: Record<DateKey, T>, cutoff: DateKey): Record<DateKey, T> {
  const next: Record<DateKey, T> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key >= cutoff) next[key] = value;
  }
  return next;
}

/** @deprecated Prefer `dropKeysBefore`; kept as the days-specific alias used by tests. */
function dropDaysBefore(
  days: Record<DateKey, FoodEntry[]>,
  cutoff: DateKey,
): Record<DateKey, FoodEntry[]> {
  return dropKeysBefore(days, cutoff);
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

export type RetentionContext = {
  now?: Date;
  /** Bytes currently used across this origin’s `localStorage`. */
  storageUsedBytes: number;
  /** Estimated bytes for a days map (JSON UTF-16). */
  estimateDaysBytes?: (days: Record<DateKey, FoodEntry[]>) => number;
  quotaBytes?: number;
};

function defaultEstimateDaysBytes(days: Record<DateKey, FoodEntry[]>): number {
  return stringStorageBytes(JSON.stringify(days));
}

/**
 * Returns a copy of `days` with entries removed per the active policy. Pure:
 * never mutates the input. Pressure mode may drop several 3-month windows until
 * usage is under the threshold or nothing older remains.
 */
export function applyDataRetention(
  days: Record<DateKey, FoodEntry[]>,
  policy: DataRetentionPolicy,
  context: RetentionContext,
): Record<DateKey, FoodEntry[]> {
  return applyDataRetentionBundle(days, {}, policy, context).days;
}

export type RetentionBundle = {
  days: Record<DateKey, FoodEntry[]>;
  weights: Record<DateKey, number>;
};

/**
 * Prunes food days and weigh-ins together so a weight-only history still obeys
 * the same retention window (and pressure drops months present in either map).
 */
export function applyDataRetentionBundle(
  days: Record<DateKey, FoodEntry[]>,
  weights: Record<DateKey, number>,
  policy: DataRetentionPolicy,
  context: RetentionContext,
): RetentionBundle {
  const now = context.now ?? new Date();
  const quotaBytes = context.quotaBytes ?? LOCAL_STORAGE_QUOTA_BYTES;
  const estimate = context.estimateDaysBytes ?? defaultEstimateDaysBytes;

  if (policy === 'forever') return { days, weights };

  if (policy === 'retain-6-months' || policy === 'retain-1-year') {
    const cutoff = retainCutoffKey(policy === 'retain-6-months' ? 6 : 12, now);
    return {
      days: dropDaysBefore(days, cutoff),
      weights: dropKeysBefore(weights, cutoff),
    };
  }

  // pressure-90-drop-3-months
  const threshold = quotaBytes * 0.9;
  let currentDays = days;
  let currentWeights = weights;
  let used = context.storageUsedBytes;
  for (let step = 0; step < 48 && used >= threshold; step += 1) {
    const months = oldestLoggedMonths(currentDays, Object.keys(currentWeights));
    if (months.length === 0) break;
    const beforeBytes = estimate(currentDays) + stringStorageBytes(JSON.stringify(currentWeights));
    const nextDays = dropOldestMonths(currentDays, 3, months);
    const nextWeights = dropOldestMonths(currentWeights, 3, months);
    if (
      Object.keys(nextDays).length === Object.keys(currentDays).length &&
      Object.keys(nextWeights).length === Object.keys(currentWeights).length
    ) {
      break;
    }
    const afterBytes = estimate(nextDays) + stringStorageBytes(JSON.stringify(nextWeights));
    used = Math.max(0, used - (beforeBytes - afterBytes));
    currentDays = nextDays;
    currentWeights = nextWeights;
  }
  return { days: currentDays, weights: currentWeights };
}

/** True when two day maps share the same keys (entries assumed unchanged). */
export function sameDayKeys(a: Record<DateKey, unknown>, b: Record<DateKey, unknown>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => key in b);
}
