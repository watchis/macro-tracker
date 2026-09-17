import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { todayKey } from '../lib/dates';
import { createId } from '../lib/id';
import { normalizeMacros, sortMacros } from '../lib/macros';
import { normalizeHex } from '../theme/color';
import { STORAGE_KEY, STORE_VERSION, defaultPersistedState } from './defaults';
import { migratePersistedState, parsePersistedState } from './migrate';
import type {
  DateKey,
  FoodEntry,
  FoodEntryInput,
  FoodLibraryItem,
  MacroKey,
  PersistedState,
  Settings,
  ThemeMode,
  ViewName,
  WeekStart,
} from '../types';

/** Transient UI state. Deliberately excluded from persistence. */
export type UiState = {
  view: ViewName;
  /** The day the day view shows and the calendar highlights as selected. */
  selectedDate: DateKey;
};

export type AppActions = {
  // --- navigation -----------------------------------------------------------
  setView: (view: ViewName) => void;
  setSelectedDate: (date: DateKey) => void;
  /** Selects a day and switches to the day view; the calendar's cell click handler. */
  openDay: (date: DateKey) => void;

  // --- day entries ---------------------------------------------------------
  /** Appends an entry to `date` and returns its generated id. */
  addEntry: (date: DateKey, input: FoodEntryInput) => string;
  updateEntry: (date: DateKey, id: string, patch: Partial<FoodEntryInput>) => void;
  removeEntry: (date: DateKey, id: string) => void;
  clearDay: (date: DateKey) => void;

  // --- food library --------------------------------------------------------
  /** Library items have no id (see `PersistedState`), so edits address them by index. */
  addFood: (item: FoodLibraryItem) => void;
  updateFood: (index: number, patch: Partial<FoodLibraryItem>) => void;
  removeFood: (index: number) => void;

  // --- settings ------------------------------------------------------------
  updateSettings: (patch: Partial<Settings>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  /** Ignores unparsable hex values so a half-typed input can't blank the accent. */
  setAccent: (hex: string) => void;
  setVisibleMacros: (macros: readonly MacroKey[]) => void;
  toggleMacro: (macro: MacroKey) => void;
  setCalorieGoal: (calories: number) => void;
  /** Pass `undefined` to clear a macro goal. */
  setMacroGoal: (macro: MacroKey, value: number | undefined) => void;
  setWeekStart: (weekStart: WeekStart) => void;

  // --- data management -----------------------------------------------------
  /** Pretty-printed `PersistedState` JSON, ready for a download. */
  exportJson: () => string;
  importJson: (raw: string) => { ok: true } | { ok: false; error: string };
  /** Wipes days, library and settings back to defaults. Keeps UI state. */
  resetAll: () => void;
};

export type AppStore = PersistedState & UiState & AppActions;

function initialUiState(): UiState {
  return { view: 'calendar', selectedDate: todayKey() };
}

function sanitizeEntryInput(input: FoodEntryInput): FoodEntryInput {
  return {
    name: input.name.trim(),
    grams: Number.isFinite(input.grams) ? input.grams : 0,
    calories: Number.isFinite(input.calories) ? input.calories : 0,
    macros: normalizeMacros(input.macros),
  };
}

/** Drops days whose entry list is empty so exports and storage stay tidy. */
function withDay(
  days: Record<DateKey, FoodEntry[]>,
  date: DateKey,
  entries: FoodEntry[],
): Record<DateKey, FoodEntry[]> {
  const next = { ...days };
  if (entries.length === 0) {
    delete next[date];
  } else {
    next[date] = entries;
  }
  return next;
}

/**
 * Every rehydrated payload is re-parsed, not only the ones a version bump sends
 * through `migrate`: persist skips that hook when the stored version already
 * matches, so a hand-edited or half-written payload would otherwise land in the
 * store as-is and crash the first render.
 */
export function mergePersistedState(persisted: unknown, current: AppStore): AppStore {
  return { ...current, ...parsePersistedState(persisted) };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...defaultPersistedState(),
      ...initialUiState(),

      setView: (view) => set({ view }),
      setSelectedDate: (selectedDate) => set({ selectedDate }),
      openDay: (date) => set({ selectedDate: date, view: 'day' }),

      addEntry: (date, input) => {
        const entry: FoodEntry = {
          id: createId(),
          createdAt: new Date().toISOString(),
          ...sanitizeEntryInput(input),
        };
        set((state) => ({ days: withDay(state.days, date, [...(state.days[date] ?? []), entry]) }));
        return entry.id;
      },

      updateEntry: (date, id, patch) =>
        set((state) => {
          const entries = state.days[date];
          if (!entries) return state;
          const next = entries.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  ...sanitizeEntryInput({
                    name: patch.name ?? entry.name,
                    grams: patch.grams ?? entry.grams,
                    calories: patch.calories ?? entry.calories,
                    macros: patch.macros ?? entry.macros,
                  }),
                }
              : entry,
          );
          return { days: withDay(state.days, date, next) };
        }),

      removeEntry: (date, id) =>
        set((state) => {
          const entries = state.days[date];
          if (!entries) return state;
          return {
            days: withDay(
              state.days,
              date,
              entries.filter((entry) => entry.id !== id),
            ),
          };
        }),

      clearDay: (date) => set((state) => ({ days: withDay(state.days, date, []) })),

      addFood: (item) =>
        set((state) => ({
          foodLibrary: [
            ...state.foodLibrary,
            {
              name: item.name.trim(),
              grams: item.grams > 0 ? item.grams : 100,
              calories: Number.isFinite(item.calories) ? item.calories : 0,
              macros: normalizeMacros(item.macros),
            },
          ],
        })),

      updateFood: (index, patch) =>
        set((state) => {
          const existing = state.foodLibrary[index];
          if (!existing) return state;
          const merged: FoodLibraryItem = { ...existing, ...patch };
          const next = [...state.foodLibrary];
          next[index] = {
            name: merged.name.trim(),
            grams: merged.grams > 0 ? merged.grams : 100,
            calories: Number.isFinite(merged.calories) ? merged.calories : 0,
            macros: normalizeMacros(merged.macros),
          };
          return { foodLibrary: next };
        }),

      removeFood: (index) =>
        set((state) => ({ foodLibrary: state.foodLibrary.filter((_, i) => i !== index) })),

      updateSettings: (patch) =>
        set((state) => {
          const merged: Settings = { ...state.settings, ...patch };
          return {
            settings: {
              ...merged,
              accent: normalizeHex(merged.accent) ?? state.settings.accent,
              visibleMacros: sortMacros(merged.visibleMacros),
              goals: {
                calories: Math.max(0, merged.goals.calories),
                macros: normalizeMacros(merged.goals.macros),
              },
            },
          };
        }),

      setThemeMode: (themeMode) => get().updateSettings({ themeMode }),

      setAccent: (hex) => {
        const accent = normalizeHex(hex);
        if (accent) get().updateSettings({ accent });
      },

      setVisibleMacros: (macros) => get().updateSettings({ visibleMacros: sortMacros(macros) }),

      toggleMacro: (macro) => {
        const current = get().settings.visibleMacros;
        const next = current.includes(macro)
          ? current.filter((key) => key !== macro)
          : [...current, macro];
        get().updateSettings({ visibleMacros: sortMacros(next) });
      },

      setCalorieGoal: (calories) =>
        set((state) => ({
          settings: {
            ...state.settings,
            goals: {
              ...state.settings.goals,
              calories: Number.isFinite(calories) ? Math.max(0, calories) : 0,
            },
          },
        })),

      setMacroGoal: (macro, value) =>
        set((state) => {
          const macros = { ...state.settings.goals.macros };
          if (value === undefined || !Number.isFinite(value)) {
            delete macros[macro];
          } else {
            macros[macro] = Math.max(0, value);
          }
          return { settings: { ...state.settings, goals: { ...state.settings.goals, macros } } };
        }),

      setWeekStart: (weekStart) => get().updateSettings({ weekStart }),

      exportJson: () => {
        const { version, days, foodLibrary, settings } = get();
        const snapshot: PersistedState = { version, days, foodLibrary, settings };
        return JSON.stringify(snapshot, null, 2);
      },

      importJson: (raw) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return { ok: false, error: 'That file is not valid JSON.' };
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return { ok: false, error: 'Expected a Macro Tracker export object.' };
        }
        const state = parsePersistedState(parsed);
        set({
          version: state.version,
          days: state.days,
          foodLibrary: state.foodLibrary,
          settings: state.settings,
        });
        return { ok: true };
      },

      resetAll: () => set({ ...defaultPersistedState() }),
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: migratePersistedState,
      merge: mergePersistedState,
      partialize: (state): PersistedState => ({
        version: state.version,
        days: state.days,
        foodLibrary: state.foodLibrary,
        settings: state.settings,
      }),
    },
  ),
);

/** Fresh default state, for tests and the reset flow. */
export function resetAppStore(): void {
  useAppStore.setState({ ...defaultPersistedState(), ...initialUiState() });
}
