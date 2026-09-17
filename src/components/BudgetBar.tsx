import { useLayoutEffect, useRef } from 'react';
import { MacroChip } from './MacroChip';
import { formatCalories } from '../lib/totals';
import { formatShortDate, isToday } from '../lib/dates';
import { useDayBudget, useSelectedDate, useVisibleMacros } from '../store/selectors';
import type { RefObject } from 'react';
import type { DateKey } from '../types';

export type BudgetBarProps = {
  /** Day to report on; defaults to the selected date. */
  date?: DateKey;
};

/**
 * Publishes the bar's measured height as `--budget-bar-height` so the scrolling
 * content can reserve exactly enough room. The bar wraps onto extra rows on
 * narrow screens or with many macro chips, which a fixed padding would miss.
 */
function usePublishedHeight(ref: RefObject<HTMLDivElement | null>): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;

    const publish = () => {
      root.style.setProperty('--budget-bar-height', `${element.offsetHeight}px`);
    };
    publish();

    if (typeof ResizeObserver === 'undefined')
      return () => root.style.removeProperty('--budget-bar-height');
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--budget-bar-height');
    };
  }, [ref]);
}

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
  const barRef = useRef<HTMLDivElement>(null);
  usePublishedHeight(barRef);

  const { calories, totals } = budget;
  const over = calories.isOver;
  const headline = !calories.hasGoal
    ? `${formatCalories(calories.consumed)} kcal logged`
    : over
      ? `${formatCalories(calories.overBy)} kcal over`
      : `${formatCalories(calories.remaining)} kcal left`;

  // Past the goal the inverted fill is empty, so the track turns red and fills
  // again with the overshoot, keeping a small sliver visible from the first kcal.
  const overshoot = calories.goal > 0 ? (calories.overBy / calories.goal) * 100 : 0;
  const fillWidth = over ? Math.min(100, Math.max(6, overshoot)) : calories.percentRemaining;

  return (
    <div
      ref={barRef}
      data-testid="budget-bar"
      data-over-budget={over ? 'true' : 'false'}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              data-testid="budget-headline"
              className={[
                'text-lg font-semibold tabular-nums',
                over ? 'text-danger' : 'text-ink',
              ].join(' ')}
            >
              {headline}
            </span>
            {over ? (
              <span
                data-testid="budget-over-badge"
                className="rounded-full border border-danger/40 bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger"
              >
                Over budget
              </span>
            ) : null}
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
          className={[
            'mt-2.5 h-2 w-full overflow-hidden rounded-full',
            over ? 'bg-danger-soft' : 'bg-sunken',
          ].join(' ')}
        >
          <div
            data-testid="budget-progress-fill"
            className={[
              'h-full rounded-full transition-[width] duration-300 ease-out',
              over ? 'bg-danger' : 'bg-accent',
            ].join(' ')}
            style={{ width: `${fillWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}
