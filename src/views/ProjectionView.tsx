import { useMemo, useState } from 'react';
import { LineChart } from '../components/charts/LineChart';
import { NumberField } from '../components/settings/NumberField';
import { SegmentedControl } from '../components/settings/SegmentedControl';
import { addDays, daysBetween, formatLongDate, formatShortDate, todayKey } from '../lib/dates';
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
import { fromCanonicalKg, roundWeight, weightUnitLabel } from '../lib/weight';
import { useAppStore } from '../store/useAppStore';
import { useGoals, useProjectionProfile, useWeightUnit, useWeights } from '../store/selectors';
import type { SegmentedOption } from '../components/settings/SegmentedControl';
import type { DateKey, WeightUnit } from '../types';

const HORIZON_PRESETS = [
  { value: '13', label: '3 mo', weeks: 13 },
  { value: '26', label: '6 mo', weeks: 26 },
  { value: '52', label: '1 yr', weeks: 52 },
] as const;

type HorizonPreset = (typeof HORIZON_PRESETS)[number]['value'];
type IntakeSource = 'goal' | 'logged';

function formatDisplayWeight(value: number, unit: WeightUnit): string {
  return `${roundWeight(value, unit).toLocaleString(undefined, {
    maximumFractionDigits: unit === 'lb' ? 1 : 2,
  })} ${weightUnitLabel(unit)}`;
}

function weeksBetween(start: DateKey, end: DateKey): number {
  return Math.max(1, Math.floor(daysBetween(start, end) / 7));
}

