import { describe, expect, it } from 'vitest';
import { mergePersistedState, resetAppStore, useAppStore } from './useAppStore';
import { DEFAULT_ACCENT, STORAGE_KEY, STORE_VERSION, defaultPersistedState } from './defaults';
import { LOCAL_STORAGE_QUOTA_BYTES } from '../lib/storage';
import { parsePersistedState } from './migrate';
import { sumEntries } from '../lib/totals';
import type { PersistedState } from '../types';

const DATE = '2026-09-17';

function store() {
  return useAppStore.getState();
}

function fillStorageTo(bytes: number, key = 'pad'): void {
  // UTF-16 accounting: each character is 2 bytes, plus the key itself.
  const payloadChars = Math.max(0, Math.ceil((bytes - key.length * 2) / 2));
  localStorage.setItem(key, 'x'.repeat(payloadChars));
}

function readStorage(): { state: PersistedState; version: number } {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error(`Nothing persisted under ${STORAGE_KEY}`);
  return JSON.parse(raw) as { state: PersistedState; version: number };
}

describe('defaults', () => {
  it('starts with no logged days, no custom foods, and sensible settings', () => {
    const state = store();
    expect(state.version).toBe(STORE_VERSION);
    expect(state.days).toEqual({});
    expect(state.foodLibrary).toEqual([]);
    expect(state.foodFavorites).toEqual([]);
    expect(state.settings.themeMode).toBe('system');
    expect(state.settings.accent).toBe(DEFAULT_ACCENT);
    expect(state.settings.visibleMacros).toEqual(['protein', 'carbs', 'fat']);
    expect(state.settings.goals.calories).toBe(2000);
    expect(state.settings.weekStart).toBe('sunday');
    expect(state.settings.autoOptimizeThreshold).toBe(90);
    expect(state.settings.weightUnit).toBe('lb');
    expect(state.weights).toEqual({});
    expect(state.view).toBe('home');
  });
});

