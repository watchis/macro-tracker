import { useMemo } from 'react';
import { LineChart, type ChartSeries } from '../components/charts/LineChart';
import { ProjectionWeeklyTable } from '../components/ProjectionWeeklyTable';
import { MacroSettings } from '../components/settings/MacroSettings';
import { NumberField } from '../components/settings/NumberField';
import { SettingsSection } from '../components/settings/SettingsSection';
import { addDays, daysBetween, formatShortDate, todayKey } from '../lib/dates';
import {
  fromCanonicalCm,
  heightUnitForWeightUnit,
  heightUnitLabel,
  roundHeight,
  toCanonicalCm,
} from '../lib/height';
import {
  ACTIVITY_OPTIONS,
  PROJECTION_END_MODES,
  PROJECTION_START_MODES,
  type ActivityMultiplier,
  type ProjectionRow,
} from '../lib/projection';
import { weightNearDate, weightSeries, type DatedPoint } from '../lib/series';
import { formatCalories } from '../lib/totals';
import { fromCanonicalKg, roundWeight, toCanonicalKg, weightUnitLabel } from '../lib/weight';
import { useWeightProjection } from '../hooks/useWeightProjection';
import { useAppStore } from '../store/useAppStore';
import { useProjectionProfile, useWeightUnit, useWeights } from '../store/selectors';
import type { DateKey, ProjectionEndMode, ProjectionStartMode, WeightUnit } from '../types';

const SCENARIO_STYLE: Record<
  string,
  { className: string; strokeDasharray?: string; showDots?: boolean }
> = {
  goal: { className: 'stroke-accent', showDots: true },
};

function formatDisplayWeight(value: number, unit: WeightUnit): string {
  return `${roundWeight(value, unit).toLocaleString(undefined, {
    maximumFractionDigits: unit === 'lb' ? 1 : 2,
  })} ${weightUnitLabel(unit)}`;
}

function toChartPoints(
  result: { rows: ProjectionRow[] },
  startWeightKg: number,
  weightUnit: WeightUnit,
  startDate: DateKey,
): DatedPoint[] {
  const start = {
    date: startDate,
    t: Date.parse(`${startDate}T00:00:00`),
    value: fromCanonicalKg(startWeightKg, weightUnit),
  };
  return [
    start,
    ...result.rows.map((row) => ({
      date: row.date,
      t: Date.parse(`${row.date}T00:00:00`),
      value: fromCanonicalKg(row.weightKg, weightUnit),
    })),
  ];
}

/**
 * Goals tab: calorie/macro targets plus a LoserTown-style weight projection
 * driven by body profile, calorie goal, and optional weigh-in logs.
 */
export function GoalsView() {
  return (
    <div className="grid gap-5" data-testid="goals-view">
      <h1 className="text-xl font-semibold tracking-tight">Goals</h1>

      <SettingsSection id="goals" title="Goals and macros">
        <MacroSettings />
      </SettingsSection>

      <WeightProjectionSection />
    </div>
  );
}

