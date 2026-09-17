import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  dayOfMonth,
  daysInMonth,
  formatLongDate,
  formatMonthYear,
  isSameMonth,
  isToday,
  monthKeyOf,
  todayKey,
  weekdayLabels,
} from '../lib/dates';
import { formatMacro, macroMeta } from '../lib/macros';
import { formatCalories, sumEntries } from '../lib/totals';
import { useAppStore } from '../store/useAppStore';
import { useDayBudget, useSelectedDate, useSettings, useVisibleMacros } from '../store/selectors';
import type { KeyboardEvent } from 'react';
import type { DateKey, MacroKey, MonthKey } from '../types';

export type CalendarViewProps = {
  /** `YYYY-MM` month to open on; defaults to the month of the selected date. */
  month?: MonthKey;
  /** Day cell click handler; defaults to the store's `openDay`. */
  onOpenDay?: (date: DateKey) => void;
};

/** Arrow keys walk the grid the way a date picker does. */
const ARROW_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

const NAV_BUTTON =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-line bg-raised px-2 text-sm font-medium text-muted transition-colors hover:border-accent-border hover:bg-accent-soft hover:text-ink';

function dateInMonth(month: MonthKey, day: number): DateKey {
  const clamped = Math.min(Math.max(day, 1), daysInMonth(month));
  return `${month}-${String(clamped).padStart(2, '0')}`;
}

/**
 * Month grid of logged days. Each cell carries a compact remaining-calorie
 * readout plus totals for the macros currently switched on in settings, and
 * clicking one opens that day in the day view.
 */