describe('day entries', () => {
  it('adds, updates and removes entries for a day', () => {
    const id = store().addEntry(DATE, {
      name: '  Oats  ',
      grams: 80,
      calories: 303,
      macros: { protein: 10.4, carbs: 54.4, sodium: undefined },
    });

    const added = store().days[DATE]?.[0];
    expect(added?.id).toBe(id);
    expect(added?.name).toBe('Oats');
    expect(added?.macros).toEqual({ protein: 10.4, carbs: 54.4 });
    expect(added?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    store().updateEntry(DATE, id, { grams: 100, calories: 379 });
    expect(store().days[DATE]?.[0]?.calories).toBe(379);
    expect(store().days[DATE]?.[0]?.macros).toEqual({ protein: 10.4, carbs: 54.4 });

    store().removeEntry(DATE, id);
    expect(store().days[DATE]).toBeUndefined();
  });

  it('keeps entries in insertion order and drops the day once emptied', () => {
    store().addEntry(DATE, { name: 'First', grams: 10, calories: 10, macros: {} });
    store().addEntry(DATE, { name: 'Second', grams: 20, calories: 20, macros: {} });
    expect(store().days[DATE]?.map((entry) => entry.name)).toEqual(['First', 'Second']);

    store().clearDay(DATE);
    expect(DATE in store().days).toBe(false);
  });

  it('ignores updates and removals for unknown days and ids', () => {
    const before = store().days;
    store().updateEntry(DATE, 'missing', { calories: 1 });
    store().removeEntry('2020-01-01', 'missing');
    expect(store().days).toEqual(before);
  });

  it('feeds the day-total math', () => {
    store().addEntry(DATE, { name: 'A', grams: 100, calories: 200, macros: { protein: 20 } });
    store().addEntry(DATE, {
      name: 'B',
      grams: 100,
      calories: 300,
      macros: { protein: 5, fat: 12 },
    });

    const totals = sumEntries(store().days[DATE]);
    expect(totals.calories).toBe(500);
    expect(totals.macros.protein).toBe(25);
    expect(totals.macros.fat).toBe(12);
  });
});

describe('food library', () => {
  it('adds, updates and removes foods by index', () => {
    resetAppStore();
    const initial = store().foodLibrary.length;

    store().addFood({ name: ' Tofu ', grams: 100, calories: 76, macros: { protein: 8 } });
    const index = store().foodLibrary.length - 1;
    expect(store().foodLibrary[index]?.name).toBe('Tofu');

    store().updateFood(index, { calories: 80 });
    expect(store().foodLibrary[index]?.calories).toBe(80);
    expect(store().foodLibrary[index]?.name).toBe('Tofu');

    store().removeFood(index);
    expect(store().foodLibrary).toHaveLength(initial);
  });

  it('falls back to a 100 g reference for a non-positive weight', () => {
    store().addFood({ name: 'Broth', grams: 0, calories: 10, macros: {} });
    expect(store().foodLibrary.at(-1)?.grams).toBe(100);
  });

  it('ignores an out-of-range index', () => {
    const before = store().foodLibrary;
    store().updateFood(99, { name: 'Nope' });
    expect(store().foodLibrary).toEqual(before);
  });

  it('manually stars and unstars foods without auto-favoriting customs', () => {
    resetAppStore();
    store().addFood({ name: 'Tofu', grams: 100, calories: 76, macros: { protein: 8 } });
    expect(store().foodFavorites).toEqual([]);

    store().toggleFoodFavorite('custom', store().foodLibrary[0]!);
    expect(store().foodFavorites).toEqual([
      expect.objectContaining({ source: 'custom', name: 'Tofu', calories: 76 }),
    ]);

    store().toggleFoodFavorite('starter', {
      name: 'Banana',
      grams: 100,
      calories: 89,
      macros: { carbs: 23 },
    });
    expect(store().foodFavorites).toHaveLength(2);

    store().updateFood(0, { name: 'Firm tofu', calories: 80 });
    expect(store().foodFavorites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'custom', name: 'Firm tofu', calories: 80 }),
        expect.objectContaining({ source: 'starter', name: 'Banana' }),
      ]),
    );

    store().removeFood(0);
    expect(store().foodFavorites).toEqual([
      expect.objectContaining({ source: 'starter', name: 'Banana' }),
    ]);

    store().toggleFoodFavorite('starter', {
      name: 'Banana',
      grams: 100,
      calories: 89,
      macros: { carbs: 23 },
    });
    expect(store().foodFavorites).toEqual([]);
  });
});

