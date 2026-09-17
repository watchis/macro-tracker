import { isLegacyStarterName } from '../data/starterFoodLibrary';
import { isDataRetentionPolicy } from '../lib/retention';
import { isDateKey } from '../lib/dates';
import { createId } from '../lib/id';
import { normalizeMacros, sortMacros } from '../lib/macros';
import { normalizeHex } from '../theme/color';
import { DEFAULT_SETTINGS, STORE_VERSION, defaultPersistedState } from './defaults';
import type {
  DataRetentionPolicy,
  DateKey,
  FoodEntry,
  FoodLibraryItem,
  Goals,
  MacroKey,
  PersistedState,
  Settings,
  ThemeMode,
  WeekStart,
} from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function parseEntry(value: unknown): FoodEntry | null {
  if (!isRecord(value)) return null;
  const name = str(value.name, '').trim();
  if (name === '') return null;
  return {
    id: str(value.id, createId()),
    name,
    grams: num(value.grams, 0),
    calories: num(value.calories, 0),
    macros: normalizeMacros(isRecord(value.macros) ? (value.macros as never) : undefined),
    createdAt: str(value.createdAt, new Date(0).toISOString()),
  };
}

function parseDays(value: unknown): Record<DateKey, FoodEntry[]> {
  const days: Record<DateKey, FoodEntry[]> = {};
  if (!isRecord(value)) return days;
  for (const [key, rawEntries] of Object.entries(value)) {
    if (!isDateKey(key) || !Array.isArray(rawEntries)) continue;
    const entries = rawEntries
      .map(parseEntry)
      .filter((entry): entry is FoodEntry => entry !== null);
    if (entries.length > 0) days[key] = entries;
  }
  return days;
}

function parseLibrary(value: unknown): FoodLibraryItem[] {
  if (!Array.isArray(value)) return [];
  const items: FoodLibraryItem[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const name = str(raw.name, '').trim();
    if (name === '') continue;
    // Drop the original five seeded defaults so they do not duplicate the
    // bundled USDA catalog after upgrade. True custom foods are kept.
    if (isLegacyStarterName(name)) continue;
    const grams = num(raw.grams, 100);
    items.push({
      name,
      grams: grams > 0 ? grams : 100,
      calories: num(raw.calories, 0),
      macros: normalizeMacros(isRecord(raw.macros) ? (raw.macros as never) : undefined),
    });
  }
  return items;
}

function parseGoals(value: unknown): Goals {
  if (!isRecord(value)) {
    return {
      calories: DEFAULT_SETTINGS.goals.calories,
      macros: { ...DEFAULT_SETTINGS.goals.macros },
    };
  }
  const macros = normalizeMacros(isRecord(value.macros) ? (value.macros as never) : undefined);
  return {
    calories: Math.max(0, num(value.calories, DEFAULT_SETTINGS.goals.calories)),
    macros,
  };
}

function parseThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : DEFAULT_SETTINGS.themeMode;
}

function parseWeekStart(value: unknown): WeekStart {
  return value === 'monday' || value === 'sunday' ? value : DEFAULT_SETTINGS.weekStart;
}

function parseDataRetention(value: unknown): DataRetentionPolicy {
  return isDataRetentionPolicy(value) ? value : DEFAULT_SETTINGS.dataRetention;
}

function parseVisibleMacros(value: unknown): MacroKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_SETTINGS.visibleMacros];
  const sorted = sortMacros(value as MacroKey[]);
  return sorted.length > 0 ? sorted : [...DEFAULT_SETTINGS.visibleMacros];
}

export function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_SETTINGS,
      visibleMacros: [...DEFAULT_SETTINGS.visibleMacros],
      goals: parseGoals(undefined),
    };
  }
  return {
    themeMode: parseThemeMode(value.themeMode),
    accent: normalizeHex(value.accent) ?? DEFAULT_SETTINGS.accent,
    visibleMacros: parseVisibleMacros(value.visibleMacros),
    goals: parseGoals(value.goals),
    weekStart: parseWeekStart(value.weekStart),
    dataRetention: parseDataRetention(value.dataRetention),
  };
}

/**
 * Coerces anything (rehydrated localStorage, an imported JSON file, a future
 * version written by a newer build) into a valid `PersistedState`. Unknown
 * fields are dropped and invalid ones fall back to defaults rather than
 * throwing, so a corrupt payload can never brick the app.
 */
export function parsePersistedState(value: unknown): PersistedState {
  if (!isRecord(value)) return defaultPersistedState();
  return {
    version: STORE_VERSION,
    days: parseDays(value.days),
    foodLibrary: parseLibrary(value.foodLibrary),
    settings: parseSettings(value.settings),
  };
}

/**
 * zustand persist migration hook. Every stored version funnels through
 * `parsePersistedState`; add explicit per-version steps here as the shape
 * evolves (e.g. `if (fromVersion < 2) { ... }`) before the final parse.
 */
export function migratePersistedState(persisted: unknown, fromVersion: number): PersistedState {
  void fromVersion;
  return parsePersistedState(persisted);
}
