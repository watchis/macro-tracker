import { useMemo, useState, type ReactNode } from 'react';
import { LineChart, type ChartSeries } from '../components/charts/LineChart';
import { MacroSettings } from '../components/settings/MacroSettings';
import { NumberField } from '../components/settings/NumberField';
import { SegmentedControl } from '../components/settings/SegmentedControl';
import { SettingsSection } from '../components/settings/SettingsSection';
import {
  ageYearsFromBirthday,
  formatLongDate,
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
  activityFromMaintenance,
  averageLoggedIntake,
  estimateMaintenanceFromLogs,
  projectWeightLoss,
  type ActivityMultiplier,
  type ProjectionResult,
} from '../lib/projection';
import { weightSeries, type DatedPoint } from '../lib/series';
import { formatCalories } from '../lib/totals';
import { fromCanonicalKg, roundWeight, toCanonicalKg, weightUnitLabel } from '../lib/weight';
import { useAppStore } from '../store/useAppStore';
import { useGoals, useProjectionProfile, useWeightUnit, useWeights } from '../store/selectors';
import type { SegmentedOption } from '../components/settings/SegmentedControl';
import type { DateKey, WeightUnit } from '../types';

const WEEK_OPTIONS = [
  { value: '26', label: '6 mo' },
  { value: '52', label: '1 yr' },
  { value: '104', label: '2 yr' },
] as const;

type WeekSpan = (typeof WEEK_OPTIONS)[number]['value'];
type IntakeKey = 'goal' | 'logged' | 'custom';
type MaintenanceKey = 'formula' | 'logs';

type Scenario = {
  id: string;
  intake: IntakeKey;
  maintenance: MaintenanceKey;
  label: string;
  intakeKcal: number;
  result: ProjectionResult;
  className: string;
  strokeDasharray?: string;
};

const INTAKE_META: Record<IntakeKey, { label: string; shortLabel: string }> = {
  goal: { label: 'Goal', shortLabel: 'Goal' },
  logged: { label: 'Logged avg', shortLabel: 'Logged' },
  custom: { label: 'Custom', shortLabel: 'Custom' },
};

const MAINTENANCE_META: Record<MaintenanceKey, { label: string }> = {
  formula: { label: 'Formula' },
  logs: { label: 'From logs' },
};

const SCENARIO_STYLE: Record<
  string,
  { className: string; strokeDasharray?: string; showDots?: boolean }
> = {
  'goal-formula': { className: 'stroke-accent', showDots: true },
  'goal-logs': { className: 'stroke-accent', strokeDasharray: '7 4' },
  'logged-formula': { className: 'stroke-accent-muted' },
  'logged-logs': { className: 'stroke-accent-muted', strokeDasharray: '7 4' },
  'custom-formula': { className: 'stroke-ink', strokeDasharray: '2 3' },
  'custom-logs': { className: 'stroke-muted', strokeDasharray: '2 3' },
};

function formatDisplayWeight(value: number, unit: WeightUnit): string {
  return `${roundWeight(value, unit).toLocaleString(undefined, {
    maximumFractionDigits: unit === 'lb' ? 1 : 2,
  })} ${weightUnitLabel(unit)}`;
}