describe('settings', () => {
  it('updates theme mode, week start and goals', () => {
    store().setThemeMode('dark');
    store().setWeekStart('monday');
    store().setCalorieGoal(1800);
    store().setMacroGoal('fiber', 30);

    expect(store().settings.themeMode).toBe('dark');
    expect(store().settings.weekStart).toBe('monday');
    expect(store().settings.goals.calories).toBe(1800);
    expect(store().settings.goals.macros.fiber).toBe(30);

    store().setMacroGoal('fiber', undefined);
    expect('fiber' in store().settings.goals.macros).toBe(false);
  });

  it('saves a projection profile and rejects out-of-range values', () => {
    store().setProjectionProfile({
      sex: 'female',
      birthday: '1984-03-15',
      heightCm: 170,
      activity: 1.55,
    });
    expect(store().settings.projection).toEqual({
      sex: 'female',
      birthday: '1984-03-15',
      heightCm: 170,
      activity: 1.55,
      startMode: 'weight',
      endMode: '52',
      startDate: null,
      endDate: null,
      startWeightKg: null,
      goalWeightKg: null,
    });

    store().setProjectionProfile({
      birthday: '1800-01-01',
      heightCm: 10,
      activity: 3 as never,
    });
    expect(store().settings.projection.birthday).toBeNull();
    expect(store().settings.projection.heightCm).toBeNull();
    expect(store().settings.projection.activity).toBe(1.55);
  });

  it('persists projection start and end horizon settings', () => {
    store().setProjectionProfile({
      startMode: 'date',
      endMode: 'goal',
      startDate: '2026-09-01',
      endDate: '2027-09-01',
      startWeightKg: 90,
      goalWeightKg: 80,
    });
    expect(store().settings.projection).toMatchObject({
      startMode: 'date',
      endMode: 'goal',
      startDate: '2026-09-01',
      endDate: '2027-09-01',
      startWeightKg: 90,
      goalWeightKg: 80,
    });

    store().setProjectionProfile({
      startMode: 'nope' as never,
      endMode: 'forever' as never,
      startDate: 'not-a-date',
      startWeightKg: -5,
      goalWeightKg: 9999,
    });
    expect(store().settings.projection.startMode).toBe('date');
    expect(store().settings.projection.endMode).toBe('goal');
    expect(store().settings.projection.startDate).toBe('2026-09-01');
    expect(store().settings.projection.startWeightKg).toBeNull();
    expect(store().settings.projection.goalWeightKg).toBeNull();
  });

  it('clamps a negative calorie goal to zero', () => {
    store().setCalorieGoal(-500);
    expect(store().settings.goals.calories).toBe(0);
  });

  it('normalizes accepted accents and ignores unparsable ones', () => {
    store().setAccent('#ABC');
    expect(store().settings.accent).toBe('#aabbcc');

    store().setAccent('not-a-color');
    expect(store().settings.accent).toBe('#aabbcc');
  });

  it('keeps visible macros in canonical order when toggling', () => {
    store().setVisibleMacros(['sodium', 'protein']);
    expect(store().settings.visibleMacros).toEqual(['protein', 'sodium']);

    store().toggleMacro('carbs');
    expect(store().settings.visibleMacros).toEqual(['protein', 'carbs', 'sodium']);

    store().toggleMacro('protein');
    expect(store().settings.visibleMacros).toEqual(['carbs', 'sodium']);
  });

  it('applies auto-optimize when usage crosses the threshold', () => {
    store().addEntry('2025-01-10', { name: 'Old', grams: 10, calories: 10, macros: {} });
    store().addEntry(DATE, { name: 'New', grams: 10, calories: 10, macros: {} });
    fillStorageTo(Math.floor(LOCAL_STORAGE_QUOTA_BYTES * 0.95));

    store().setAutoOptimizeThreshold(90);

    expect(store().settings.autoOptimizeThreshold).toBe(90);
    expect(store().days['2025-01-10']).toBeUndefined();
    expect(store().days[DATE]?.[0]?.name).toBe('New');
  });

  it('can disable auto-optimize', () => {
    store().setAutoOptimizeThreshold(null);
    expect(store().settings.autoOptimizeThreshold).toBeNull();
  });
});

describe('navigation', () => {
  it('opens a day and switches view', () => {
    store().openDay('2026-01-05');
    expect(store().view).toBe('day');
    expect(store().selectedDate).toBe('2026-01-05');

    store().setView('settings');
    expect(store().view).toBe('settings');
    expect(store().selectedDate).toBe('2026-01-05');
  });
});

describe('persistence', () => {
  it('writes only the persisted shape under the versioned key', () => {
    store().addEntry(DATE, { name: 'Rice', grams: 150, calories: 195, macros: { carbs: 42 } });
    store().setView('settings');

    const persisted = readStorage();
    expect(persisted.version).toBe(STORE_VERSION);
    expect(Object.keys(persisted.state).sort()).toEqual([
      'days',
      'foodFavorites',
      'foodLibrary',
      'settings',
      'version',
      'weights',
    ]);
    expect(persisted.state.days[DATE]?.[0]?.name).toBe('Rice');
  });
});

describe('body weight', () => {
  it('stores weigh-ins in kilograms and converts from the display unit', () => {
    store().setWeightUnit('lb');
    store().setWeight(DATE, 180, 'lb');

    expect(store().weights[DATE]).toBeCloseTo(81.6466, 3);

    store().setWeightUnit('kg');
    expect(store().settings.weightUnit).toBe('kg');

    store().setWeight(DATE, null);
    expect(store().weights[DATE]).toBeUndefined();
  });

  it('prunes old weigh-ins when auto-optimize runs', () => {
    store().setWeight('2025-01-10', 80, 'kg');
    store().setWeight(DATE, 81, 'kg');
    fillStorageTo(Math.floor(LOCAL_STORAGE_QUOTA_BYTES * 0.95));
    store().setAutoOptimizeThreshold(90);

    expect(store().weights['2025-01-10']).toBeUndefined();
    expect(store().weights[DATE]).toBe(81);
  });
});

