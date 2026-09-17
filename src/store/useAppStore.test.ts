import { describe, expect, it } from 'vitest';
import { mergePersistedState, useAppStore } from './useAppStore';
import { DEFAULT_ACCENT, STORAGE_KEY, STORE_VERSION, defaultPersistedState } from './defaults';
import { parsePersistedState } from './migrate';
import { sumEntries } from '../lib/totals';
import type { PersistedState } from '../types';

const DATE = '2026-09-17';

function store() {
  return useAppStore.getState();
}

function readStorage(): { state: PersistedState; version: number } {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error(`Nothing persisted under ${STORAGE_KEY}`);
  return JSON.parse(raw) as { state: PersistedState; version: number };
}

describe('defaults', () => {
  it('starts with no logged days and sensible settings', () => {
    const state = store();
    expect(state.version).toBe(STORE_VERSION);
    expect(state.days).toEqual({});
    expect(state.foodLibrary.length).toBeGreaterThan(0);
    expect(state.settings.themeMode).toBe('system');
    expect(state.settings.accent).toBe(DEFAULT_ACCENT);
    expect(state.settings.visibleMacros).toEqual(['protein', 'carbs', 'fat']);
    expect(state.settings.goals.calories).toBe(2000);
    expect(state.settings.weekStart).toBe('sunday');
    expect(state.view).toBe('calendar');
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
    store().resetAll();
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
      'foodLibrary',
      'settings',
      'version',
    ]);
    expect(persisted.state.days[DATE]?.[0]?.name).toBe('Rice');
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

    store().resetAll();
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
    expect(state.settings.themeMode).toBe('system');
    expect(state.settings.accent).toBe(DEFAULT_ACCENT);
    expect(state.settings.visibleMacros).toEqual(['protein']);
    expect('somethingElse' in state).toBe(false);
  });

  it('resets days, library and settings back to defaults', () => {
    store().addEntry(DATE, { name: 'Egg', grams: 50, calories: 72, macros: {} });
    store().setThemeMode('dark');
    store().removeFood(0);

    store().resetAll();

    const defaults = defaultPersistedState();
    expect(store().days).toEqual({});
    expect(store().foodLibrary).toEqual(defaults.foodLibrary);
    expect(store().settings).toEqual(defaults.settings);
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
  });

  it('leaves transient UI state alone', () => {
    const current = store();
    const merged = mergePersistedState({ version: STORE_VERSION }, current);

    expect(merged.view).toBe(current.view);
    expect(merged.selectedDate).toBe(current.selectedDate);
    expect(typeof merged.addEntry).toBe('function');
  });
});
