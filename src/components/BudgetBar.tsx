import { MacroChip } from './MacroChip';
import { formatCalories } from '../lib/totals';
import { formatShortDate, isToday } from '../lib/dates';
import { useDayBudget, useSelectedDate, useVisibleMacros } from '../store/selectors';
import type { DateKey } from '../types';

export type BudgetBarProps = {
  /** Day to report on; defaults to the selected date. */
  date?: DateKey;
};

/**
 * Global bottom bar showing the calorie budget as an inverted progress bar: the
 * fill starts at 100% on an empty day and depletes toward 0% as food is logged,
 * flipping to an over-budget state once the goal is passed.
 */
export function BudgetBar({ date }: BudgetBarProps) {
  const selectedDate = useSelectedDate();
  const day = date ?? selectedDate;
  const budget = useDayBudget(day);
  const visibleMacros = useVisibleMacros();

  const { calories, totals } = budget;
  const over = calories.isOver;
  const headline = !calories.hasGoal
    ? `${formatCalories(calories.consumed)} kcal logged`
    : over
      ? `${formatCalories(calories.overBy)} kcal over`
      : `${formatCalories(calories.remaining)} kcal left`;

  return (
    <div
      data-testid="budget-bar"
      data-over-budget={over ? 'true' : 'false'}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur"
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span
              data-testid="budget-headline"
              className={[
                'text-lg font-semibold tabular-nums',
                over ? 'text-danger' : 'text-ink',
              ].join(' ')}
            >
              {headline}
            </span>
            <span className="text-xs text-subtle">
              {isToday(day) ? 'today' : formatShortDate(day)}
              {calories.hasGoal
                ? ` · ${formatCalories(calories.consumed)} / ${formatCalories(calories.goal)} kcal`
                : ''}
            </span>
          </div>

          {visibleMacros.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {visibleMacros.map((macro) => (
                <MacroChip
                  key={macro}
                  macro={macro}
                  consumed={totals.macros[macro]}
                  slice={budget.macros[macro]}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div
          role="progressbar"
          aria-label="Calories remaining"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(calories.percentRemaining)}
          aria-valuetext={headline}
          data-testid="budget-progress"
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-sunken"
        >
          <div
            data-testid="budget-progress-fill"
            className={[
              'h-full rounded-full transition-[width] duration-300 ease-out',
              over ? 'bg-danger' : 'bg-accent',
            ].join(' ')}
            style={{ width: `${over ? 100 : calories.percentRemaining}%` }}
          />
        </div>
      </div>
    </div>
  );
}
