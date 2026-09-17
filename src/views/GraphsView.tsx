import { useMemo, useState } from 'react';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { SegmentedControl } from '../components/settings/SegmentedControl';
import { formatShortDate } from '../lib/dates';
import { calorieDeltaSeries, calorieSeries, linearTrend, weightSeries } from '../lib/series';
import { formatCalories } from '../lib/totals';
import { fromCanonicalKg, roundWeight, weightUnitLabel } from '../lib/weight';
import { useAppStore } from '../store/useAppStore';
import { useGoals, useWeightUnit, useWeights } from '../store/selectors';
import type { SegmentedOption } from '../components/settings/SegmentedControl';
import type { WeightUnit } from '../types';

const RANGE_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All' },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]['value'];

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
 * Trends across weigh-ins and calorie history: weight with an average trendline,
 * daily calorie intake, and overage/underage vs the calorie goal.
 */
export function GraphsView() {
  const days = useAppStore((state) => state.days);
  const weights = useWeights();
  const goals = useGoals();
  const weightUnit = useWeightUnit();
  const setWeightUnit = useAppStore((state) => state.setWeightUnit);
  const [range, setRange] = useState<RangeKey>('90');

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

  const unitOptions: ReadonlyArray<SegmentedOption<WeightUnit>> = [
    { value: 'lb', label: 'lb' },
    { value: 'kg', label: 'kg' },
  ];

  const rangeOptions: ReadonlyArray<SegmentedOption<RangeKey>> = RANGE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <section className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Graphs</h1>
          <p className="mt-0.5 text-sm text-muted">
            Weight, calories, and how you track against your goal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Date range"
            testId="graphs-range"
            value={range}
            options={rangeOptions}
            onChange={setRange}
          />
          <SegmentedControl
            label="Weight unit"
            testId="graphs-weight-unit"
            value={weightUnit}
            options={unitOptions}
            onChange={setWeightUnit}
          />
        </div>
      </header>

      <article className="card grid gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Weight over time</h2>
          {weightTrend ? (
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
        </div>
        <LineChart
          testId="weight-chart"
          points={weightPoints}
          showTrendline
          showAverage
          valueLabel={(value) => formatDisplayWeight(value, weightUnit)}
          emptyMessage="Log a weigh-in on the Day page to see weight over time."
        />
        <p className="text-xs text-subtle">
          Solid line is daily weight. Dashed accent is the trend; dotted is the average.
        </p>
      </article>

      <article className="card grid gap-3 p-4">
        <h2 className="text-sm font-semibold tracking-tight">Calorie consumption</h2>
        <LineChart
          testId="calorie-chart"
          points={caloriePoints}
          valueLabel={(value) => `${formatCalories(value)} kcal`}
          emptyMessage="Log food on the Day page to see calorie intake."
        />
      </article>

      <article className="card grid gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Calorie overages / underages</h2>
          {goals.calories > 0 ? (
            <p className="text-xs text-muted tabular-nums">
              Goal {formatCalories(goals.calories)} kcal
            </p>
          ) : null}
        </div>
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
              ? 'Log food on the Day page to see overages and underages.'
              : 'Set a calorie goal in Settings to chart overages and underages.'
          }
        />
        <p className="text-xs text-subtle">
          Bars above zero are over budget; bars below are under.
          {deltaPoints.length > 0
            ? ` Latest: ${formatShortDate(deltaPoints[deltaPoints.length - 1]!.date)}.`
            : ''}
        </p>
      </article>
    </section>
  );
}
