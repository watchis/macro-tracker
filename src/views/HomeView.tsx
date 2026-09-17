import { useMemo, useState } from 'react';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { SegmentedControl } from '../components/settings/SegmentedControl';
import { addDays, formatLongDate, formatShortDate, todayKey } from '../lib/dates';
import { calorieDeltaSeries, calorieSeries, linearTrend, weightSeries } from '../lib/series';
import { formatCalories, sumEntries } from '../lib/totals';
import { fromCanonicalKg, roundWeight, weightUnitLabel } from '../lib/weight';
import { useAppStore } from '../store/useAppStore';
import {
  useDayBudget,
  useDayWeightKg,
  useGoals,
  useWeightUnit,
  useWeights,
} from '../store/selectors';
import { CalendarView } from './CalendarView';
import type { SegmentedOption } from '../components/settings/SegmentedControl';
import type { DateKey, FoodEntry, WeightUnit } from '../types';

const RANGE_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All' },
] as const;

const CHART_OPTIONS = [
  { value: 'weight', label: 'Weight' },
  { value: 'calories', label: 'Calories' },
  { value: 'delta', label: 'Over / under' },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]['value'];
type ChartKey = (typeof CHART_OPTIONS)[number]['value'];

function filterByRange<T extends { date: string }>(points: readonly T[], range: RangeKey): T[] {
  if (range === 'all' || points.length === 0) return [...points];
  const days = Number(range);
  const latest = points[points.length - 1]!.date;
  const cutoffMs = Date.parse(`${latest}T00:00:00`) - (days - 1) * 86_400_000;
  return points.filter((point) => Date.parse(`${point.date}T00:00:00`) >= cutoffMs);
}

function formatDisplayWeight(value: number, unit: WeightUnit): string {
  return `${roundWeight(value, unit).toLocaleString(undefined, {
    maximumFractionDigits: unit === 'lb' ? 1 : 2,
  })} ${weightUnitLabel(unit)}`;
}

/**
 * Landing dashboard: today/week snapshot, a compact month calendar, and a
 * single switchable trend chart. Day logging opens from a calendar cell.
 */
