import { useMemo, useState } from 'react';
import { LineChart } from '../components/charts/LineChart';
import { NumberField } from '../components/settings/NumberField';
import { SegmentedControl } from '../components/settings/SegmentedControl';
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
  LOGGED_INTAKE_LOOKBACK_DAYS,
  averageLoggedIntake,
  projectWeightLoss,
  type ActivityMultiplier,
  type ProjectionRow,
} from '../lib/projection';
import { weightNearDate, weightSeries } from '../lib/series';
import { formatCalories } from '../lib/totals';
import { fromCanonicalKg, roundWeight, toCanonicalKg, weightUnitLabel } from '../lib/weight';
import { useAppStore } from '../store/useAppStore';
import { useGoals, useProjectionProfile, useWeightUnit, useWeights } from '../store/selectors';
import type { SegmentedOption } from '../components/settings/SegmentedControl';
import type { DateKey, WeightUnit } from '../types';

const HORIZON_PRESETS = [
  { value: '13', label: '3 mo', weeks: 13 },
  { value: '26', label: '6 mo', weeks: 26 },
  { value: '52', label: '1 yr', weeks: 52 },
  { value: 'goal', label: 'Goal' },
] as const;

type HorizonMode = (typeof HORIZON_PRESETS)[number]['value'];
type IntakeSource = 'goal' | 'logged';

function formatDisplayWeight(value: number, unit: WeightUnit): string {
  return `${roundWeight(value, unit).toLocaleString(undefined, {
    maximumFractionDigits: unit === 'lb' ? 1 : 2,
  })} ${weightUnitLabel(unit)}`;
}

function weeksBetween(start: DateKey, end: DateKey): number {
  return Math.max(1, Math.floor(daysBetween(start, end) / 7));
}

function presetWeeks(mode: HorizonMode): number | undefined {
  const match = HORIZON_PRESETS.find((option) => option.value === mode);
  return match && 'weeks' in match ? match.weeks : undefined;
}

/**
 * LoserTown-style calorie maintenance / weight projection: enter a profile and
 * planned intake, then see weekly weight, maintenance calories, and deficit.
 * Intake comes from the calorie goal or a recent logged average.
 */
