import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { addDays, formatLongDate, isToday, todayKey } from '../lib/dates';
import { MACROS, formatMacro, macroLabel, macroUnit } from '../lib/macros';
import { formatCalories, scaleFood } from '../lib/totals';
import { STARTER_FOOD_COUNT, queryStarterFoods } from '../data/starterCatalog';
import { useAppStore } from '../store/useAppStore';
import {
  useCustomFoods,
  useDayBudget,
  useDayEntries,
  useDayWeightKg,
  useSelectedDate,
  useVisibleMacros,
  useWeightUnit,
} from '../store/selectors';
import type { KeyboardEvent } from 'react';
import type {
  DateKey,
  FoodEntry,
  FoodEntryInput,
  FoodLibraryItem,
  MacroKey,
  WeightUnit,
} from '../types';
import { fromCanonicalKg, roundWeight, weightUnitLabel } from '../lib/weight';
import { SegmentedControl } from '../components/settings/SegmentedControl';
import type { SegmentedOption } from '../components/settings/SegmentedControl';
import { NumberField } from '../components/settings/NumberField';

type QuickAddOption = {
  key: string;
  food: FoodLibraryItem;
  source: 'custom' | 'starter';
};

export type DayViewProps = {
  /** Day to log against; defaults to the selected date. */
  date?: DateKey;
};

/** Form values stay strings so a half-typed number never becomes `NaN`. */
type Draft = {
  name: string;
  grams: string;
  calories: string;
  macros: Partial<Record<MacroKey, string>>;
};

const NAV_BUTTON =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-line bg-raised px-2 text-sm font-medium text-muted transition-colors hover:border-accent-border hover:bg-accent-soft hover:text-ink';
const PRIMARY_BUTTON =
  'inline-flex h-8 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong disabled:opacity-50';
const ROW_BUTTON =
  'rounded-md border border-line px-2 py-1 text-xs font-medium text-muted transition-colors hover:border-accent-border hover:bg-accent-soft hover:text-ink';
const DANGER_BUTTON =
  'rounded-md border border-line px-2 py-1 text-xs font-medium text-danger transition-colors hover:border-danger hover:bg-danger-soft';
const INPUT =
  'w-full min-w-0 rounded-md border border-line bg-bg px-2 py-1 text-sm text-ink placeholder:text-subtle';
const HEAD_CELL = 'px-2 py-2 text-left text-xs font-medium tracking-wide text-subtle uppercase';
const NUM_HEAD_CELL = `${HEAD_CELL} text-right`;
const CELL = 'px-2 py-1.5 align-middle';
const NUM_CELL = `${CELL} text-right tabular-nums`;

function emptyDraft(): Draft {
  return { name: '', grams: '', calories: '', macros: {} };
}

function draftFromEntry(entry: FoodEntry): Draft {
  const macros: Draft['macros'] = {};
  for (const { key } of MACROS) {
    const value = entry.macros[key];
    if (typeof value === 'number') macros[key] = String(value);
  }
  return {
    name: entry.name,
    grams: String(entry.grams),
    calories: String(entry.calories),
    macros,
  };
}