export function HomeView() {
  const days = useAppStore((state) => state.days);
  const weights = useWeights();
  const goals = useGoals();
  const weightUnit = useWeightUnit();
  const setWeightUnit = useAppStore((state) => state.setWeightUnit);
  const setView = useAppStore((state) => state.setView);
  const openDay = useAppStore((state) => state.openDay);
  const [range, setRange] = useState<RangeKey>('90');
  const [chart, setChart] = useState<ChartKey>('weight');
  const today = todayKey();

  const weightPoints = useMemo(() => {
    const series = weightSeries(weights).map((point) => ({
      ...point,
      value: fromCanonicalKg(point.value, weightUnit),
    }));
    return filterByRange(series, range);
  }, [weights, weightUnit, range]);

  const caloriePoints = useMemo(() => filterByRange(calorieSeries(days), range), [days, range]);

  const deltaPoints = useMemo(
    () => filterByRange(calorieDeltaSeries(days, goals), range),
    [days, goals, range],
  );

  const weightTrend = useMemo(() => linearTrend(weightPoints), [weightPoints]);

  const weekStats = useMemo(
    () => computeWeekStats(days, goals.calories, today),
    [days, goals.calories, today],
  );

  const unitOptions: ReadonlyArray<SegmentedOption<WeightUnit>> = [
    { value: 'lb', label: 'lb' },
    { value: 'kg', label: 'kg' },
  ];

  const rangeOptions: ReadonlyArray<SegmentedOption<RangeKey>> = RANGE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  const chartOptions: ReadonlyArray<SegmentedOption<ChartKey>> = CHART_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <section className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Home</h1>
          <p className="mt-0.5 text-sm text-muted">
            Today at a glance, this month, and your longer trends.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Date range"
            testId="home-range"
            value={range}
            options={rangeOptions}
            onChange={setRange}
          />
          <SegmentedControl
            label="Weight unit"
            testId="home-weight-unit"
            value={weightUnit}
            options={unitOptions}
            onChange={setWeightUnit}
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <TodayCard date={today} weightUnit={weightUnit} onOpen={() => openDay(today)} />
          <WeekCard stats={weekStats} calorieGoal={goals.calories} />
          <LatestWeightCard weights={weights} weightUnit={weightUnit} className="sm:col-span-2" />
        </div>

        <div className="card grid gap-2 p-3" data-testid="home-mini-calendar">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h2 className="text-sm font-semibold tracking-tight">This month</h2>
            <button
              type="button"
              onClick={() => setView('calendar')}
              className="text-xs font-medium text-accent hover:text-accent-strong"
            >
              Full calendar
            </button>
          </div>
          <CalendarView compact />
        </div>
      </div>

      <article className="card grid gap-3 p-4" data-testid="home-chart">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-sm font-semibold tracking-tight">Trends</h2>
            {chart === 'weight' && weightTrend ? (
              <p className="text-xs text-muted tabular-nums">
                Avg {formatDisplayWeight(weightTrend.mean, weightUnit)}
                {' · '}
                trend {weightTrend.slopePerDay >= 0 ? '+' : ''}
                {roundWeight(weightTrend.slopePerDay, weightUnit).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{' '}
                {weightUnitLabel(weightUnit)}/day
              </p>
            ) : null}
            {chart === 'delta' && goals.calories > 0 ? (
              <p className="text-xs text-muted tabular-nums">
                Goal {formatCalories(goals.calories)} kcal
                {deltaPoints.length > 0
                  ? ` · latest ${formatShortDate(deltaPoints[deltaPoints.length - 1]!.date)}`
                  : ''}
              </p>
            ) : null}
          </div>
          <SegmentedControl
            label="Chart"
            testId="home-chart-switch"
            value={chart}
            options={chartOptions}
            onChange={setChart}
          />
        </div>

        {chart === 'weight' ? (
          <>
            <LineChart
              testId="weight-chart"
              points={weightPoints}
              showTrendline
              showAverage
              valueLabel={(value) => formatDisplayWeight(value, weightUnit)}
              emptyMessage="Log a weigh-in on a day to see weight over time."
            />
          </>
        ) : null}

        {chart === 'calories' ? (
          <LineChart
            testId="calorie-chart"
            points={caloriePoints}
            valueLabel={(value) => `${formatCalories(value)} kcal`}
            emptyMessage="Log food on a day to see calorie intake."
          />
        ) : null}

        {chart === 'delta' ? (
          <>
            <BarChart
              testId="calorie-delta-chart"
              points={deltaPoints}
              valueLabel={(value) => {
                const abs = formatCalories(Math.abs(value));
                if (value > 0) return `${abs} kcal over`;
                if (value < 0) return `${abs} kcal under`;
                return 'On goal';
              }}
              emptyMessage={
                goals.calories > 0
                  ? 'Log food on a day to see overages and underages.'
                  : 'Set a calorie goal in Settings to chart overages and underages.'
              }
            />
            <p className="text-xs text-subtle">
              Bars above zero are over budget; bars below are under.
            </p>
          </>
        ) : null}
      </article>
    </section>
  );
}

type WeekStats = {
  loggedDays: number;
  avgCalories: number | null;
  under: number;
  onGoal: number;
  over: number;
  streak: number;
};

function computeWeekStats(
  days: Record<DateKey, FoodEntry[]>,
  calorieGoal: number,
  today: DateKey,
): WeekStats {
  const start = addDays(today, -6);
  let loggedDays = 0;
  let calorieSum = 0;
  let under = 0;
  let onGoal = 0;
  let over = 0;

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(start, offset);
    const entries = days[date];
    if (!entries || entries.length === 0) continue;
    loggedDays += 1;
    const calories = sumEntries(entries).calories;
    calorieSum += calories;
    if (calorieGoal > 0) {
      const delta = calories - calorieGoal;
      if (delta > 0) over += 1;
      else if (delta < 0) under += 1;
      else onGoal += 1;
    }
  }

  let streak = 0;
  for (let offset = 0; ; offset += 1) {
    const date = addDays(today, -offset);
    if ((days[date]?.length ?? 0) === 0) break;
    streak += 1;
    if (offset > 365) break;
  }

  return {
    loggedDays,
    avgCalories: loggedDays > 0 ? Math.round(calorieSum / loggedDays) : null,
    under,
    onGoal,
    over,
    streak,
  };
}