export function ProjectionView() {
  const profile = useProjectionProfile();
  const goals = useGoals();
  const weightUnit = useWeightUnit();
  const weights = useWeights();
  const days = useAppStore((state) => state.days);
  const setProjectionProfile = useAppStore((state) => state.setProjectionProfile);

  const heightUnit = heightUnitForWeightUnit(weightUnit);
  const today = todayKey();
  const latestWeightKg = useMemo(() => weightSeries(weights).at(-1)?.value, [weights]);

  /** Empty = enter starting weight manually and project from today. */
  const [startDate, setStartDate] = useState<DateKey | ''>('');
  /** Empty = use a duration preset or goal weight instead of a fixed end date. */
  const [endDate, setEndDate] = useState<DateKey | ''>('');
  const [horizonMode, setHorizonMode] = useState<HorizonMode>('52');
  const [startWeightDisplay, setStartWeightDisplay] = useState<number | undefined>(() =>
    latestWeightKg !== undefined
      ? roundWeight(fromCanonicalKg(latestWeightKg, weightUnit), weightUnit)
      : undefined,
  );
  const [goalWeightDisplay, setGoalWeightDisplay] = useState<number | undefined>(undefined);

  // Keep weight fields in sync when the preferred unit flips.
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

  const usingStartDate = startDate !== '';
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

  const [intakeSource, setIntakeSource] = useState<IntakeSource>(() =>
    goals.calories > 0 ? 'goal' : 'logged',
  );

  const intakeSourceOptions: ReadonlyArray<SegmentedOption<IntakeSource>> = [
    { value: 'goal', label: 'Goal' },
    { value: 'logged', label: 'Logged avg' },
  ];

  const horizonOptions: ReadonlyArray<SegmentedOption<HorizonMode>> = HORIZON_PRESETS.map(
    (option) => ({
      value: option.value,
      label: option.label,
    }),
  );

  const heightDisplay =
    profile.heightCm !== null && profile.heightCm !== undefined
      ? roundHeight(fromCanonicalCm(profile.heightCm, heightUnit), heightUnit)
      : undefined;

  const effectiveIntake =
    intakeSource === 'goal'
      ? goals.calories > 0
        ? goals.calories
        : undefined
      : (loggedIntake?.averageKcal ?? undefined);

  const usingEndDate = endDate !== '';
  const usingGoalWeight = !usingEndDate && horizonMode === 'goal';
  const goalWeightKg =
    usingGoalWeight && goalWeightDisplay !== undefined
      ? toCanonicalKg(goalWeightDisplay, weightUnit)
      : undefined;

  const weeksForEndDate = usingEndDate
    ? weeksBetween(resolvedStartDate, endDate)
    : presetWeeks(horizonMode);
  const dateRangeValid = !usingEndDate || daysBetween(resolvedStartDate, endDate) >= 7;
  const goalWeightValid =
    !usingGoalWeight ||
    (goalWeightKg !== undefined &&
      goalWeightKg > 0 &&
      startWeightKg !== undefined &&
      Math.abs(goalWeightKg - startWeightKg) >= 0.05);

  const ready =
    profile.sex !== null &&
    profile.ageYears !== null &&
    profile.heightCm !== null &&
    startWeightKg !== undefined &&
    startWeightKg > 0 &&
    effectiveIntake !== undefined &&
    effectiveIntake > 0 &&
    dateRangeValid &&
    goalWeightValid;

  const result = useMemo(() => {
    if (!ready || !profile.sex || profile.ageYears === null || profile.heightCm === null) {
      return null;
    }
    if (startWeightKg === undefined || effectiveIntake === undefined) return null;

    return projectWeightLoss({
      sex: profile.sex,
      ageYears: profile.ageYears,
      heightCm: profile.heightCm,
      startWeightKg,
      activity: profile.activity,
      intakeKcal: effectiveIntake,
      startDate: resolvedStartDate,
      ...(usingGoalWeight && goalWeightKg !== undefined
        ? { goalWeightKg }
        : { weeks: weeksForEndDate ?? 52 }),
    });
  }, [
    ready,
    profile.sex,
    profile.ageYears,
    profile.heightCm,
    profile.activity,
    startWeightKg,
    effectiveIntake,
    resolvedStartDate,
    usingGoalWeight,
    goalWeightKg,
    weeksForEndDate,
  ]);

  const resolvedEndDate = result?.rows.length
    ? result.rows[result.rows.length - 1]!.date
    : addDays(resolvedStartDate, (weeksForEndDate ?? 52) * 7);

  const chartPoints = useMemo(() => {
    if (!result || startWeightKg === undefined) return [];
    const start = {
      date: resolvedStartDate,
      t: Date.parse(`${resolvedStartDate}T00:00:00`),
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
  }, [result, startWeightKg, weightUnit, resolvedStartDate]);

  const rowByDate = useMemo(() => {
    const map = new Map<DateKey, ProjectionRow>();
    if (!result) return map;
    for (const row of result.rows) map.set(row.date, row);
    return map;
  }, [result]);

  const actualWeightPoints = useMemo(
    () =>
      weightSeries(weights).map((point) => ({
        ...point,
        value: fromCanonicalKg(point.value, weightUnit),
      })),
    [weights, weightUnit],
  );

  const intakeFieldValue =
    intakeSource === 'goal'
      ? goals.calories > 0
        ? goals.calories
        : undefined
      : loggedIntake?.averageKcal;

  function handleStartDateChange(value: string) {
    if (!value) {
      setStartDate('');
      return;
    }
    const next = value as DateKey;
    setStartDate(next);
    if (endDate !== '' && daysBetween(next, endDate) < 7) {
      // Start moved past the chosen end — fall back to presets.
      setEndDate('');
    }
  }

  function handleEndDateChange(value: string) {
    if (!value) {
      setEndDate('');
      return;
    }
    const next = value as DateKey;
    if (daysBetween(resolvedStartDate, next) < 7) return;
    setEndDate(next);
  }

  const presetLabel = HORIZON_PRESETS.find((option) => option.value === horizonMode)?.label;
  const endWeightLabel = usingEndDate
    ? formatShortDate(resolvedEndDate)
    : usingGoalWeight
      ? result?.goalReached
        ? 'Goal'
        : 'At cap'
      : (presetLabel ?? formatShortDate(resolvedEndDate));

  const incompleteMessage = !dateRangeValid
    ? 'End date must be at least one week after the start.'
    : startWeightKg === undefined
      ? usingStartDate
        ? 'No weigh-in found for the start date.'
        : 'Enter a starting weight.'
      : !goalWeightValid
        ? 'Enter a goal weight different from the start.'
        : intakeSource === 'logged' && !loggedIntake
          ? 'No recent food logs for Logged avg.'
          : 'Fill in sex, age, height, and intake.';

  const fieldClassName =
    'mt-1 w-full rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink focus:border-accent-border focus:outline-none';

  return (
    <section className="grid gap-5" data-testid="projection-view">
      <h1 className="text-xl font-semibold tracking-tight">Projection</h1>

      <article className="card grid gap-6 p-5" data-testid="projection-form">
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

          <NumberField
            label="Age"
            testId="projection-age"
            value={profile.ageYears ?? undefined}
            unit="years"
            integer
            min={1}
            max={120}
            allowEmpty
            placeholder="Required"
            onCommit={(value) => setProjectionProfile({ ageYears: value ?? null })}
          />

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

        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="projection-start-date"
              className="block text-xs font-medium tracking-wide text-muted uppercase"
            >
              Start date
            </label>
            <input
              id="projection-start-date"
              data-testid="projection-start-date"
              type="date"
              value={startDate}
              onChange={(event) => handleStartDateChange(event.target.value)}
              className={fieldClassName}
            />
          </div>

          {usingStartDate ? (
            <div>
              <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                Starting weight
              </span>
              <p
                data-testid="projection-start-weight"
                className="mt-1 text-sm tabular-nums text-ink"
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
              testId="projection-weight"
              value={startWeightDisplay}
              unit={weightUnitLabel(weightUnit)}
              min={1}
              max={weightUnit === 'lb' ? 1000 : 450}
              allowEmpty
              placeholder={latestWeightKg !== undefined ? 'Latest weigh-in' : 'Required'}
              onCommit={(value) => setStartWeightDisplay(value)}
            />
          )}

          <div>
            <label
              htmlFor="projection-end-date"
              className="block text-xs font-medium tracking-wide text-muted uppercase"
            >
              End date
            </label>
            <input
              id="projection-end-date"
              data-testid="projection-end-date"
              type="date"
              value={endDate}
              min={addDays(resolvedStartDate, 7)}
              onChange={(event) => handleEndDateChange(event.target.value)}
              className={fieldClassName}
            />
          </div>

          {!usingEndDate ? (
            <div className="grid gap-2">
              <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                Horizon
              </span>
              <SegmentedControl
                label="Projection length"
                testId="projection-horizon-preset"
                value={horizonMode}
                options={horizonOptions}
                onChange={setHorizonMode}
              />
              {usingGoalWeight ? (
                <NumberField
                  label="Goal weight"
                  testId="projection-goal-weight"
                  value={goalWeightDisplay}
                  unit={weightUnitLabel(weightUnit)}
                  min={1}
                  max={weightUnit === 'lb' ? 1000 : 450}
                  allowEmpty
                  placeholder="Required"
                  onCommit={(value) => setGoalWeightDisplay(value)}
                />
              ) : null}
            </div>
          ) : (
            <div />
          )}

          <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">
                Daily intake
              </span>
              <SegmentedControl
                label="Intake source"
                testId="projection-intake-source"
                value={intakeSource}
                options={intakeSourceOptions}
                onChange={setIntakeSource}
              />
            </div>
            <p data-testid="projection-intake" className="mt-2 text-sm tabular-nums text-ink">
              {intakeFieldValue !== undefined ? `${formatCalories(intakeFieldValue)} kcal` : '—'}
            </p>
          </div>
        </div>
      </article>

      {!ready ? (
        <div
          data-testid="projection-incomplete"
          className="card flex items-center justify-center px-5 py-8 text-sm text-muted"
        >
          {incompleteMessage}
        </div>
      ) : result ? (
        <>
          <article className="card grid gap-4 p-5" data-testid="projection-chart">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Projected weight</h2>
              <p className="text-xs text-muted" data-testid="projection-summary">
                {formatShortDate(resolvedStartDate)} → {formatShortDate(resolvedEndDate)} ·{' '}
                {formatCalories(effectiveIntake!)} kcal/day
                {actualWeightPoints.length > 0 ? ' · dashed = logged' : ''}
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-3">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted uppercase">
                  Healthy BMI
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
                  Equilibrium
                </dt>
                <dd className="mt-1 text-sm tabular-nums text-ink">
                  {result.equilibriumWeightKg > 0
                    ? formatDisplayWeight(
                        fromCanonicalKg(result.equilibriumWeightKg, weightUnit),
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
                    fromCanonicalKg(result.rows[result.rows.length - 1]!.weightKg, weightUnit),
                    weightUnit,
                  )}
                </dd>
              </div>
            </dl>

            <LineChart
              testId="projection-weight-chart"
              points={chartPoints}
              trendPoints={actualWeightPoints.length >= 2 ? actualWeightPoints : undefined}
              valueLabel={(value) => formatDisplayWeight(value, weightUnit)}
              pointTooltip={(point) => {
                const row = rowByDate.get(point.date);
                const weightLine = `${formatShortDate(point.date)}: ${formatDisplayWeight(point.value, weightUnit)}`;
                if (!row) return weightLine;
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