/** Weight-loss projection form, chart (goal + weigh-ins), and weekly table. */
function WeightProjectionSection() {
  const profile = useProjectionProfile();
  const weightUnit = useWeightUnit();
  const weights = useWeights();
  const setProjectionProfile = useAppStore((state) => state.setProjectionProfile);

  const projection = useWeightProjection();

  const heightUnit = heightUnitForWeightUnit(weightUnit);
  const today = todayKey();
  const latestWeightKg = useMemo(() => weightSeries(weights).at(-1)?.value, [weights]);

  const startMode = profile.startMode;
  const endMode = profile.endMode;
  const usingStartDate = startMode === 'date';
  const usingEndDate = endMode === 'date';
  const usingGoalWeight = endMode === 'goal';

  const startDate = profile.startDate ?? today;
  const endDate = profile.endDate ?? addDays(today, 364);

  const startWeightPoint = useMemo(
    () => (usingStartDate ? weightNearDate(weights, startDate) : undefined),
    [usingStartDate, weights, startDate],
  );

  const startWeightDisplay =
    profile.startWeightKg !== null
      ? roundWeight(fromCanonicalKg(profile.startWeightKg, weightUnit), weightUnit)
      : latestWeightKg !== undefined
        ? roundWeight(fromCanonicalKg(latestWeightKg, weightUnit), weightUnit)
        : undefined;

  const goalWeightDisplay =
    profile.goalWeightKg !== null
      ? roundWeight(fromCanonicalKg(profile.goalWeightKg, weightUnit), weightUnit)
      : undefined;

  const heightDisplay =
    profile.heightCm !== null && profile.heightCm !== undefined
      ? roundHeight(fromCanonicalCm(profile.heightCm, heightUnit), heightUnit)
      : undefined;

  const {
    ready,
    primary,
    scenarios,
    incompleteReason,
    resolvedStartDate,
    resolvedEndDate,
    startWeightKg,
    ageYears,
  } = projection;

  const rowByDate = useMemo(() => {
    const map = new Map<DateKey, ProjectionRow>();
    if (!primary) return map;
    for (const row of primary.result.rows) map.set(row.date, row);
    return map;
  }, [primary]);

  const actualWeightPoints = useMemo(
    () =>
      weightSeries(weights).map((point) => ({
        ...point,
        value: fromCanonicalKg(point.value, weightUnit),
      })),
    [weights, weightUnit],
  );

  const chartSeries = useMemo((): ChartSeries[] => {
    if (startWeightKg === undefined) return [];
    const series: ChartSeries[] = scenarios.map((scenario) => {
      const style = SCENARIO_STYLE[scenario.id] ?? { className: 'stroke-accent' };
      return {
        id: scenario.id,
        points: toChartPoints(scenario.result, startWeightKg, weightUnit, resolvedStartDate),
        className: style.className,
        strokeDasharray: style.strokeDasharray,
        strokeWidth: scenario === primary ? 2.75 : 2,
        showDots: style.showDots === true && scenario === primary,
      };
    });

    if (actualWeightPoints.length >= 2) {
      series.push({
        id: 'weigh-ins',
        points: actualWeightPoints,
        className: 'stroke-muted',
        strokeDasharray: '2 4',
        strokeWidth: 1.75,
      });
    }

    return series;
  }, [scenarios, startWeightKg, weightUnit, resolvedStartDate, actualWeightPoints, primary]);

  const endStatLabel = usingEndDate
    ? formatShortDate(resolvedEndDate)
    : usingGoalWeight
      ? primary?.result.goalReached
        ? 'Goal'
        : 'At cap'
      : (PROJECTION_END_MODES.find((option) => option.value === endMode)?.label ??
        formatShortDate(resolvedEndDate));

  const endStatValue = usingGoalWeight
    ? formatShortDate(resolvedEndDate)
    : primary
      ? formatDisplayWeight(
          fromCanonicalKg(
            primary.result.rows[primary.result.rows.length - 1]!.weightKg,
            weightUnit,
          ),
          weightUnit,
        )
      : '—';

  const fieldClassName =
    'mt-1 w-full rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink focus:border-accent-border focus:outline-none';

  const setStartMode = (mode: ProjectionStartMode) => {
    const patch: Partial<typeof profile> = { startMode: mode };
    if (mode === 'date' && profile.startDate === null) {
      patch.startDate = today;
    }
    setProjectionProfile(patch);
  };

  const setEndMode = (mode: ProjectionEndMode) => {
    const patch: Partial<typeof profile> = { endMode: mode };
    if (mode === 'date' && profile.endDate === null) {
      patch.endDate = addDays(resolvedStartDate, 364);
    }
    setProjectionProfile(patch);
  };

  return (
    <section className="grid gap-5" data-testid="projection-section">
      <SettingsSection id="projection" title="Weight projection">
        <div className="grid gap-6" data-testid="projection-form">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="projection-sex"
                className="block text-xs font-medium tracking-wide text-muted uppercase"
              >
                Sex
              </label>
              <select
                id="projection-sex"
                data-testid="projection-sex"
                value={profile.sex ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setProjectionProfile({
                    sex: value === 'male' || value === 'female' ? value : null,
                  });
                }}
                className={fieldClassName}
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="projection-birthday"
                className="block text-xs font-medium tracking-wide text-muted uppercase"
              >
                Birthday
              </label>
              <input
                id="projection-birthday"
                type="date"
                data-testid="projection-birthday"
                value={profile.birthday ?? ''}
                max={today}
                onChange={(event) => {
                  const value = event.target.value;
                  setProjectionProfile({ birthday: value ? (value as DateKey) : null });
                }}
                className={fieldClassName}
              />
              {ageYears !== null ? (
                <p className="mt-1 text-xs text-subtle" data-testid="projection-age-hint">
                  Age {ageYears}
                </p>
              ) : null}
            </div>

            <NumberField
              label="Height"
              testId="projection-height"
              value={heightDisplay}
              unit={heightUnitLabel(heightUnit)}
              min={heightUnit === 'in' ? 20 : 50}
              max={heightUnit === 'in' ? 108 : 275}
              allowEmpty
              placeholder="Required"
              onCommit={(value) =>
                setProjectionProfile({
                  heightCm: value === undefined ? null : toCanonicalCm(value, heightUnit),
                })
              }
            />

            <div>
              <label
                htmlFor="projection-activity"
                className="block text-xs font-medium tracking-wide text-muted uppercase"
              >
                Activity
              </label>
              <select
                id="projection-activity"
                data-testid="projection-activity"
                value={String(profile.activity)}
                onChange={(event) =>
                  setProjectionProfile({
                    activity: Number(event.target.value) as ActivityMultiplier,
                  })
                }
                className={fieldClassName}
              >
                {ACTIVITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.shortLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 border-t border-line pt-5">
            <div className="grid gap-2 sm:max-w-md">
              <ModeChipGroup
                label="Start"
                testId="projection-start-mode"
                value={startMode}
                options={PROJECTION_START_MODES}
                onChange={setStartMode}
              />
              {usingStartDate ? (
                <div className="flex items-center gap-2">
                  <input
                    id="projection-start-date"
                    data-testid="projection-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      const next = event.target.value as DateKey;
                      const patch: Partial<typeof profile> = { startDate: next };
                      if (usingEndDate && daysBetween(next, endDate) < 7) {
                        patch.endMode = '52';
                      }
                      setProjectionProfile(patch);
                    }}
                    className={fieldClassName}
                  />
                  <p
                    data-testid="projection-start-weight"
                    className="mt-1 shrink-0 text-sm tabular-nums text-ink"
                  >
                    {startWeightPoint
                      ? formatDisplayWeight(
                          fromCanonicalKg(startWeightPoint.value, weightUnit),
                          weightUnit,
                        )
                      : '—'}
                  </p>
                </div>
              ) : (
                <NumberField
                  label="Starting weight"
                  labelHidden
                  testId="projection-weight"
                  value={startWeightDisplay}
                  unit={weightUnitLabel(weightUnit)}
                  min={1}
                  max={weightUnit === 'lb' ? 1000 : 450}
                  allowEmpty
                  placeholder={latestWeightKg !== undefined ? 'Latest weigh-in' : 'Required'}
                  onCommit={(value) =>
                    setProjectionProfile({
                      startWeightKg: value === undefined ? null : toCanonicalKg(value, weightUnit),
                    })
                  }
                />
              )}
            </div>

            <div className="grid gap-2 sm:max-w-md">
              <ModeChipGroup
                label="End"
                testId="projection-end-mode"
                value={endMode}
                options={PROJECTION_END_MODES}
                onChange={setEndMode}
              />
              {usingEndDate ? (
                <input
                  id="projection-end-date"
                  data-testid="projection-end-date"
                  type="date"
                  value={endDate}
                  min={addDays(resolvedStartDate, 7)}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const next = event.target.value as DateKey;
                    if (daysBetween(resolvedStartDate, next) < 7) return;
                    setProjectionProfile({ endDate: next });
                  }}
                  className={fieldClassName}
                />
              ) : null}
              {usingGoalWeight ? (
                <NumberField
                  label="Goal weight"
                  labelHidden
                  testId="projection-goal-weight"
                  value={goalWeightDisplay}
                  unit={weightUnitLabel(weightUnit)}
                  min={1}
                  max={weightUnit === 'lb' ? 1000 : 450}
                  allowEmpty
                  placeholder="Goal weight"
                  onCommit={(value) =>
                    setProjectionProfile({
                      goalWeightKg: value === undefined ? null : toCanonicalKg(value, weightUnit),
                    })
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      </SettingsSection>

      {!ready || !primary ? (
        <div
          data-testid="projection-incomplete"
          className="card flex items-center justify-center px-5 py-8 text-sm text-muted"
        >
          {incompleteReason ?? 'Fill in sex, birthday, and height.'}
        </div>
      ) : (
        <>
          <article className="card grid gap-4 p-5" data-testid="projection-chart">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight">Projected weight</h2>
              <ul
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
                data-testid="projection-series-legend"
                aria-label="Chart key"
              >
                {scenarios.map((scenario) => (
                  <li key={scenario.id} className="inline-flex items-center gap-1.5">
                    <SeriesSwatch
                      className={SCENARIO_STYLE[scenario.id]?.className ?? 'stroke-accent'}
                      dashed={Boolean(SCENARIO_STYLE[scenario.id]?.strokeDasharray)}
                    />
                    {scenario.label}
                  </li>
                ))}
                {actualWeightPoints.length >= 2 ? (
                  <li className="inline-flex items-center gap-1.5">
                    <SeriesSwatch className="stroke-muted" dashed />
                    Weigh-ins
                  </li>
                ) : null}
              </ul>
            </div>

            <dl className="grid grid-cols-3 gap-3">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted uppercase">
                  Healthy BMI
                </dt>
                <dd className="mt-1 text-sm tabular-nums text-ink">
                  {formatDisplayWeight(
                    fromCanonicalKg(primary.result.healthyWeightKg.min, weightUnit),
                    weightUnit,
                  )}{' '}
                  –{' '}
                  {formatDisplayWeight(
                    fromCanonicalKg(primary.result.healthyWeightKg.max, weightUnit),
                    weightUnit,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted uppercase">
                  Equilibrium
                </dt>
                <dd className="mt-1 text-sm tabular-nums text-ink">
                  {primary.result.equilibriumWeightKg > 0
                    ? formatDisplayWeight(
                        fromCanonicalKg(primary.result.equilibriumWeightKg, weightUnit),
                        weightUnit,
                      )
                    : 'Below zero'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted uppercase">
                  {endStatLabel}
                </dt>
                <dd
                  className="mt-1 text-sm tabular-nums text-ink"
                  data-testid="projection-end-stat"
                >
                  {endStatValue}
                </dd>
              </div>
            </dl>

            <LineChart
              testId="projection-weight-chart"
              series={chartSeries}
              valueLabel={(value) => formatDisplayWeight(value, weightUnit)}
              pointTooltip={(point, seriesId) => {
                if (seriesId === 'weigh-ins') {
                  return `${formatShortDate(point.date)}: ${formatDisplayWeight(point.value, weightUnit)}`;
                }
                const row = rowByDate.get(point.date);
                const weightLine = `${formatShortDate(point.date)}: ${formatDisplayWeight(point.value, weightUnit)}`;
                if (!row || seriesId !== primary.id) return weightLine;
                return [
                  weightLine,
                  `Used ${formatCalories(Math.round(row.maintenanceKcal))} kcal`,
                  `Deficit ${row.deficitKcal >= 0 ? '' : '−'}${formatCalories(Math.round(Math.abs(row.deficitKcal)))} kcal`,
                ].join('\n');
              }}
              emptyMessage="Nothing to project yet."
            />
          </article>

          <ProjectionWeeklyTable rows={primary.result.rows} weightUnit={weightUnit} />
        </>
      )}
    </section>
  );
}

function ModeChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  testId?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-10 shrink-0 text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        data-testid={testId}
        className="flex flex-wrap gap-1.5"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={[
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                selected
                  ? 'border-accent-border bg-accent-soft text-ink'
                  : 'border-line bg-raised text-muted hover:border-accent-border hover:text-ink',
              ].join(' ')}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SeriesSwatch({ className, dashed }: { className: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className={['inline-block h-0.5 w-4 rounded-full', className.replace('stroke-', 'bg-')].join(
        ' ',
      )}
      style={
        dashed
          ? {
              backgroundImage:
                'repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 5px)',
              backgroundColor: 'transparent',
            }
          : undefined
      }
    />
  );
}