function parseNumber(value: string | undefined): number | undefined {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** `null` when the draft has no name, which is the only required field. */
function draftToInput(draft: Draft): FoodEntryInput | null {
  const name = draft.name.trim();
  if (name === '') return null;
  const macros: FoodEntryInput['macros'] = {};
  for (const { key } of MACROS) {
    const parsed = parseNumber(draft.macros[key]);
    if (parsed !== undefined) macros[key] = parsed;
  }
  return {
    name,
    grams: parseNumber(draft.grams) ?? 0,
    calories: parseNumber(draft.calories) ?? 0,
    macros,
  };
}

/**
 * Single-day food log: an editable table of entries with a column per visible
 * macro, day totals against the goals, and quick-add from the food library.
 */
export function DayView({ date }: DayViewProps) {
  const selectedDate = useSelectedDate();
  const day = date ?? selectedDate;
  const entries = useDayEntries(day);
  const visibleMacros = useVisibleMacros();
  const budget = useDayBudget(day);
  const addEntry = useAppStore((state) => state.addEntry);
  const updateEntry = useAppStore((state) => state.updateEntry);
  const removeEntry = useAppStore((state) => state.removeEntry);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const setView = useAppStore((state) => state.setView);
  const weightKg = useDayWeightKg(day);
  const weightUnit = useWeightUnit();
  const setWeight = useAppStore((state) => state.setWeight);
  const setWeightUnit = useAppStore((state) => state.setWeightUnit);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [addDraft, setAddDraft] = useState<Draft>(emptyDraft);

  const totals = budget.totals;
  const gramsTotal = useMemo(
    () => entries.reduce((sum, entry) => sum + (Number.isFinite(entry.grams) ? entry.grams : 0), 0),
    [entries],
  );
  const columnCount = 4 + visibleMacros.length;

  const startEdit = (entry: FoodEntry) => {
    setEditingId(entry.id);
    setEditDraft(draftFromEntry(entry));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyDraft());
  };

  const saveEdit = () => {
    const input = editingId ? draftToInput(editDraft) : null;
    if (!editingId || !input) return;
    updateEntry(day, editingId, input);
    cancelEdit();
  };

  const submitAdd = () => {
    const input = draftToInput(addDraft);
    if (!input) return;
    addEntry(day, input);
    setAddDraft(emptyDraft());
  };

  const goToDay = (next: DateKey) => {
    cancelEdit();
    setSelectedDate(next);
  };

  return (
    <section className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{formatLongDate(day)}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {totals.entryCount === 0
              ? 'Nothing logged yet.'
              : `${totals.entryCount} ${totals.entryCount === 1 ? 'entry' : 'entries'} · ${formatCalories(totals.calories)} kcal`}
            {isToday(day) ? ' · today' : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => goToDay(addDays(day, -1))}
            className={NAV_BUTTON}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" onClick={() => goToDay(todayKey())} className={NAV_BUTTON}>
            Today
          </button>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => goToDay(addDays(day, 1))}
            className={NAV_BUTTON}
          >
            <span aria-hidden="true">›</span>
          </button>
          <button type="button" onClick={() => setView('calendar')} className={NAV_BUTTON}>
            Calendar
          </button>
        </div>
      </header>

      <div
        data-testid="day-summary"
        className="card flex flex-wrap items-end justify-between gap-x-8 gap-y-4 p-4"
      >
        <div>
          <p className="text-xs tracking-wide text-subtle uppercase">
            {budget.calories.hasGoal
              ? budget.calories.isOver
                ? 'Over budget'
                : 'Remaining'
              : 'Logged'}
          </p>
          <p
            data-testid="day-remaining"
            className={[
              'text-2xl font-semibold tabular-nums',
              budget.calories.isOver ? 'text-danger' : 'text-ink',
            ].join(' ')}
          >
            {budget.calories.hasGoal
              ? `${formatCalories(budget.calories.isOver ? budget.calories.overBy : budget.calories.remaining)} kcal`
              : `${formatCalories(totals.calories)} kcal`}
          </p>
          <p className="text-xs text-muted tabular-nums">
            {budget.calories.hasGoal
              ? `${formatCalories(totals.calories)} of ${formatCalories(budget.calories.goal)} kcal`
              : 'No calorie goal set'}
          </p>
        </div>

        {visibleMacros.length > 0 ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-3">
            {visibleMacros.map((macro) => {
              const slice = budget.macros[macro];
              return (
                <div key={macro} className="min-w-20">
                  <dt className="text-xs text-muted">{macroLabel(macro)}</dt>
                  <dd className="text-sm font-medium tabular-nums">
                    {formatMacro(macro, totals.macros[macro])}
                    {slice ? (
                      <span className="text-xs font-normal text-subtle">
                        {' / '}
                        {formatMacro(macro, slice.goal)}
                      </span>
                    ) : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </div>

      <WeightPanel
        day={day}
        weightKg={weightKg}
        weightUnit={weightUnit}
        onCommit={(value) => setWeight(day, value, weightUnit)}
        onUnitChange={setWeightUnit}
      />

      {/* `relative` keeps the table's visually-hidden caption and header text
          inside this scroll container; positioned against the viewport instead,
          they escape the clip and scroll the whole page sideways on a phone. */}
      <div className="card relative overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">Food logged on {formatLongDate(day)}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={HEAD_CELL}>
                Food
              </th>
              <th scope="col" className={NUM_HEAD_CELL}>
                Grams
              </th>
              <th scope="col" className={NUM_HEAD_CELL}>
                Calories
              </th>
              {visibleMacros.map((macro) => (
                <th key={macro} scope="col" className={NUM_HEAD_CELL}>
                  {macroLabel(macro)} ({macroUnit(macro)})
                </th>
              ))}
              <th scope="col" className={`${HEAD_CELL} text-right`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-2 py-6 text-center text-sm text-muted">
                  No food logged yet.
                </td>
              </tr>
            ) : null}

            {entries.map((entry) =>
              entry.id === editingId ? (
                <tr
                  key={entry.id}
                  data-testid={`entry-row-${entry.id}`}
                  className="border-b border-line bg-accent-faint"
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      saveEdit();
                    }
                    if (event.key === 'Escape') cancelEdit();
                  }}
                >
                  <DraftCells
                    draft={editDraft}
                    onChange={setEditDraft}
                    visibleMacros={visibleMacros}
                    context={entry.name || 'entry'}
                    autoFocus
                  />
                  <td className={`${CELL} text-right whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={draftToInput(editDraft) === null}
                      className={`${ROW_BUTTON} disabled:opacity-50`}
                    >
                      Save
                    </button>{' '}
                    <button type="button" onClick={cancelEdit} className={ROW_BUTTON}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr
                  key={entry.id}
                  data-testid={`entry-row-${entry.id}`}
                  className="border-b border-line last:border-b-0"
                >
                  <th scope="row" className={`${CELL} text-left font-medium`}>
                    {entry.name}
                  </th>
                  <td className={NUM_CELL}>{Math.round(entry.grams)}</td>
                  <td className={NUM_CELL}>{formatCalories(entry.calories)}</td>
                  {visibleMacros.map((macro) => (
                    <td key={macro} className={`${NUM_CELL} text-muted`}>
                      {entry.macros[macro] === undefined
                        ? '—'
                        : Math.round((entry.macros[macro] ?? 0) * 10) / 10}
                    </td>
                  ))}
                  <td className={`${CELL} text-right whitespace-nowrap`}>
                    <button
                      type="button"
                      aria-label={`Edit ${entry.name}`}
                      onClick={() => startEdit(entry)}
                      className={ROW_BUTTON}
                    >
                      Edit
                    </button>{' '}
                    <button
                      type="button"
                      aria-label={`Delete ${entry.name}`}
                      onClick={() => {
                        if (entry.id === editingId) cancelEdit();
                        removeEntry(day, entry.id);
                      }}
                      className={DANGER_BUTTON}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ),
            )}

            <tr
              data-testid="add-entry-row"
              className="border-t border-line bg-sunken"
              onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitAdd();
                }
                if (event.key === 'Escape') setAddDraft(emptyDraft());
              }}
            >
              <DraftCells
                draft={addDraft}
                onChange={setAddDraft}
                visibleMacros={visibleMacros}
                context="new entry"
              />
              <td className={`${CELL} text-right whitespace-nowrap`}>
                <button
                  type="button"
                  onClick={submitAdd}
                  disabled={draftToInput(addDraft) === null}
                  className={PRIMARY_BUTTON}
                >
                  Add
                </button>
              </td>
            </tr>
          </tbody>

          <tfoot data-testid="day-totals" className="border-t-2 border-line-strong">
            <tr>
              <th scope="row" className={`${CELL} text-left text-xs tracking-wide uppercase`}>
                Total
              </th>
              <td className={`${NUM_CELL} font-medium`}>{Math.round(gramsTotal)}</td>
              <td className={`${NUM_CELL} font-medium`}>{formatCalories(totals.calories)}</td>
              {visibleMacros.map((macro) => (
                <td key={macro} className={`${NUM_CELL} font-medium`}>
                  {Math.round(totals.macros[macro] * 10) / 10}
                </td>
              ))}
              <td className={CELL} />
            </tr>
            <tr>
              <th scope="row" className={`${CELL} text-left text-xs tracking-wide uppercase`}>
                Goal
              </th>
              <td className={NUM_CELL} />
              <td className={`${NUM_CELL} text-muted`}>
                {budget.calories.hasGoal ? formatCalories(budget.calories.goal) : '—'}
              </td>
              {visibleMacros.map((macro) => {
                const slice = budget.macros[macro];
                return (
                  <td key={macro} className={`${NUM_CELL} text-muted`}>
                    {slice ? Math.round(slice.goal * 10) / 10 : '—'}
                  </td>
                );
              })}
              <td className={CELL} />
            </tr>
            <tr>
              <th scope="row" className={`${CELL} text-left text-xs tracking-wide uppercase`}>
                Remaining
              </th>
              <td className={NUM_CELL} />
              <td
                data-testid="totals-remaining-calories"
                className={`${NUM_CELL} font-medium ${budget.calories.isOver ? 'text-danger' : 'text-muted'}`}
              >
                {budget.calories.hasGoal ? formatCalories(budget.calories.remaining) : '—'}
              </td>
              {visibleMacros.map((macro) => {
                const slice = budget.macros[macro];
                return (
                  <td
                    key={macro}
                    data-testid={`totals-remaining-${macro}`}
                    className={`${NUM_CELL} ${slice?.isOver ? 'text-danger' : 'text-muted'}`}
                  >
                    {slice ? Math.round(slice.remaining * 10) / 10 : '—'}
                  </td>
                );
              })}
              <td className={CELL} />
            </tr>
          </tfoot>
        </table>
      </div>

      <QuickAdd day={day} />
    </section>
  );
}

type WeightPanelProps = {
  day: DateKey;
  weightKg: number | undefined;
  weightUnit: WeightUnit;
  onCommit: (value: number | undefined) => void;
  onUnitChange: (unit: WeightUnit) => void;
};

/** Body-weight weigh-in for the selected day; unit preference is shared app-wide. */
function WeightPanel({ day, weightKg, weightUnit, onCommit, onUnitChange }: WeightPanelProps) {
  const display =
    weightKg === undefined
      ? undefined
      : roundWeight(fromCanonicalKg(weightKg, weightUnit), weightUnit);
  const unitOptions: ReadonlyArray<SegmentedOption<WeightUnit>> = [
    { value: 'lb', label: 'lb' },
    { value: 'kg', label: 'kg' },
  ];

  return (
    <div data-testid="day-weight" className="card flex flex-wrap items-end gap-4 p-4">
      <NumberField
        label="Weight"
        testId="day-weight-input"
        value={display}
        min={0}
        allowEmpty
        unit={weightUnitLabel(weightUnit)}
        placeholder="—"
        onCommit={(value) => onCommit(value)}
        className="w-36"
      />
      <div>
        <span className="block text-xs font-medium tracking-wide text-muted uppercase">Unit</span>
        <div className="mt-1">
          <SegmentedControl
            label="Weight unit"
            testId="day-weight-unit"
            value={weightUnit}
            options={unitOptions}
            onChange={onUnitChange}
          />
        </div>
      </div>
      {weightKg !== undefined ? (
        <button
          type="button"
          aria-label={`Clear weight for ${day}`}
          onClick={() => onCommit(undefined)}
          className={ROW_BUTTON}
        >
          Clear
        </button>
      ) : (
        <p className="text-xs text-muted">Optional daily weigh-in for the Graphs page.</p>
      )}
    </div>
  );
}

type DraftCellsProps = {
  draft: Draft;
  onChange: (draft: Draft) => void;
  visibleMacros: readonly MacroKey[];
  /** Disambiguates the input labels, e.g. `Grams for new entry`. */
  context: string;
  autoFocus?: boolean;
};

/** The name/grams/calories/macro input cells shared by the add and edit rows. */
function DraftCells({ draft, onChange, visibleMacros, context, autoFocus }: DraftCellsProps) {
  const setMacro = (macro: MacroKey, value: string) =>
    onChange({ ...draft, macros: { ...draft.macros, [macro]: value } });

  return (
    <>
      <td className={`${CELL} min-w-40`}>
        <input
          type="text"
          value={draft.name}
          autoFocus={autoFocus}
          placeholder="Food name"
          aria-label={`Food name for ${context}`}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          className={INPUT}
        />
      </td>
      <td className={`${CELL} w-20`}>
        <input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={draft.grams}
          placeholder="0"
          aria-label={`Grams for ${context}`}
          onChange={(event) => onChange({ ...draft, grams: event.target.value })}
          className={`${INPUT} text-right tabular-nums`}
        />
      </td>
      <td className={`${CELL} w-20`}>
        <input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={draft.calories}
          placeholder="0"
          aria-label={`Calories for ${context}`}
          onChange={(event) => onChange({ ...draft, calories: event.target.value })}
          className={`${INPUT} text-right tabular-nums`}
        />
      </td>
      {visibleMacros.map((macro) => (
        <td key={macro} className={`${CELL} w-20`}>
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={draft.macros[macro] ?? ''}
            placeholder="0"
            aria-label={`${macroLabel(macro)} for ${context}`}
            onChange={(event) => setMacro(macro, event.target.value)}
            className={`${INPUT} text-right tabular-nums`}
          />
        </td>
      ))}
    </>
  );
}

/** Logs a library food scaled from its reference weight to the grams entered. */
function QuickAdd({ day }: { day: DateKey }) {
  const listboxId = useId();
  const customFoods = useCustomFoods();
  const visibleMacros = useVisibleMacros();
  const addEntry = useAppStore((state) => state.addEntry);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<QuickAddOption | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [grams, setGrams] = useState('100');
  const blurTimer = useRef<number | null>(null);
  const normalizedQuery = query.trim().toLowerCase();

  const customMatches = useMemo(() => {
    if (!normalizedQuery) return customFoods.slice(0, 20);
    return customFoods.filter((food) => food.name.toLowerCase().includes(normalizedQuery));
  }, [customFoods, normalizedQuery]);

  const [starterResult, setStarterResult] = useState<{
    query: string;
    items: FoodLibraryItem[];
  }>({ query: '', items: [] });

  useEffect(() => {
    if (!normalizedQuery) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      queryStarterFoods({ query: normalizedQuery, limit: 40, offset: 0 })
        .then((page) => {
          if (!cancelled) setStarterResult({ query: normalizedQuery, items: page.items });
        })
        .catch(() => {
          if (!cancelled) setStarterResult({ query: normalizedQuery, items: [] });
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [normalizedQuery]);

  useEffect(() => {
    return () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    };
  }, []);

  const loading = Boolean(normalizedQuery) && starterResult.query !== normalizedQuery;

  const options = useMemo(() => {
    const starterMatches =
      normalizedQuery && starterResult.query === normalizedQuery ? starterResult.items : [];
    const rows: QuickAddOption[] = [];
    customMatches.forEach((food, index) => {
      rows.push({ key: `custom:${index}:${food.name}`, food, source: 'custom' });
    });
    starterMatches.forEach((food, index) => {
      rows.push({ key: `starter:${index}:${food.name}`, food, source: 'starter' });
    });
    return rows;
  }, [customMatches, normalizedQuery, starterResult]);

  const activeIndex = options.length === 0 ? 0 : Math.min(highlight, options.length - 1);
  const scaled = selected ? scaleFood(selected.food, parseNumber(grams) ?? 0) : null;
  const showMenu = open && !selected;
  const activeOption = options[activeIndex] ?? null;

  const pick = (row: QuickAddOption) => {
    setSelected(row);
    setQuery(row.food.name);
    setOpen(false);
    setHighlight(0);
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    setSelected(null);
    setOpen(true);
    setHighlight(0);
  };

  const onComboboxKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (selected) {
        setSelected(null);
        setOpen(true);
        return;
      }
      setOpen(true);
      if (options.length === 0) return;
      setHighlight((index) => (Math.min(index, options.length - 1) + 1) % options.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (selected) {
        setSelected(null);
        setOpen(true);
        return;
      }
      setOpen(true);
      if (options.length === 0) return;
      setHighlight(
        (index) => (Math.min(index, options.length - 1) - 1 + options.length) % options.length,
      );
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === 'Enter' && showMenu && activeOption) {
      event.preventDefault();
      pick(activeOption);
    }
  };

  return (
    <form
      data-testid="quick-add"
      className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selected || !scaled) return;
        addEntry(day, scaled);
      }}
    >
      <div className="relative grid gap-1">
        <label
          htmlFor={`${listboxId}-input`}
          className="text-xs tracking-wide text-subtle uppercase"
        >
          Quick add
        </label>
        <input
          id={`${listboxId}-input`}
          type="text"
          role="combobox"
          name="quick-add-search"
          data-testid="quick-add-search"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showMenu}
          aria-controls={listboxId}
          aria-activedescendant={
            showMenu && activeOption ? `${listboxId}-option-${activeIndex}` : undefined
          }
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => {
            if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
            if (!selected) setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onComboboxKeyDown}
          placeholder={`Search ${STARTER_FOOD_COUNT.toLocaleString()} foods`}
          className={`${INPUT} h-8`}
        />

        {showMenu ? (
          <ul
            id={listboxId}
            role="listbox"
            data-testid="quick-add-suggestions"
            className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-md"
          >
            {loading && options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">Searching…</li>
            ) : options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">
                {normalizedQuery ? 'No matches' : 'Type to search'}
              </li>
            ) : (
              options.map((row, index) => {
                const active = index === activeIndex;
                return (
                  <li
                    key={row.key}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={active}
                    data-testid={`quick-add-option-${index}`}
                    className={[
                      'cursor-pointer px-3 py-2 text-sm',
                      active ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-raised',
                    ].join(' ')}
                    onMouseDown={(event) => {
                      // Keep focus on the input so blur does not close before pick.
                      event.preventDefault();
                      pick(row);
                    }}
                    onMouseEnter={() => setHighlight(index)}
                  >
                    <span className="font-medium">
                      {row.source === 'custom' ? '★ ' : ''}
                      {row.food.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted tabular-nums">
                      {formatCalories(row.food.calories)} kcal / {Math.round(row.food.grams)} g
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      <label className="grid gap-1 text-xs tracking-wide text-subtle uppercase">
        Grams
        <input
          type="number"
          name="quick-add-grams"
          min={0}
          step="any"
          inputMode="decimal"
          value={grams}
          onChange={(event) => setGrams(event.target.value)}
          className={`${INPUT} h-8 w-24 text-right tabular-nums`}
        />
      </label>

      <button type="submit" disabled={!scaled} className={PRIMARY_BUTTON}>
        Quick add
      </button>

      {scaled ? (
        <p
          data-testid="quick-add-preview"
          className="text-xs text-muted tabular-nums sm:col-span-3"
        >
          {scaled.name} · {Math.round(scaled.grams)} g · {formatCalories(scaled.calories)} kcal
          {visibleMacros.length > 0
            ? ` · ${visibleMacros
                .map(
                  (macro) =>
                    `${macroLabel(macro)} ${formatMacro(macro, scaled.macros[macro] ?? 0)}`,
                )
                .join(' · ')}`
            : ''}
        </p>
      ) : null}
    </form>
  );
}
