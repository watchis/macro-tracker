import { ViewPlaceholder } from '../components/ViewPlaceholder';
import { formatLongDate } from '../lib/dates';
import { useDayTotals, useSelectedDate, useVisibleMacros } from '../store/selectors';
import { macroLabel } from '../lib/macros';
import { formatCalories } from '../lib/totals';
import type { DateKey } from '../types';

export type DayViewProps = {
  /** Day to log against; defaults to the selected date. */
  date?: DateKey;
};

/**
 * Single-day food log. Placeholder for the day-logging feature work: render the
 * entry table from `useDayEntries(date)`, one column per `useVisibleMacros()`
 * entry, and mutate through `addEntry` / `updateEntry` / `removeEntry`.
 */
export function DayView({ date }: DayViewProps) {
  const selectedDate = useSelectedDate();
  const day = date ?? selectedDate;
  const totals = useDayTotals(day);
  const visibleMacros = useVisibleMacros();

  return (
    <ViewPlaceholder
      title={formatLongDate(day)}
      description={`${totals.entryCount} ${totals.entryCount === 1 ? 'entry' : 'entries'} logged · ${formatCalories(totals.calories)} kcal · columns for ${visibleMacros.map(macroLabel).join(', ') || 'no macros yet'}.`}
      items={[
        'Entry table with name, grams, calories and a column per visible macro',
        'Inline add row plus edit and delete',
        'Day totals against goals',
        'Quick-add from the food library, scaled by grams',
      ]}
    />
  );
}
