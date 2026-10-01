import type { DateKey, MonthKey, WeekStart } from '../types';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function isDateKey(value: unknown): value is DateKey {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value);
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && MONTH_KEY_PATTERN.test(value);
}

/** Local-time `YYYY-MM-DD` for a `Date`. */
export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses `YYYY-MM-DD` into a local-midnight `Date`. */
export function fromDateKey(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((fromDateKey(to).getTime() - fromDateKey(from).getTime()) / 86_400_000);
}

export function monthKeyOf(key: DateKey): MonthKey {
  return key.slice(0, 7);
}

/** Shifts a `YYYY-MM` month key, clamping nothing since months have no day part. */
export function addMonths(key: MonthKey, months: number): MonthKey {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1 + months, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function daysInMonth(key: MonthKey): number {
  const [year, month] = key.split('-').map(Number);
  return new Date(year ?? 1970, month ?? 1, 0).getDate();
}

/** Every `YYYY-MM-DD` in a month, in order. */
export function monthDateKeys(key: MonthKey): DateKey[] {
  const total = daysInMonth(key);
  return Array.from({ length: total }, (_, index) => `${key}-${pad(index + 1)}`);
}

/**
 * A calendar grid of whole weeks covering `month`, padded with the trailing days
 * of the previous month and the leading days of the next one.
 */
export function buildMonthGrid(month: MonthKey, weekStart: WeekStart): DateKey[] {
  const first = fromDateKey(`${month}-01`);
  const offset = weekStart === 'monday' ? (first.getDay() + 6) % 7 : first.getDay();
  const start = toDateKey(first);
  const total = Math.ceil((offset + daysInMonth(month)) / 7) * 7;
  return Array.from({ length: total }, (_, index) => addDays(start, index - offset));
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function weekdayLabels(weekStart: WeekStart): string[] {
  return weekStart === 'monday'
    ? [...WEEKDAY_LABELS.slice(1), WEEKDAY_LABELS[0]]
    : [...WEEKDAY_LABELS];
}

export function dayOfMonth(key: DateKey): number {
  return Number(key.slice(8, 10));
}

export function isSameMonth(key: DateKey, month: MonthKey): boolean {
  return monthKeyOf(key) === month;
}

export function isToday(key: DateKey, now: Date = new Date()): boolean {
  return key === toDateKey(now);
}

/**
 * Whole years of age on `on` (defaults to today), based on a birthday date key.
 * Returns `null` when the birthday is invalid or in the future relative to `on`.
 */
export function ageYearsFromBirthday(birthday: DateKey, on: Date = new Date()): number | null {
  if (!isDateKey(birthday)) return null;
  const birth = fromDateKey(birthday);
  const asOf = new Date(on.getFullYear(), on.getMonth(), on.getDate());
  if (birth > asOf) return null;

  let age = asOf.getFullYear() - birth.getFullYear();
  const monthDelta = asOf.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/** e.g. `Thursday, September 17, 2026`. */
export function formatLongDate(key: DateKey): string {
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** e.g. `Sep 17`. */
export function formatShortDate(key: DateKey): string {
  return fromDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** e.g. `September 2026`. */
export function formatMonthYear(month: MonthKey): string {
  return fromDateKey(`${month}-01`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}