describe('export, import and reset', () => {
  it('exports the persisted state as pretty JSON', () => {
    store().addEntry(DATE, { name: 'Egg', grams: 50, calories: 72, macros: { protein: 6.3 } });

    const json = store().exportJson();
    expect(json).toContain('\n  ');

    const parsed = JSON.parse(json) as PersistedState;
    expect(parsed.version).toBe(STORE_VERSION);
    expect(parsed.days[DATE]?.[0]?.name).toBe('Egg');
    expect(parsed.settings.accent).toBe(DEFAULT_ACCENT);
    expect('view' in parsed).toBe(false);
  });

  it('round-trips an export through import', () => {
    store().addEntry(DATE, { name: 'Egg', grams: 50, calories: 72, macros: { protein: 6.3 } });
    store().setAccent('#ff0000');
    const json = store().exportJson();

    resetAppStore();
    expect(store().days).toEqual({});

    expect(store().importJson(json)).toEqual({ ok: true });
    expect(store().days[DATE]?.[0]?.name).toBe('Egg');
    expect(store().settings.accent).toBe('#ff0000');
  });

  it('rejects malformed payloads without touching state', () => {
    store().addEntry(DATE, { name: 'Egg', grams: 50, calories: 72, macros: {} });
    const before = store().days;

    expect(store().importJson('{ nope')).toEqual({
      ok: false,
      error: 'That file is not valid JSON.',
    });
    expect(store().importJson('[1,2,3]')).toEqual({
      ok: false,
      error: 'Expected a Macro Tracker export object.',
    });
    expect(store().days).toEqual(before);
  });

  it('keeps unknown fields out and repairs partial imports', () => {
    const result = store().importJson(
      JSON.stringify({
        version: 99,
        days: { '2026-09-17': [{ name: 'Mystery', calories: '150', macros: { protein: 'x' } }] },
        foodLibrary: 'not an array',
        settings: { themeMode: 'neon', accent: 'zzz', visibleMacros: ['protein', 'bogus'] },
        somethingElse: true,
      }),
    );

    expect(result).toEqual({ ok: true });
    const state = store();
    expect(state.version).toBe(STORE_VERSION);
    expect(state.days['2026-09-17']?.[0]).toMatchObject({
      name: 'Mystery',
      calories: 150,
      macros: {},
    });
    expect(state.foodLibrary).toEqual([]);
    expect(state.foodFavorites).toEqual([]);
    expect(state.settings.themeMode).toBe('system');
    expect(state.settings.accent).toBe(DEFAULT_ACCENT);
    expect(state.settings.visibleMacros).toEqual(['protein']);
    expect('somethingElse' in state).toBe(false);
  });

  it('optimizes storage by dropping oldest months while keeping settings', () => {
    store().addEntry('2025-01-10', { name: 'Old', grams: 100, calories: 100, macros: {} });
    store().addEntry('2025-02-10', { name: 'Mid', grams: 100, calories: 100, macros: {} });
    store().addEntry(DATE, { name: 'New', grams: 100, calories: 100, macros: {} });
    store().setThemeMode('dark');
    store().setCalorieGoal(1234);
    store().addFood({ name: 'Tofu', grams: 100, calories: 76, macros: { protein: 8 } });
    store().toggleFoodFavorite('custom', store().foodLibrary[0]!);

    // Force the optimizer past the 70% target without relying on tiny fixture JSON.
    fillStorageTo(Math.floor(LOCAL_STORAGE_QUOTA_BYTES * 0.85));

    const result = store().optimizeStorage();

    expect(result.monthsDropped).toBeGreaterThan(0);
    expect(store().days['2025-01-10']).toBeUndefined();
    expect(store().days[DATE]?.[0]?.name).toBe('New');
    expect(store().settings.themeMode).toBe('dark');
    expect(store().settings.goals.calories).toBe(1234);
    expect(store().foodLibrary).toHaveLength(1);
    expect(store().foodFavorites).toHaveLength(1);
  });

  it('reports nothing to free when usage is already under the target', () => {
    store().addEntry(DATE, { name: 'Egg', grams: 50, calories: 72, macros: {} });
    const before = store().days;

    expect(store().optimizeStorage()).toEqual({ freedBytes: 0, monthsDropped: 0 });
    expect(store().days).toEqual(before);
  });
});