function toChartPoints(
  result: ProjectionResult,
  startWeightDisplay: number,
  weightUnit: WeightUnit,
  startDate: DateKey,
): DatedPoint[] {
  const startKg = toCanonicalKg(startWeightDisplay, weightUnit);
  const start = {
    date: startDate,
    t: Date.parse(`${startDate}T00:00:00`),
    value: fromCanonicalKg(startKg, weightUnit),
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
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Goals</h1>
        <p className="mt-0.5 text-sm text-muted">
          Set calorie and macro targets, then project how weight changes if you hold a steady daily
          intake.
        </p>
      </header>

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
  const latestWeightKg = useMemo(() => weightSeries(weights).at(-1)?.value, [weights]);
  const startDate = todayKey();

  const loggedIntake = useMemo(
    () => averageLoggedIntake(days, startDate, LOGGED_INTAKE_LOOKBACK_DAYS),
    [days, startDate],
  );
  const logMaintenance = useMemo(() => estimateMaintenanceFromLogs(weights, days), [weights, days]);

  const [startWeightDisplay, setStartWeightDisplay] = useState<number | undefined>(() =>
    latestWeightKg !== undefined
      ? roundWeight(fromCanonicalKg(latestWeightKg, weightUnit), weightUnit)
      : undefined,
  );
  const [customIntakeKcal, setCustomIntakeKcal] = useState<number | undefined>(() =>
    goals.calories > 0 ? goals.calories : loggedIntake?.averageKcal,
  );
  const [showGoal, setShowGoal] = useState(true);
  const [showLogged, setShowLogged] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showFormula, setShowFormula] = useState(true);
  const [showLogsMaint, setShowLogsMaint] = useState(false);
  const [showWeighIns, setShowWeighIns] = useState(true);
  const [weeks, setWeeks] = useState<WeekSpan>('52');

  // Keep the start-weight field in sync when the preferred unit flips.
  const [lastWeightUnit, setLastWeightUnit] = useState(weightUnit);
  if (lastWeightUnit !== weightUnit) {
    setLastWeightUnit(weightUnit);
    if (startWeightDisplay !== undefined) {
      const kg = toCanonicalKg(startWeightDisplay, lastWeightUnit);
      setStartWeightDisplay(roundWeight(fromCanonicalKg(kg, weightUnit), weightUnit));
    }
  }

  const weekOptions: ReadonlyArray<SegmentedOption<WeekSpan>> = WEEK_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  const heightDisplay =
    profile.heightCm !== null && profile.heightCm !== undefined
      ? roundHeight(fromCanonicalCm(profile.heightCm, heightUnit), heightUnit)
      : undefined;

  const ageYears =
    profile.birthday !== null
      ? ageYearsFromBirthday(profile.birthday, fromDateKey(startDate))
      : null;

  const goalIntake = goals.calories > 0 ? goals.calories : undefined;
  const loggedIntakeKcal = loggedIntake?.averageKcal;
  const customIntake =
    customIntakeKcal !== undefined && customIntakeKcal > 0 ? customIntakeKcal : undefined;

  const useGoal = showGoal && goalIntake !== undefined;
  const useLogged = showLogged && loggedIntakeKcal !== undefined;
  const useCustom = showCustom && customIntake !== undefined;
  const useFormula = showFormula;
  const useLogsMaint = showLogsMaint && logMaintenance !== null;

  const profileReady =
    profile.sex !== null &&
    ageYears !== null &&
    profile.heightCm !== null &&
    startWeightDisplay !== undefined &&
    startWeightDisplay > 0;

  const anyIntakeOn = useGoal || useLogged || useCustom;
  const anyMaintOn = useFormula || useLogsMaint;
  const ready = profileReady && anyIntakeOn && anyMaintOn;

  const scenarios = useMemo((): Scenario[] => {
    if (!ready || !profile.sex || ageYears === null || profile.heightCm === null) return [];
    if (startWeightDisplay === undefined) return [];

    const startWeightKg = toCanonicalKg(startWeightDisplay, weightUnit);
    const intakes: Array<{ key: IntakeKey; kcal: number }> = [];
    if (useGoal && goalIntake !== undefined) intakes.push({ key: 'goal', kcal: goalIntake });
    if (useLogged && loggedIntakeKcal !== undefined) {
      intakes.push({ key: 'logged', kcal: loggedIntakeKcal });
    }
    if (useCustom && customIntake !== undefined)
      intakes.push({ key: 'custom', kcal: customIntake });

    const maintenances: MaintenanceKey[] = [];
    if (useFormula) maintenances.push('formula');
    if (useLogsMaint) maintenances.push('logs');

    const out: Scenario[] = [];
    for (const intake of intakes) {
      for (const maintenance of maintenances) {
        let activity: number = profile.activity;
        if (maintenance === 'logs' && logMaintenance) {
          activity = activityFromMaintenance({
            sex: profile.sex,
            weightKg: startWeightKg,
            heightCm: profile.heightCm,
            ageYears,
            maintenanceKcal: logMaintenance.maintenanceKcal,
          });
        }

        const result = projectWeightLoss({
          sex: profile.sex,
          ageYears,
          heightCm: profile.heightCm,
          startWeightKg,
          activity,
          intakeKcal: intake.kcal,
          startDate,
          weeks: Number(weeks),
        });

        const id = `${intake.key}-${maintenance}`;
        const style = SCENARIO_STYLE[id] ?? { className: 'stroke-accent' };
        out.push({
          id,
          intake: intake.key,
          maintenance,
          label: `${INTAKE_META[intake.key].shortLabel} · ${MAINTENANCE_META[maintenance].label}`,
          intakeKcal: intake.kcal,
          result,
          className: style.className,
          strokeDasharray: style.strokeDasharray,
        });
      }
    }

    return out;
  }, [
    ready,
    profile.sex,
    profile.heightCm,
    profile.activity,
    ageYears,
    startWeightDisplay,
    weightUnit,
    startDate,
    weeks,
    useGoal,
    useLogged,
    useCustom,
    useFormula,
    useLogsMaint,
    goalIntake,
    loggedIntakeKcal,
    customIntake,
    logMaintenance,
  ]);

  const primary = scenarios[0] ?? null;

  const actualWeightPoints = useMemo(
    () =>
      weightSeries(weights).map((point) => ({
        ...point,
        value: fromCanonicalKg(point.value, weightUnit),
      })),
    [weights, weightUnit],
  );

  const chartSeries = useMemo((): ChartSeries[] => {
    if (startWeightDisplay === undefined) return [];
    const series: ChartSeries[] = scenarios.map((scenario) => {
      const style = SCENARIO_STYLE[scenario.id] ?? { className: 'stroke-accent' };
      return {
        id: scenario.id,
        points: toChartPoints(scenario.result, startWeightDisplay, weightUnit, startDate),
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
    startWeightDisplay,
    weightUnit,
    startDate,
    showWeighIns,
    actualWeightPoints,
    primary,
  ]);

  function toggleIntake(key: IntakeKey) {
    if (key === 'goal') setShowGoal((value) => !value);
    if (key === 'logged') setShowLogged((value) => !value);
    if (key === 'custom') setShowCustom((value) => !value);
  }

  function toggleMaintenance(key: MaintenanceKey) {
    if (key === 'formula') setShowFormula((value) => !value);
    if (key === 'logs') setShowLogsMaint((value) => !value);
  }

  const incompleteReason = !profileReady
    ? 'Fill in sex, birthday, height, and starting weight to see the projection.'
    : !anyIntakeOn
      ? 'Turn on Goal, Logged avg, or Custom on the chart — Custom needs a calorie intake below.'
      : !anyMaintOn
        ? showLogsMaint && !logMaintenance
          ? 'Turn on Formula, or log more weigh-ins and food days for From logs maintenance.'
          : 'Turn on Formula or From logs on the chart.'
        : null;

  return (
    <section className="grid gap-5" data-testid="projection-section">
      <SettingsSection
        id="projection"
        title="Weight projection"
        description="Estimate how weight changes under different intake and maintenance assumptions. Toggle Goal, Logged avg, Formula, and From logs on the chart to compare scenarios."
      >
        <div className="grid gap-5" data-testid="projection-form">
          <div className="grid gap-5 sm:grid-cols-2">
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
                className="mt-1 w-full max-w-xs rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink focus:border-accent-border focus:outline-none"
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="max-w-48">
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
                max={startDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setProjectionProfile({ birthday: value ? (value as DateKey) : null });
                }}
                className="mt-1 w-full rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink focus:border-accent-border focus:outline-none"
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
              className="max-w-48"
            />

            <NumberField
              label="Starting weight"
              testId="projection-weight"
              value={startWeightDisplay}
              unit={weightUnitLabel(weightUnit)}
              min={1}
              max={weightUnit === 'lb' ? 1000 : 450}
              allowEmpty
              placeholder={latestWeightKg !== undefined ? 'Latest weigh-in' : 'Required'}
              onCommit={(value) => setStartWeightDisplay(value)}
              className="max-w-48"
            />

            <NumberField
              label="Custom intake"
              testId="projection-intake"
              value={customIntakeKcal}
              unit="kcal"
              integer
              min={1}
              max={20000}
              allowEmpty
              placeholder="What-if kcal"
              onCommit={(value) => {
                setCustomIntakeKcal(value);
                if (value !== undefined && value > 0) setShowCustom(true);
              }}
              className="max-w-48"
            />

            <div>
              <label
                htmlFor="projection-activity"
                className="block text-xs font-medium tracking-wide text-muted uppercase"
              >
                Activity level
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
                className="mt-1 w-full max-w-xl rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink focus:border-accent-border focus:outline-none"
              >
                {ACTIVITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-subtle" data-testid="projection-activity-hint">
                Used by Formula scenarios. From logs estimates maintenance from weigh-ins and food
                days
                {logMaintenance
                  ? ` (~${formatCalories(logMaintenance.maintenanceKcal)} kcal/day).`
                  : '.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-subtle">
              Profile fields are saved with your Goals. Chart toggles compare intake and maintenance
              scenarios without leaving this page.
            </p>
            <SegmentedControl
              label="Projection length"
              testId="projection-weeks"
              value={weeks}
              options={weekOptions}
              onChange={setWeeks}
            />
          </div>
        </div>
      </SettingsSection>

      {!ready || !primary ? (
        <div
          data-testid="projection-incomplete"
          className="card flex h-40 items-center justify-center p-5 text-sm text-muted"
        >
          {incompleteReason ??
            'Fill in sex, birthday, height, and starting weight to see the projection.'}
        </div>
      ) : (
        <>
          <article className="card grid gap-3 p-5" data-testid="projection-summary">
            <h2 className="text-sm font-semibold tracking-tight">Summary</h2>
            <p className="text-sm text-muted">
              Showing <span className="text-ink">{primary.label}</span> from{' '}
              {formatLongDate(startDate)}, eating {formatCalories(primary.intakeKcal)} kcal/day.
              Starting maintenance is about{' '}
              {formatCalories(Math.round(primary.result.startTdeeKcal))} kcal/day
              {primary.maintenance === 'logs'
                ? ' (from logs)'
                : ` (BMR ${formatCalories(Math.round(primary.result.startBmrKcal))} × activity)`}
              .
              {scenarios.length > 1
                ? ` ${scenarios.length - 1} other scenario${scenarios.length === 2 ? '' : 's'} on the chart.`
                : ''}
            </p>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted uppercase">
                  Healthy BMI range
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
                  Equilibrium weight
                </dt>
                <dd className="mt-1 text-sm tabular-nums text-ink">
                  {primary.result.equilibriumWeightKg > 0
                    ? formatDisplayWeight(
                        fromCanonicalKg(primary.result.equilibriumWeightKg, weightUnit),
                        weightUnit,
                      )
                    : 'Below zero at this intake'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted uppercase">
                  After {weeks === '26' ? '6 months' : weeks === '52' ? '1 year' : '2 years'}
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
          </article>

          <article className="card grid gap-3 p-4" data-testid="projection-chart">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Projected weight</h2>
              <p className="text-xs text-muted">Toggle series below to compare paths</p>
            </div>

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
                  onClick={() => toggleIntake('goal')}
                />
                <SeriesToggle
                  testId="projection-series-logged"
                  label={INTAKE_META.logged.label}
                  pressed={showLogged}
                  disabled={loggedIntakeKcal === undefined}
                  title={
                    loggedIntake
                      ? `Average ${formatCalories(loggedIntake.averageKcal)} kcal across ${loggedIntake.loggedDays} logged day${loggedIntake.loggedDays === 1 ? '' : 's'} in the last ${loggedIntake.lookbackDays}`
                      : `No food logged in the last ${LOGGED_INTAKE_LOOKBACK_DAYS} days`
                  }
                  onClick={() => toggleIntake('logged')}
                />
                <SeriesToggle
                  testId="projection-series-custom"
                  label={INTAKE_META.custom.label}
                  pressed={showCustom}
                  disabled={customIntake === undefined}
                  title={
                    customIntake === undefined
                      ? 'Enter a custom intake above'
                      : `${formatCalories(customIntake)} kcal/day`
                  }
                  onClick={() => toggleIntake('custom')}
                />
              </SeriesToggleGroup>

              <SeriesToggleGroup label="Maintenance">
                <SeriesToggle
                  testId="projection-series-formula"
                  label={MAINTENANCE_META.formula.label}
                  pressed={showFormula}
                  onClick={() => toggleMaintenance('formula')}
                />
                <SeriesToggle
                  testId="projection-series-logs"
                  label={MAINTENANCE_META.logs.label}
                  pressed={showLogsMaint}
                  disabled={logMaintenance === null}
                  title={
                    logMaintenance
                      ? `Estimated ${formatCalories(logMaintenance.maintenanceKcal)} kcal/day from ${logMaintenance.loggedDays} logged days (${formatShortDate(logMaintenance.startDate)}–${formatShortDate(logMaintenance.endDate)})`
                      : 'Need at least two weigh-ins ≥7 days apart and five food-logged days in between'
                  }
                  onClick={() => toggleMaintenance('logs')}
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

              {scenarios.length > 0 ? (
                <ul
                  className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted"
                  data-testid="projection-series-legend"
                >
                  {scenarios.map((scenario) => (
                    <li key={scenario.id} className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={[
                          'inline-block h-0.5 w-4 rounded-full',
                          scenario.className.replace('stroke-', 'bg-'),
                        ].join(' ')}
                        style={
                          scenario.strokeDasharray
                            ? {
                                backgroundImage: `repeating-linear-gradient(90deg, currentColor 0 4px, transparent 4px 7px)`,
                              }
                            : undefined
                        }
                      />
                      {scenario.label}
                    </li>
                  ))}
                  {showWeighIns && actualWeightPoints.length >= 2 ? (
                    <li className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-0.5 w-4 rounded-full bg-muted" />
                      Weigh-ins
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>

            <LineChart
              testId="projection-weight-chart"
              series={chartSeries}
              valueLabel={(value) => formatDisplayWeight(value, weightUnit)}
              emptyMessage="Nothing to project yet."
            />
          </article>

          <article className="card overflow-hidden p-0" data-testid="projection-table">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Weekly table</h2>
              <p className="mt-0.5 text-xs text-muted">
                {primary.label}: calories used are maintenance at that week&apos;s weight. Deficit
                is maintenance minus planned intake.
              </p>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead className="sticky top-0 bg-surface text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Weight</th>
                    <th className="px-4 py-2 font-medium text-right">Calories used</th>
                    <th className="px-4 py-2 font-medium text-right">Calorie deficit</th>
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