function TodayCard({
  date,
  weightUnit,
  onOpen,
}: {
  date: DateKey;
  weightUnit: WeightUnit;
  onOpen: () => void;
}) {
  const budget = useDayBudget(date);
  const weightKg = useDayWeightKg(date);

  return (
    <button
      type="button"
      data-testid="home-today-card"
      onClick={onOpen}
      className="card grid gap-2 p-4 text-left transition-colors hover:border-accent-border hover:bg-accent-faint"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Today</h2>
        <span className="text-xs text-subtle">{formatLongDate(date)}</span>
      </div>
      <p
        className={[
          'text-2xl font-semibold tabular-nums',
          budget.calories.isOver ? 'text-danger' : 'text-ink',
        ].join(' ')}
      >
        {budget.calories.hasGoal
          ? budget.calories.isOver
            ? `${formatCalories(budget.calories.overBy)} over`
            : `${formatCalories(budget.calories.remaining)} left`
          : `${formatCalories(budget.totals.calories)} kcal`}
      </p>
      <p className="text-xs text-muted tabular-nums">
        {budget.totals.entryCount === 0
          ? 'Nothing logged yet.'
          : `${budget.totals.entryCount} ${budget.totals.entryCount === 1 ? 'entry' : 'entries'} · ${formatCalories(budget.totals.calories)} kcal`}
        {weightKg !== undefined
          ? ` · ${formatDisplayWeight(fromCanonicalKg(weightKg, weightUnit), weightUnit)}`
          : ''}
      </p>
    </button>
  );
}

function WeekCard({ stats, calorieGoal }: { stats: WeekStats; calorieGoal: number }) {
  return (
    <div data-testid="home-week-card" className="card grid gap-2 p-4">
      <h2 className="text-sm font-semibold tracking-tight">Last 7 days</h2>
      <p className="text-2xl font-semibold tabular-nums">
        {stats.loggedDays}
        <span className="text-base font-medium text-muted"> / 7 logged</span>
      </p>
      <p className="text-xs text-muted tabular-nums">
        {stats.avgCalories !== null
          ? `Avg ${formatCalories(stats.avgCalories)} kcal`
          : 'No food logged this week'}
        {calorieGoal > 0 && stats.loggedDays > 0
          ? ` · ${stats.under} under · ${stats.over} over`
          : ''}
        {stats.streak > 0 ? ` · ${stats.streak}-day streak` : ''}
      </p>
    </div>
  );
}

function LatestWeightCard({
  weights,
  weightUnit,
  className,
}: {
  weights: Record<DateKey, number>;
  weightUnit: WeightUnit;
  className?: string;
}) {
  const series = useMemo(() => weightSeries(weights), [weights]);
  const latest = series.at(-1);
  const previous = series.at(-2);
  const delta =
    latest && previous
      ? fromCanonicalKg(latest.value, weightUnit) - fromCanonicalKg(previous.value, weightUnit)
      : null;

  return (
    <div
      data-testid="home-weight-card"
      className={['card grid gap-2 p-4', className].filter(Boolean).join(' ')}
    >
      <h2 className="text-sm font-semibold tracking-tight">Latest weight</h2>
      {latest ? (
        <>
          <p className="text-2xl font-semibold tabular-nums">
            {formatDisplayWeight(fromCanonicalKg(latest.value, weightUnit), weightUnit)}
          </p>
          <p className="text-xs text-muted tabular-nums">
            {formatShortDate(latest.date)}
            {delta !== null
              ? ` · ${delta >= 0 ? '+' : ''}${roundWeight(delta, weightUnit).toLocaleString(
                  undefined,
                  {
                    maximumFractionDigits: weightUnit === 'lb' ? 1 : 2,
                  },
                )} ${weightUnitLabel(weightUnit)} vs prior`
              : ' · first weigh-in'}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">No weigh-ins yet. Open a day to log one.</p>
      )}
    </div>
  );
}