function presetWeeks(preset: HorizonPreset): number {
  return HORIZON_PRESETS.find((option) => option.value === preset)?.weeks ?? 52;
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

  const [startDate, setStartDate] = useState<DateKey>(today);
  /** Empty = use a duration preset instead of a fixed end date. */
  const [endDate, setEndDate] = useState<DateKey | ''>('');
  const [horizonPreset, setHorizonPreset] = useState<HorizonPreset>('52');

  const loggedIntake = useMemo(
    () => averageLoggedIntake(days, startDate, LOGGED_INTAKE_LOOKBACK_DAYS),
    [days, startDate],
  );

  const startWeightPoint = useMemo(() => weightNearDate(weights, startDate), [weights, startDate]);
  const startWeightKg = startWeightPoint?.value;

  const [intakeSource, setIntakeSource] = useState<IntakeSource>(() =>
    goals.calories > 0 ? 'goal' : 'logged',
  );

  const intakeSourceOptions: ReadonlyArray<SegmentedOption<IntakeSource>> = [
    { value: 'goal', label: 'Goal' },
    { value: 'logged', label: 'Logged avg' },
  ];

  const horizonOptions: ReadonlyArray<SegmentedOption<HorizonPreset>> = HORIZON_PRESETS.map(
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
  const weeks = usingEndDate ? weeksBetween(startDate, endDate) : presetWeeks(horizonPreset);
  const resolvedEndDate = addDays(startDate, weeks * 7);
  const dateRangeValid = !usingEndDate || daysBetween(startDate, endDate) >= 7;

  const ready =
    profile.sex !== null &&
    profile.ageYears !== null &&
    profile.heightCm !== null &&
    startWeightKg !== undefined &&
    startWeightKg > 0 &&
    effectiveIntake !== undefined &&
    effectiveIntake > 0 &&
    dateRangeValid;

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
      startDate,
      weeks,
    });
  }, [
    ready,
    profile.sex,
    profile.ageYears,
    profile.heightCm,
    profile.activity,
    startWeightKg,
    effectiveIntake,
    startDate,
    weeks,
  ]);

  const chartPoints = useMemo(() => {
    if (!result || startWeightKg === undefined) return [];
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
  }, [result, startWeightKg, weightUnit, startDate]);

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
    if (!value) return;
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
    if (daysBetween(startDate, next) < 7) return;
    setEndDate(next);
  }

  const presetLabel = HORIZON_PRESETS.find((option) => option.value === horizonPreset)?.label;
  const endWeightLabel = usingEndDate
    ? `After ${weeks} week${weeks === 1 ? '' : 's'} (${formatShortDate(resolvedEndDate)})`
    : `After ${presetLabel ?? `${weeks} weeks`} (${formatShortDate(resolvedEndDate)})`;

  return (
    <section className="grid gap-5" data-testid="projection-view">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Projection</h1>
        <p className="mt-0.5 text-sm text-muted">
          Estimate how weight changes if you hold a steady daily calorie intake. Use your calorie
          goal or a recent logged average for intake.
        </p>
      </header>

      <article className="card grid gap-5 p-5" data-testid="projection-form">
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
            className="max-w-48"
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
          </div>

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
              className="mt-1 w-full max-w-48 rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink focus:border-accent-border focus:outline-none"
            />
            <p className="mt-1 text-xs text-subtle" data-testid="projection-start-weight-hint">
              {startWeightPoint
                ? `Starting weight ${formatDisplayWeight(fromCanonicalKg(startWeightPoint.value, weightUnit), weightUnit)} from ${formatShortDate(startWeightPoint.date)}${startWeightPoint.date === startDate ? '' : ' (nearest weigh-in)'}.`
                : 'Log a weigh-in to set the starting weight.'}
            </p>
          </div>

          <div className="grid gap-2">
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
              min={addDays(startDate, 7)}
              onChange={(event) => handleEndDateChange(event.target.value)}
              className="w-full max-w-48 rounded-md border border-line bg-raised px-2.5 py-1.5 text-sm text-ink focus:border-accent-border focus:outline-none"
            />
            {!usingEndDate ? (
              <SegmentedControl
                label="Projection length"
                testId="projection-horizon-preset"
                value={horizonPreset}
                options={horizonOptions}
                onChange={setHorizonPreset}
              />
            ) : null}
            <p className="text-xs text-subtle" data-testid="projection-horizon-hint">
              {!dateRangeValid
                ? 'End date must be at least one week after the start.'
                : usingEndDate
                  ? `${weeks} week${weeks === 1 ? '' : 's'} · ${daysBetween(startDate, endDate)} days`
                  : `${presetLabel} preset · through ${formatShortDate(resolvedEndDate)}`}
            </p>
          </div>

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
                onChange={setIntakeSource}
              />
            </div>
            <p data-testid="projection-intake" className="text-sm tabular-nums text-ink">
              {intakeFieldValue !== undefined
                ? `${formatCalories(intakeFieldValue)} kcal`
                : intakeSource === 'logged'
                  ? 'No recent logs'
                  : 'No calorie goal set'}
            </p>
            <p className="text-xs text-subtle" data-testid="projection-intake-hint">
              {intakeSource === 'logged'
                ? loggedIntake
                  ? `Average ${formatCalories(loggedIntake.averageKcal)} kcal across ${loggedIntake.loggedDays} logged day${loggedIntake.loggedDays === 1 ? '' : 's'} in the last ${loggedIntake.lookbackDays}.`
                  : `No food logged in the last ${LOGGED_INTAKE_LOOKBACK_DAYS} days.`
                : goals.calories > 0
                  ? `Using your Settings calorie goal (${formatCalories(goals.calories)} kcal).`
                  : 'Set a calorie goal in Settings, or switch to Logged avg.'}
            </p>
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <p className="text-xs text-subtle">
            Profile fields are saved with Settings. Starting weight comes from your weigh-ins near
            the start date. Leave end date blank to use a 3 mo / 6 mo / 1 yr preset.
          </p>
        </div>
      </article>

      {!ready ? (
        <div
          data-testid="projection-incomplete"
          className="card flex h-40 items-center justify-center p-5 text-sm text-muted"
        >
          {!dateRangeValid
            ? 'Choose an end date at least one week after the start, or clear it to use a preset.'
            : startWeightKg === undefined
              ? 'Log a weigh-in so the projection has a starting weight.'
              : intakeSource === 'logged' && !loggedIntake
                ? 'Log some food days to use a logged average, or switch intake to Goal.'
                : 'Fill in sex, age, height, and daily intake to see the projection.'}
        </div>
      ) : result ? (
        <>
          <article className="card grid gap-3 p-5" data-testid="projection-summary">
            <h2 className="text-sm font-semibold tracking-tight">Summary</h2>
            <p className="text-sm text-muted">
              From {formatLongDate(startDate)} to {formatLongDate(resolvedEndDate)}, eating{' '}
              {formatCalories(effectiveIntake!)} kcal/day
              {intakeSource === 'logged' ? ' (logged average)' : ' (calorie goal)'}. Starting
              maintenance is about {formatCalories(Math.round(result.startTdeeKcal))} kcal/day (BMR{' '}
              {formatCalories(Math.round(result.startBmrKcal))} × activity).
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
