import { useMemo, useState, type ReactNode } from 'react';
import { LineChart, type ChartSeries } from '../components/charts/LineChart';
import { MacroSettings } from '../components/settings/MacroSettings';
import { NumberField } from '../components/settings/NumberField';
import { SettingsSection } from '../components/settings/SettingsSection';
import {
  addDays,
  ageYearsFromBirthday,
  daysBetween,
  formatShortDate,
  fromDateKey,
  todayKey,
} from '../lib/dates';
import {
  fromCanonicalCm,
  heightUnitForWeightUnit,
  heightUnitLabel,
  roundHeight,
  toCanonicalCm,
} from '../lib/height';
import {
  ACTIVITY_OPTIONS,
  LOGGED_INTAKE_LOOKBACK_DAYS,
  averageLoggedIntake,
  projectWeightLoss,
  type ActivityMultiplier,
  type ProjectionResult,
  type ProjectionRow,
} from '../lib/projection';
import { weightNearDate, weightSeries, type DatedPoint } from '../lib/series';
import { formatCalories } from '../lib/totals';
import { fromCanonicalKg, roundWeight, toCanonicalKg, weightUnitLabel } from '../lib/weight';
import { useAppStore } from '../store/useAppStore';
import { useGoals, useProjectionProfile, useWeightUnit, useWeights } from '../store/selectors';
import type { DateKey, WeightUnit } from '../types';

const START_MODES = [
  { value: 'weight', label: 'Weight' },
  { value: 'date', label: 'Date' },
] as const;

const END_MODES = [
  { value: '13', label: '3 mo', weeks: 13 },
  { value: '26', label: '6 mo', weeks: 26 },
  { value: '52', label: '1 yr', weeks: 52 },
  { value: 'goal', label: 'Goal' },
  { value: 'date', label: 'Date' },
] as const;

type StartMode = (typeof START_MODES)[number]['value'];
type EndMode = (typeof END_MODES)[number]['value'];
type IntakeKey = 'goal' | 'logged';

type Scenario = {
  id: string;
  intake: IntakeKey;
  label: string;
  intakeKcal: number;
  result: ProjectionResult;
  className: string;
  strokeDasharray?: string;
};

const INTAKE_META: Record<IntakeKey, { label: string; shortLabel: string }> = {
  goal: { label: 'Goal', shortLabel: 'Goal' },
  logged: { label: 'Logged avg', shortLabel: 'Logged' },
};

const SCENARIO_STYLE: Record<
  string,
  { className: string; strokeDasharray?: string; showDots?: boolean }
> = {
  goal: { className: 'stroke-accent', showDots: true },
  logged: { className: 'stroke-accent-muted', strokeDasharray: '7 4' },
};

function formatDisplayWeight(value: number, unit: WeightUnit): string {
  return `${roundWeight(value, unit).toLocaleString(undefined, {
    maximumFractionDigits: unit === 'lb' ? 1 : 2,
  })} ${weightUnitLabel(unit)}`;
}

function weeksBetween(start: DateKey, end: DateKey): number {
  return Math.max(1, Math.floor(daysBetween(start, end) / 7));
}

function endModeWeeks(mode: EndMode): number | undefined {
  const match = END_MODES.find((option) => option.value === mode);
  return match && 'weeks' in match ? match.weeks : undefined;
}

