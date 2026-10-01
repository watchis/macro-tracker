import { useMemo, useState } from 'react';
import { LineChart } from '../components/charts/LineChart';
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
} from '../lib/projection';
import { weightSeries } from '../lib/series';
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
type IntakeSource = 'goal' | 'logged' | 'custom';
type MaintenanceSource = 'formula' | 'logs';

function formatDisplayWeight(value: number, unit: WeightUnit): string {
  return `${roundWeight(value, unit).toLocaleString(undefined, {
    maximumFractionDigits: unit === 'lb' ? 1 : 2,
  })} ${weightUnitLabel(unit)}`;
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

/** Weight-loss projection form, chart, and weekly table. */
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
  const [intakeSource, setIntakeSource] = useState<IntakeSource>(() =>
    goals.calories > 0 ? 'goal' : loggedIntake ? 'logged' : 'custom',
  );
  const [intakeKcal, setIntakeKcal] = useState<number | undefined>(() => {
    if (goals.calories > 0) return goals.calories;
    return loggedIntake?.averageKcal;
  });
  const [maintenanceSource, setMaintenanceSource] = useState<MaintenanceSource>('formula');
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

  const intakeSourceOptions: ReadonlyArray<SegmentedOption<IntakeSource>> = [
    { value: 'goal', label: 'Goal' },
    { value: 'logged', label: 'Logged avg' },
    { value: 'custom', label: 'Custom' },
  ];

  const maintenanceSourceOptions: ReadonlyArray<SegmentedOption<MaintenanceSource>> = [
    { value: 'formula', label: 'Formula' },
    { value: 'logs', label: 'From logs' },
  ];

  const heightDisplay =
    profile.heightCm !== null && profile.heightCm !== undefined
      ? roundHeight(fromCanonicalCm(profile.heightCm, heightUnit), heightUnit)
      : undefined;

  const ageYears =
    profile.birthday !== null
      ? ageYearsFromBirthday(profile.birthday, fromDateKey(startDate))
      : null;

  const effectiveIntake =
    intakeSource === 'goal'
      ? goals.calories > 0
        ? goals.calories
        : undefined
      : intakeSource === 'logged'
        ? (loggedIntake?.averageKcal ?? undefined)
        : intakeKcal;

  const ready =
    profile.sex !== null &&
    ageYears !== null &&
    profile.heightCm !== null &&
    startWeightDisplay !== undefined &&
    startWeightDisplay > 0 &&
    effectiveIntake !== undefined &&
    effectiveIntake > 0 &&
    (maintenanceSource === 'formula' || logMaintenance !== null);

  const result = useMemo(() => {
    if (!ready || !profile.sex || ageYears === null || profile.heightCm === null) {
      return null;
    }
    if (startWeightDisplay === undefined || effectiveIntake === undefined) return null;

    const startWeightKg = toCanonicalKg(startWeightDisplay, weightUnit);
    let activity: number = profile.activity;
    if (maintenanceSource === 'logs' && logMaintenance) {
      activity = activityFromMaintenance({
        sex: profile.sex,
        weightKg: startWeightKg,
        heightCm: profile.heightCm,
        ageYears,
        maintenanceKcal: logMaintenance.maintenanceKcal,
      });
    }

    return projectWeightLoss({
      sex: profile.sex,
      ageYears,
      heightCm: profile.heightCm,
      startWeightKg,
      activity,
      intakeKcal: effectiveIntake,
      startDate,
      weeks: Number(weeks),
    });
  }, [
    ready,
    profile.sex,
    ageYears,
    profile.heightCm,
    profile.activity,
    startWeightDisplay,
    effectiveIntake,
    weightUnit,
    startDate,
    weeks,
    maintenanceSource,
    logMaintenance,
  ]);

  const chartPoints = useMemo(() => {
    if (!result || startWeightDisplay === undefined) return [];
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
  }, [result, startWeightDisplay, weightUnit, startDate]);

  const actualWeightPoints = useMemo(
    () =>
      weightSeries(weights).map((point) => ({
        ...point,
        value: fromCanonicalKg(point.value, weightUnit),
      })),
    [weights, weightUnit],
  );

  function handleIntakeSourceChange(next: IntakeSource) {
    setIntakeSource(next);
    if (next === 'goal' && goals.calories > 0) {
      setIntakeKcal(goals.calories);
    } else if (next === 'logged' && loggedIntake) {
      setIntakeKcal(loggedIntake.averageKcal);
    }
  }

  function handleIntakeCommit(value: number | undefined) {
    setIntakeKcal(value);
    setIntakeSource('custom');
  }

  const intakeFieldValue =
    intakeSource === 'goal'
      ? goals.calories > 0
        ? goals.calories
        : undefined
      : intakeSource === 'logged'
        ? loggedIntake?.averageKcal
        : intakeKcal;

  return (
    <section className="grid gap-5" data-testid="projection-section">
      <SettingsSection
        id="projection"
        title="Weight projection"
        description="Estimate how weight changes if you hold a steady daily calorie intake. Use your calorie goal, a recent logged average, or maintenance inferred from weigh-ins."
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

            <div className="grid gap-2 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Daily calorie intake
                </span>
                <SegmentedControl
                  label="Intake source"
                  testId="projection-intake-source"
                  value={intakeSource}
                  options={intakeSourceOptions}
                  onChange={handleIntakeSourceChange}
                />
              </div>
              <NumberField
                label="Daily calorie intake"
                labelHidden
                testId="projection-intake"
                value={intakeFieldValue}
                unit="kcal"
                integer
                min={1}
                max={20000}
                allowEmpty
                placeholder={
                  intakeSource === 'logged'
                    ? loggedIntake
                      ? 'Logged average'
                      : 'No recent logs'
                    : goals.calories > 0
                      ? 'Calorie goal'
                      : 'Required'
                }
                onCommit={handleIntakeCommit}
                className="max-w-48"
              />
              <p className="text-xs text-subtle" data-testid="projection-intake-hint">
                {intakeSource === 'logged'
                  ? loggedIntake
                    ? `Average ${formatCalories(loggedIntake.averageKcal)} kcal across ${loggedIntake.loggedDays} logged day${loggedIntake.loggedDays === 1 ? '' : 's'} in the last ${loggedIntake.lookbackDays}.`
                    : `No food logged in the last ${LOGGED_INTAKE_LOOKBACK_DAYS} days.`
                  : intakeSource === 'goal'
                    ? goals.calories > 0
                      ? `Using your Settings calorie goal (${formatCalories(goals.calories)} kcal).`
                      : 'Set a calorie goal in Settings, or switch to Logged avg / Custom.'
                    : 'Custom what-if intake for this chart only.'}
              </p>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Maintenance
                </span>
                <SegmentedControl
                  label="Maintenance source"
                  testId="projection-maintenance-source"
                  value={maintenanceSource}
                  options={maintenanceSourceOptions}
                  onChange={setMaintenanceSource}
                />
              </div>
              {maintenanceSource === 'formula' ? (
                <>
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
                    className="w-full max-w-xl rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink focus:border-accent-border focus:outline-none"
                  >
                    {ACTIVITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="text-sm text-muted" data-testid="projection-maintenance-hint">
                  {logMaintenance
                    ? `Estimated ${formatCalories(logMaintenance.maintenanceKcal)} kcal/day from ${logMaintenance.loggedDays} logged days and weigh-ins over ${logMaintenance.spanDays} days (${formatShortDate(logMaintenance.startDate)}–${formatShortDate(logMaintenance.endDate)}).`
                    : 'Need at least two weigh-ins ≥7 days apart and five food-logged days in between.'}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-subtle">
              Profile fields are saved with your Goals. Intake and maintenance sources update the
              chart from your logs when selected.
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

      {!ready ? (
        <div
          data-testid="projection-incomplete"
          className="card flex h-40 items-center justify-center p-5 text-sm text-muted"
        >
          {maintenanceSource === 'logs' && !logMaintenance
            ? 'Log more weigh-ins and food days to estimate maintenance, or switch Maintenance back to Formula.'
            : intakeSource === 'logged' && !loggedIntake
              ? 'Log some food days to use a logged average, or switch intake to Goal / Custom.'
              : 'Fill in sex, birthday, height, starting weight, and daily intake to see the projection.'}
        </div>
      ) : result ? (
        <>
          <article className="card grid gap-3 p-5" data-testid="projection-summary">
            <h2 className="text-sm font-semibold tracking-tight">Summary</h2>
            <p className="text-sm text-muted">
              From {formatLongDate(startDate)}, eating {formatCalories(effectiveIntake!)} kcal/day
              {intakeSource === 'logged' ? ' (logged average)' : ''}
              {intakeSource === 'goal' ? ' (calorie goal)' : ''}. Starting maintenance is about{' '}
              {formatCalories(Math.round(result.startTdeeKcal))} kcal/day
              {maintenanceSource === 'logs'
                ? ' (from logs)'
                : ` (BMR ${formatCalories(Math.round(result.startBmrKcal))} × activity)`}
              .
            </p>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted uppercase">
                  Healthy BMI range
                </dt>
                <dd className="mt-1 text-sm tabular-nums text-ink">
                  {formatDisplayWeight(
                    fromCanonicalKg(result.healthyWeightKg.min, weightUnit),
                    weightUnit,
                  )}{' '}
                  –{' '}
                  {formatDisplayWeight(
                    fromCanonicalKg(result.healthyWeightKg.max, weightUnit),
                    weightUnit,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted uppercase">
                  Equilibrium weight
                </dt>
                <dd className="mt-1 text-sm tabular-nums text-ink">
                  {result.equilibriumWeightKg > 0
                    ? formatDisplayWeight(
                        fromCanonicalKg(result.equilibriumWeightKg, weightUnit),
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
                    fromCanonicalKg(result.rows[result.rows.length - 1]!.weightKg, weightUnit),
                    weightUnit,
                  )}
                </dd>
              </div>
            </dl>
          </article>

          <article className="card grid gap-3 p-4" data-testid="projection-chart">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Projected weight</h2>
              {actualWeightPoints.length > 0 ? (
                <p className="text-xs text-muted">Dashed line = logged weigh-ins</p>
              ) : null}
            </div>
            <LineChart
              testId="projection-weight-chart"
              points={chartPoints}
              trendPoints={actualWeightPoints.length >= 2 ? actualWeightPoints : undefined}
              valueLabel={(value) => formatDisplayWeight(value, weightUnit)}
              emptyMessage="Nothing to project yet."
            />
          </article>

          <article className="card overflow-hidden p-0" data-testid="projection-table">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Weekly table</h2>
              <p className="mt-0.5 text-xs text-muted">
                Calories used are maintenance at that week&apos;s weight. Deficit is maintenance
                minus your planned intake.
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
                  {result.rows.map((row) => (
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
      ) : null}
    </section>
  );
}
