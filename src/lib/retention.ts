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

function dropDaysBefore(
  days: Record<DateKey, FoodEntry[]>,
  cutoff: DateKey,
): Record<DateKey, FoodEntry[]> {
  const next: Record<DateKey, FoodEntry[]> = {};
  for (const [key, entries] of Object.entries(days)) {
    if (key >= cutoff) next[key] = entries;
  }
  return next;
}

/** Oldest calendar months that still have at least one logged day, ascending. */
export function oldestLoggedMonths(days: Record<DateKey, FoodEntry[]>): MonthKey[] {
  const months = new Set<MonthKey>();
  for (const key of Object.keys(days)) {
    months.add(monthKeyOf(key));
  }
  return [...months].sort();
}

function dropOldestMonths(
  days: Record<DateKey, FoodEntry[]>,
  monthCount: number,
): Record<DateKey, FoodEntry[]> {
  if (monthCount <= 0) return days;
  const drop = new Set(oldestLoggedMonths(days).slice(0, monthCount));
  if (drop.size === 0) return days;
  const next: Record<DateKey, FoodEntry[]> = {};
  for (const [key, entries] of Object.entries(days)) {
    if (!drop.has(monthKeyOf(key))) next[key] = entries;
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
  const now = context.now ?? new Date();
  const quotaBytes = context.quotaBytes ?? LOCAL_STORAGE_QUOTA_BYTES;
  const estimate = context.estimateDaysBytes ?? defaultEstimateDaysBytes;

  if (policy === 'forever') return days;

  if (policy === 'retain-6-months') {
    return dropDaysBefore(days, retainCutoffKey(6, now));
  }

  if (policy === 'retain-1-year') {
    return dropDaysBefore(days, retainCutoffKey(12, now));
  }

  // pressure-90-drop-3-months
  const threshold = quotaBytes * 0.9;
  let current = days;
  let used = context.storageUsedBytes;
  // Cap iterations so a pathological estimate cannot loop forever.
  for (let step = 0; step < 48 && used >= threshold; step += 1) {
    const months = oldestLoggedMonths(current);
    if (months.length === 0) break;
    const beforeBytes = estimate(current);
    const next = dropOldestMonths(current, 3);
    if (next === current || Object.keys(next).length === Object.keys(current).length) break;
    const afterBytes = estimate(next);
    used = Math.max(0, used - (beforeBytes - afterBytes));
    current = next;
  }
  return current;
}

/** True when two day maps share the same keys (entries assumed unchanged). */
export function sameDayKeys(
  a: Record<DateKey, FoodEntry[]>,
  b: Record<DateKey, FoodEntry[]>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => key in b);
}