describe('parsePersistedState', () => {
  it('falls back to defaults for junk input', () => {
    for (const input of [null, undefined, 'string', 42, []]) {
      expect(parsePersistedState(input)).toEqual(defaultPersistedState());
    }
  });

  it('drops days with invalid keys or nameless entries', () => {
    const parsed = parsePersistedState({
      days: {
        'not-a-date': [{ name: 'Nope', calories: 10 }],
        '2026-09-17': [
          { name: '', calories: 10 },
          { name: 'Keep', calories: 20 },
        ],
      },
    });

    expect(parsed.days['not-a-date']).toBeUndefined();
    expect(parsed.days['2026-09-17']).toHaveLength(1);
    expect(parsed.days['2026-09-17']?.[0]?.name).toBe('Keep');
    expect(parsed.days['2026-09-17']?.[0]?.id).toBeTruthy();
  });
});

describe('mergePersistedState', () => {
  // persist only calls `migrate` when the stored version differs, so this is the
  // only thing standing between a corrupt same-version payload and the render.
  it('re-parses a payload that would otherwise rehydrate as-is', () => {
    const merged = mergePersistedState(
      { version: STORE_VERSION, days: 'nope', foodLibrary: 'nope', settings: 42 },
      store(),
    );

    expect(merged.days).toEqual({});
    expect(merged.foodLibrary).toEqual([]);
    expect(merged.foodFavorites).toEqual([]);
    expect(merged.settings).toEqual(defaultPersistedState().settings);
  });

  it('drops junk entries and invalid settings but keeps what is usable', () => {
    const merged = mergePersistedState(
      {
        version: STORE_VERSION,
        days: { [DATE]: [{ name: 'Real food', grams: 100, calories: 200 }, 'junk', null] },
        foodLibrary: [{ name: 'Oats', grams: 100, calories: 379 }, 'junk'],
        settings: {
          themeMode: 'sideways',
          accent: 'not-a-hex',
          visibleMacros: ['protein', 'bogus'],
          goals: { calories: 'lots' },
          weekStart: 'friday',
        },
      },
      store(),
    );

    expect(merged.days[DATE]).toHaveLength(1);
    expect(merged.days[DATE]?.[0]?.name).toBe('Real food');
    expect(merged.foodLibrary).toHaveLength(1);
    expect(merged.settings.themeMode).toBe('system');
    expect(merged.settings.accent).toBe(DEFAULT_ACCENT);
    expect(merged.settings.visibleMacros).toEqual(['protein']);
    expect(merged.settings.goals.calories).toBe(2000);
    expect(merged.settings.weekStart).toBe('sunday');
    expect(merged.settings.autoOptimizeThreshold).toBe(90);
  });

  it('strips the old five-item seed from persisted customs', () => {
    const merged = mergePersistedState(
      {
        version: STORE_VERSION,
        days: {},
        foodLibrary: [
          { name: 'Chicken breast', grams: 100, calories: 165, macros: {} },
          { name: 'My shake', grams: 300, calories: 250, macros: { protein: 30 } },
          { name: 'Whole egg', grams: 100, calories: 143, macros: {} },
        ],
        settings: defaultPersistedState().settings,
      },
      store(),
    );

    expect(merged.foodLibrary).toEqual([
      { name: 'My shake', grams: 300, calories: 250, macros: { protein: 30 } },
    ]);
  });

  it('leaves transient UI state alone', () => {
    const current = store();
    const merged = mergePersistedState({ version: STORE_VERSION }, current);

    expect(merged.view).toBe(current.view);
    expect(merged.selectedDate).toBe(current.selectedDate);
    expect(typeof merged.addEntry).toBe('function');
  });
});
