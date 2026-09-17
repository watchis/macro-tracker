import { useMemo, useState } from 'react';
import { addDays, formatLongDate, isToday, todayKey } from '../lib/dates';
import { MACROS, formatMacro, macroLabel, macroUnit } from '../lib/macros';
import { formatCalories, scaleFood } from '../lib/totals';
import { useAppStore } from '../store/useAppStore';
import {
  useDayBudget,
  useDayEntries,
  useFoodLibrary,
  useSelectedDate,
  useVisibleMacros,
} from '../store/selectors';
import type { KeyboardEvent } from 'react';
import type { DateKey, FoodEntry, FoodEntryInput, MacroKey } from '../types';

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
                  No food logged yet — add the first entry below.
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
  const library = useFoodLibrary();
  const visibleMacros = useVisibleMacros();
  const addEntry = useAppStore((state) => state.addEntry);
  const [index, setIndex] = useState(0);
  const [grams, setGrams] = useState('100');

  const item = library[Math.min(index, Math.max(library.length - 1, 0))];
  const scaled = item ? scaleFood(item, parseNumber(grams) ?? 0) : null;

  if (library.length === 0) {
    return (
      <div className="card p-4 text-sm text-muted">
        The food library is empty. Add reusable foods in settings to quick-add them here.
      </div>
    );
  }

  return (
    <form
      data-testid="quick-add"
      className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (!item || !scaled) return;
        addEntry(day, scaled);
      }}
    >
      <label className="grid gap-1 text-xs tracking-wide text-subtle uppercase">
        Quick add from library
        <select
          name="quick-add-food"
          value={index}
          onChange={(event) => setIndex(Number(event.target.value))}
          className={`${INPUT} h-8 py-0`}
        >
          {library.map((food, foodIndex) => (
            <option key={`${food.name}-${foodIndex}`} value={foodIndex}>
              {food.name} · {formatCalories(food.calories)} kcal / {Math.round(food.grams)} g
            </option>
          ))}
        </select>
      </label>

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