export function CalendarView({ month, onOpenDay }: CalendarViewProps) {
  const selectedDate = useSelectedDate();
  const settings = useSettings();
  const visibleMacros = useVisibleMacros();
  const days = useAppStore((state) => state.days);
  const storeOpenDay = useAppStore((state) => state.openDay);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const openDay = onOpenDay ?? storeOpenDay;

  const selectedMonth = monthKeyOf(selectedDate);
  // Browsing months is local UI state, but picking a day elsewhere (the day
  // view's navigation, say) should still pull the grid to that month.
  const [visible, setVisible] = useState(() => ({
    month: month ?? selectedMonth,
    syncedFrom: selectedMonth,
  }));
  if (visible.syncedFrom !== selectedMonth) {
    setVisible({ month: selectedMonth, syncedFrom: selectedMonth });
  }
  const activeMonth = visible.month;
  const showMonth = (next: MonthKey) => setVisible({ month: next, syncedFrom: selectedMonth });

  const gridRef = useRef<HTMLDivElement | null>(null);
  // Paging the month unmounts the focused cell, so the next grid has to be told
  // where to put focus back once it has rendered.
  const pendingFocus = useRef<DateKey | null>(null);
  const grid = useMemo(
    () => buildMonthGrid(activeMonth, settings.weekStart),
    [activeMonth, settings.weekStart],
  );
  const labels = useMemo(() => weekdayLabels(settings.weekStart), [settings.weekStart]);

  const summary = useMemo(() => {
    let logged = 0;
    let calories = 0;
    for (const [date, entries] of Object.entries(days)) {
      if (entries.length === 0 || !isSameMonth(date, activeMonth)) continue;
      logged += 1;
      calories += sumEntries(entries).calories;
    }
    return { logged, calories };
  }, [days, activeMonth]);

  const goToToday = () => {
    const today = todayKey();
    setSelectedDate(today);
    showMonth(monthKeyOf(today));
  };

  const focusDate = (date: DateKey) => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus();
  };

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus();
  }, [activeMonth]);

  const handleGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const date = (event.target as HTMLElement).dataset?.date;
    if (!date) return;
    const step = ARROW_STEPS[event.key];
    if (step !== undefined) {
      event.preventDefault();
      focusDate(addDays(date, step));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusDate(dateInMonth(activeMonth, 1));
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusDate(dateInMonth(activeMonth, daysInMonth(activeMonth)));
      return;
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      const next = addMonths(activeMonth, event.key === 'PageUp' ? -1 : 1);
      pendingFocus.current = dateInMonth(next, dayOfMonth(date));
      showMonth(next);
    }
  };

  return (
    <section className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 data-testid="calendar-month" className="text-xl font-semibold tracking-tight">
            {formatMonthYear(activeMonth)}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {summary.logged === 0
              ? 'Nothing logged this month yet.'
              : `${summary.logged} ${summary.logged === 1 ? 'day' : 'days'} logged · ${formatCalories(summary.calories)} kcal total`}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => showMonth(addMonths(activeMonth, -1))}
            className={NAV_BUTTON}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" onClick={goToToday} className={NAV_BUTTON}>
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => showMonth(addMonths(activeMonth, 1))}
            className={NAV_BUTTON}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </header>

      <div className="card p-2 sm:p-3">
        <div
          aria-hidden="true"
          className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-medium tracking-wide text-subtle uppercase sm:gap-1.5"
        >
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div
          ref={gridRef}
          data-testid="calendar-grid"
          onKeyDown={handleGridKeyDown}
          className="grid grid-cols-7 gap-1 sm:gap-1.5"
        >
          {grid.map((date) => (
            <CalendarDayCell
              key={date}
              date={date}
              month={activeMonth}
              visibleMacros={visibleMacros}
              selected={date === selectedDate}
              onOpen={openDay}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

type CalendarDayCellProps = {
  date: DateKey;
  month: MonthKey;
  visibleMacros: readonly MacroKey[];
  selected: boolean;
  onOpen: (date: DateKey) => void;
};

/** One day of the grid. Quiet when nothing is logged, numeric when it is. */
function CalendarDayCell({ date, month, visibleMacros, selected, onOpen }: CalendarDayCellProps) {
  const { calories, totals } = useDayBudget(date);
  const inMonth = isSameMonth(date, month);
  const today = isToday(date);
  const logged = totals.entryCount > 0;
  const over = calories.isOver;

  const remaining = !calories.hasGoal
    ? `${formatCalories(calories.consumed)} kcal`
    : over
      ? `${formatCalories(calories.overBy)} over`
      : `${formatCalories(calories.remaining)} left`;

  const label = [
    formatLongDate(date),
    logged
      ? `${totals.entryCount} ${totals.entryCount === 1 ? 'entry' : 'entries'}, ${formatCalories(totals.calories)} kcal`
      : 'nothing logged',
    logged && calories.hasGoal
      ? over
        ? `${formatCalories(calories.overBy)} kcal over budget`
        : `${formatCalories(calories.remaining)} kcal left`
      : null,
    ...(logged
      ? visibleMacros.map(
          (macro) => `${macroMeta(macro).label} ${formatMacro(macro, totals.macros[macro])}`,
        )
      : []),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      data-date={date}
      data-testid={`calendar-day-${date}`}
      data-logged={logged ? 'true' : 'false'}
      aria-label={label}
      aria-current={today ? 'date' : undefined}
      onClick={() => onOpen(date)}
      className={[
        'flex min-h-16 flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors',
        'hover:border-accent-border hover:bg-accent-soft sm:min-h-24 sm:p-2',
        today
          ? 'border-accent-border bg-accent-faint'
          : logged
            ? 'border-line bg-raised'
            : 'border-line bg-transparent',
        inMonth ? '' : 'opacity-45',
        selected ? 'ring-2 ring-accent' : '',
      ].join(' ')}
    >
      <span aria-hidden="true" className="flex items-center justify-between gap-1">
        <span
          className={[
            'text-xs font-semibold tabular-nums sm:text-sm',
            today
              ? 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-accent-contrast sm:h-6 sm:min-w-6'
              : logged
                ? 'text-ink'
                : 'text-subtle',
          ].join(' ')}
        >
          {dayOfMonth(date)}
        </span>
        {logged ? (
          <span className="text-[10px] text-subtle tabular-nums">{totals.entryCount}</span>
        ) : null}
      </span>

      {logged ? (
        <span aria-hidden="true" className="mt-auto block">
          <span
            data-testid={`calendar-remaining-${date}`}
            className={[
              'block text-[10px] leading-tight font-semibold tabular-nums sm:text-xs',
              over ? 'text-danger' : 'text-muted',
            ].join(' ')}
          >
            {remaining}
          </span>

          {calories.hasGoal ? (
            <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-sunken">
              <span
                data-testid={`calendar-fill-${date}`}
                className={['block h-full rounded-full', over ? 'bg-danger' : 'bg-accent'].join(
                  ' ',
                )}
                style={{ width: `${over ? 100 : calories.percentRemaining}%` }}
              />
            </span>
          ) : null}

          {visibleMacros.length > 0 ? (
            <span className="mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] text-subtle tabular-nums">
              {visibleMacros.map((macro) => (
                <span key={macro}>
                  <span className="font-medium text-muted">{macroMeta(macro).shortLabel}</span>{' '}
                  {Math.round(totals.macros[macro])}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
