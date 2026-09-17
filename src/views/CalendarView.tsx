import { ViewPlaceholder } from '../components/ViewPlaceholder';
import { formatMonthYear, monthKeyOf, todayKey } from '../lib/dates';
import { useAppStore } from '../store/useAppStore';
import { useSelectedDate, useSettings } from '../store/selectors';
import type { DateKey, MonthKey } from '../types';

export type CalendarViewProps = {
  /** `YYYY-MM` month to render; defaults to the month of the selected date. */
  month?: MonthKey;
  /** Day cell click handler; defaults to the store's `openDay`. */
  onOpenDay?: (date: DateKey) => void;
};

/**
 * Month grid of logged days. Placeholder for the calendar feature work: build
 * the grid from `buildMonthGrid(month, settings.weekStart)` and read each cell's
 * numbers with `useDayTotals` / `useDayBudget`.
 */
export function CalendarView({ month, onOpenDay }: CalendarViewProps) {
  const selectedDate = useSelectedDate();
  const settings = useSettings();
  const storeOpenDay = useAppStore((state) => state.openDay);
  const openDay = onOpenDay ?? storeOpenDay;
  const activeMonth = month ?? monthKeyOf(selectedDate);

  return (
    <ViewPlaceholder
      title={formatMonthYear(activeMonth)}
      description={`Month grid of logged days, weeks starting ${settings.weekStart === 'monday' ? 'Monday' : 'Sunday'}.`}
      items={[
        'Day cells with remaining calories and visible-macro totals',
        'Today highlighted with the accent color',
        'Previous / next month navigation',
      ]}
    >
      <button
        type="button"
        onClick={() => openDay(todayKey())}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:bg-accent-strong"
      >
        Open today
      </button>
    </ViewPlaceholder>
  );
}