function toChartPoints(
  result: ProjectionResult,
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
 * driven by body profile, planned intake, and optional food/weigh-in logs.
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

/** Weight-loss projection form, multi-series chart, and weekly table. */
function WeightProjectionSection() {
  const profile = useProjectionProfile();
  const goals = useGoals();
  const weightUnit = useWeightUnit();
  const weights = useWeights();
  const days = useAppStore((state) => state.days);
  const setProjectionProfile = useAppStore((state) => state.setProjectionProfile);

  const heightUnit = heightUnitForWeightUnit(weightUnit);
  const today = todayKey();
  const latestWeightKg = useMemo(() => weightSeries(weights).at(-1)?.value, [weights]);

  const [startMode, setStartMode] = useState<StartMode>('weight');
  const [endMode, setEndMode] = useState<EndMode>('52');
  const [startDate, setStartDate] = useState<DateKey>(today);
  const [endDate, setEndDate] = useState<DateKey>(() => addDays(today, 364));
  const [startWeightDisplay, setStartWeightDisplay] = useState<number | undefined>(() =>
    latestWeightKg !== undefined
      ? roundWeight(fromCanonicalKg(latestWeightKg, weightUnit), weightUnit)
      : undefined,
  );
  const [goalWeightDisplay, setGoalWeightDisplay] = useState<number | undefined>(undefined);
  const [showGoal, setShowGoal] = useState(true);
  const [showLogged, setShowLogged] = useState(false);
  const [showWeighIns, setShowWeighIns] = useState(true);

  const [lastWeightUnit, setLastWeightUnit] = useState(weightUnit);
  if (lastWeightUnit !== weightUnit) {
    setLastWeightUnit(weightUnit);
    if (startWeightDisplay !== undefined) {
      const kg = toCanonicalKg(startWeightDisplay, lastWeightUnit);
      setStartWeightDisplay(roundWeight(fromCanonicalKg(kg, weightUnit), weightUnit));
    }
    if (goalWeightDisplay !== undefined) {
      const kg = toCanonicalKg(goalWeightDisplay, lastWeightUnit);
      setGoalWeightDisplay(roundWeight(fromCanonicalKg(kg, weightUnit), weightUnit));
    }
  }

  const usingStartDate = startMode === 'date';
  const usingEndDate = endMode === 'date';
  const usingGoalWeight = endMode === 'goal';
  const resolvedStartDate: DateKey = usingStartDate ? startDate : today;

  const loggedIntake = useMemo(
    () => averageLoggedIntake(days, resolvedStartDate, LOGGED_INTAKE_LOOKBACK_DAYS),
    [days, resolvedStartDate],
  );

  const startWeightPoint = useMemo(
    () => (usingStartDate ? weightNearDate(weights, startDate) : undefined),
    [usingStartDate, weights, startDate],
  );

  const startWeightKg = usingStartDate
    ? startWeightPoint?.value
    : startWeightDisplay !== undefined
      ? toCanonicalKg(startWeightDisplay, weightUnit)
      : undefined;

  const goalWeightKg =
    usingGoalWeight && goalWeightDisplay !== undefined
      ? toCanonicalKg(goalWeightDisplay, weightUnit)
      : undefined;

  const heightDisplay =
    profile.heightCm !== null && profile.heightCm !== undefined
      ? roundHeight(fromCanonicalCm(profile.heightCm, heightUnit), heightUnit)
      : undefined;

  const ageYears =
    profile.birthday !== null
      ? ageYearsFromBirthday(profile.birthday, fromDateKey(resolvedStartDate))
      : null;

  const goalIntake = goals.calories > 0 ? goals.calories : undefined;
  const loggedIntakeKcal = loggedIntake?.averageKcal;

  const useGoal = showGoal && goalIntake !== undefined;
  const useLogged = showLogged && loggedIntakeKcal !== undefined;

  const dateRangeValid = !usingEndDate || daysBetween(resolvedStartDate, endDate) >= 7;
  const goalWeightValid =
    !usingGoalWeight ||
    (goalWeightKg !== undefined &&
      goalWeightKg > 0 &&
      startWeightKg !== undefined &&
      Math.abs(goalWeightKg - startWeightKg) >= 0.05);

  const weeksForEndDate = usingEndDate
    ? weeksBetween(resolvedStartDate, endDate)
    : endModeWeeks(endMode);

  const profileReady =
    profile.sex !== null &&
    ageYears !== null &&
    profile.heightCm !== null &&
    startWeightKg !== undefined &&
    startWeightKg > 0 &&
    dateRangeValid &&
    goalWeightValid;

  const anyIntakeOn = useGoal || useLogged;
  const ready = profileReady && anyIntakeOn;

  const scenarios = useMemo((): Scenario[] => {
    if (!ready || !profile.sex || ageYears === null || profile.heightCm === null) return [];
    if (startWeightKg === undefined) return [];

    const intakes: Array<{ key: IntakeKey; kcal: number }> = [];
    if (useGoal && goalIntake !== undefined) intakes.push({ key: 'goal', kcal: goalIntake });
    if (useLogged && loggedIntakeKcal !== undefined) {
      intakes.push({ key: 'logged', kcal: loggedIntakeKcal });
    }

    const out: Scenario[] = [];
    for (const intake of intakes) {
      const result = projectWeightLoss({
        sex: profile.sex,
        ageYears,
        heightCm: profile.heightCm,
        startWeightKg,
        activity: profile.activity,
        intakeKcal: intake.kcal,
        startDate: resolvedStartDate,
        ...(usingGoalWeight && goalWeightKg !== undefined
          ? { goalWeightKg }
          : { weeks: weeksForEndDate ?? 52 }),
      });

      const style = SCENARIO_STYLE[intake.key] ?? { className: 'stroke-accent' };
      out.push({
        id: intake.key,
        intake: intake.key,
        label: INTAKE_META[intake.key].shortLabel,
        intakeKcal: intake.kcal,
        result,
        className: style.className,
        strokeDasharray: style.strokeDasharray,
      });
    }

    return out;
  }, [
    ready,
    profile.sex,
    profile.heightCm,
    profile.activity,
    ageYears,
    startWeightKg,
    resolvedStartDate,
    usingGoalWeight,
    goalWeightKg,
    weeksForEndDate,
    useGoal,
    useLogged,
    goalIntake,
    loggedIntakeKcal,
  ]);

  const primary = scenarios[0] ?? null;
  const resolvedEndDate = primary?.result.rows.length
    ? primary.result.rows[primary.result.rows.length - 1]!.date
    : addDays(resolvedStartDate, (weeksForEndDate ?? 52) * 7);

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
        className: scenario.className,
        strokeDasharray: scenario.strokeDasharray,
        strokeWidth: scenario === primary ? 2.75 : 2,
        showDots: style.showDots === true && scenario === primary,
      };
    });

    if (showWeighIns && actualWeightPoints.length >= 2) {
      series.push({
        id: 'weigh-ins',
        points: actualWeightPoints,
        className: 'stroke-muted',
        strokeDasharray: '2 4',
        strokeWidth: 1.75,
      });
    }

    return series;
  }, [
    scenarios,
    startWeightKg,
    weightUnit,
    resolvedStartDate,
    showWeighIns,
    actualWeightPoints,
    primary,
  ]);

  const endWeightLabel = usingEndDate
    ? formatShortDate(resolvedEndDate)
    : usingGoalWeight
      ? primary?.result.goalReached
        ? 'Goal'
        : 'At cap'
      : (END_MODES.find((option) => option.value === endMode)?.label ??
        formatShortDate(resolvedEndDate));

  const incompleteReason = !profileReady
    ? !dateRangeValid
      ? 'End date must be at least one week after the start.'
      : startWeightKg === undefined
        ? usingStartDate
          ? 'No weigh-in found for the start date.'
          : 'Enter a starting weight.'
        : !goalWeightValid
          ? 'Enter a goal weight different from the start.'
          : 'Fill in sex, birthday, and height.'
    : !anyIntakeOn
      ? 'Turn on Goal or Logged avg on the chart.'
      : null;

  const fieldClassName =
    'mt-1 w-full rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink focus:border-accent-border focus:outline-none';
  const inlineFieldClassName =
    'w-full min-w-0 rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink focus:border-accent-border focus:outline-none';

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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="w-10 shrink-0 text-xs font-medium tracking-wide text-muted uppercase">
                Start
              </span>
              <ModeTabs
                label="Start by"
                testId="projection-start-mode"
                value={startMode}
                options={START_MODES}
                onChange={setStartMode}
              />
              {usingStartDate ? (
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
                  <input
                    id="projection-start-date"
                    data-testid="projection-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      const next = event.target.value as DateKey;
                      setStartDate(next);
                      if (usingEndDate && daysBetween(next, endDate) < 7) {
                        setEndMode('52');
                      }
                    }}
                    className={inlineFieldClassName}
                  />
                  <p
                    data-testid="projection-start-weight"
                    className="shrink-0 text-sm tabular-nums text-ink"
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
                  onCommit={(value) => setStartWeightDisplay(value)}
                  className="w-full min-w-[9rem] sm:w-40 [&>div]:mt-0"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="w-10 shrink-0 text-xs font-medium tracking-wide text-muted uppercase">
                End
              </span>
              <ModeTabs
                label="End by"
                testId="projection-end-mode"
                value={endMode}
                options={END_MODES}
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
                    setEndDate(next);
                  }}
                  className={`${inlineFieldClassName} w-full min-w-[9rem] sm:w-40`}
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
                  onCommit={(value) => setGoalWeightDisplay(value)}
                  className="w-full min-w-[9rem] sm:w-40 [&>div]:mt-0"
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
                      className={scenario.className}
                      dashed={Boolean(scenario.strokeDasharray)}
                    />
                    {scenario.label}
                  </li>
                ))}
                {showWeighIns && actualWeightPoints.length >= 2 ? (
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
                  {endWeightLabel}
                </dt>
                <dd className="mt-1 text-sm tabular-nums text-ink">
                  {formatDisplayWeight(
                    fromCanonicalKg(
                      primary.result.rows[primary.result.rows.length - 1]!.weightKg,
                      weightUnit,
                    ),
                    weightUnit,
                  )}
                </dd>
              </div>
            </dl>

            <div className="grid gap-2" data-testid="projection-series-toggles">
              <SeriesToggleGroup label="Intake">
                <SeriesToggle
                  testId="projection-series-goal"
                  label={INTAKE_META.goal.label}
                  pressed={showGoal}
                  disabled={goalIntake === undefined}
                  title={
                    goalIntake === undefined
                      ? 'Set a calorie goal above'
                      : `${formatCalories(goalIntake)} kcal/day`
                  }
                  onClick={() => setShowGoal((value) => !value)}
                />
                <SeriesToggle
                  testId="projection-series-logged"
                  label={INTAKE_META.logged.label}
                  pressed={showLogged}
                  disabled={loggedIntakeKcal === undefined}
                  title={
                    loggedIntake
                      ? `${formatCalories(loggedIntake.averageKcal)} kcal/day`
                      : `No food logged in the last ${LOGGED_INTAKE_LOOKBACK_DAYS} days`
                  }
                  onClick={() => setShowLogged((value) => !value)}
                />
                <SeriesToggle
                  testId="projection-series-weigh-ins"
                  label="Weigh-ins"
                  pressed={showWeighIns}
                  disabled={actualWeightPoints.length < 2}
                  title={
                    actualWeightPoints.length < 2
                      ? 'Log at least two weigh-ins'
                      : 'Logged weigh-ins overlay'
                  }
                  onClick={() => setShowWeighIns((value) => !value)}
                />
              </SeriesToggleGroup>
            </div>

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

          <article className="card overflow-hidden p-0" data-testid="projection-table">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Weekly table</h2>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead className="sticky top-0 bg-surface text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Weight</th>
                    <th className="px-4 py-2 font-medium text-right">Used</th>
                    <th className="px-4 py-2 font-medium text-right">Deficit</th>
                  </tr>
                </thead>
                <tbody>
                  {primary.result.rows.map((row) => (
                    <tr key={row.date} className="border-t border-line tabular-nums">
                      <td className="px-4 py-1.5 text-ink">{formatShortDate(row.date)}</td>
                      <td className="px-4 py-1.5 text-ink">
                        {formatDisplayWeight(fromCanonicalKg(row.weightKg, weightUnit), weightUnit)}
                      </td>
                      <td className="px-4 py-1.5 text-right text-ink">
                        {formatCalories(Math.round(row.maintenanceKcal))}
                      </td>
                      <td
                        className={[
                          'px-4 py-1.5 text-right',
                          row.deficitKcal >= 0 ? 'text-ink' : 'text-danger',
                        ].join(' ')}
                      >
                        {row.deficitKcal >= 0 ? '' : '−'}
                        {formatCalories(Math.round(Math.abs(row.deficitKcal)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  );
}

function ModeTabs<T extends string>({
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
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className="inline-flex flex-wrap items-end gap-x-3 gap-y-1 border-b border-line"
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
              '-mb-px border-b-2 px-0.5 pb-1.5 text-sm transition-colors',
              selected
                ? 'border-accent font-medium text-ink'
                : 'border-transparent text-muted hover:text-ink',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
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

function SeriesToggleGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function SeriesToggle({
  label,
  pressed,
  disabled,
  title,
  onClick,
  testId,
}: {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={[
        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
        disabled
          ? 'cursor-not-allowed border-line text-subtle opacity-60'
          : pressed
            ? 'border-accent-border bg-accent-soft text-ink'
            : 'border-line bg-raised text-muted hover:border-accent-border hover:text-ink',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
