import { useMemo, useState } from 'react';
import { LineChart } from '../components/charts/LineChart';
import { NumberField } from '../components/settings/NumberField';
import { SegmentedControl } from '../components/settings/SegmentedControl';
import { formatLongDate, formatShortDate, todayKey } from '../lib/dates';
import {
  fromCanonicalCm,
  heightUnitForWeightUnit,
  heightUnitLabel,
  roundHeight,
  toCanonicalCm,
} from '../lib/height';
import { ACTIVITY_OPTIONS, projectWeightLoss, type ActivityMultiplier } from '../lib/projection';
import { weightSeries } from '../lib/series';
import { formatCalories } from '../lib/totals';
import { fromCanonicalKg, roundWeight, toCanonicalKg, weightUnitLabel } from '../lib/weight';
import { useAppStore } from '../store/useAppStore';
import { useGoals, useProjectionProfile, useWeightUnit, useWeights } from '../store/selectors';
import type { SegmentedOption } from '../components/settings/SegmentedControl';
import type { WeightUnit } from '../types';

const WEEK_OPTIONS = [
  { value: '26', label: '6 mo' },
  { value: '52', label: '1 yr' },
  { value: '104', label: '2 yr' },
] as const;

type WeekSpan = (typeof WEEK_OPTIONS)[number]['value'];

function formatDisplayWeight(value: number, unit: WeightUnit): string {
  return `${roundWeight(value, unit).toLocaleString(undefined, {
    maximumFractionDigits: unit === 'lb' ? 1 : 2,
  })} ${weightUnitLabel(unit)}`;
}

/**
 * LoserTown-style calorie maintenance / weight projection: enter a profile and
 * planned intake, then see weekly weight, maintenance calories, and deficit.
 */
export function ProjectionView() {
  const profile = useProjectionProfile();
  const goals = useGoals();
  const weightUnit = useWeightUnit();
  const weights = useWeights();
  const setProjectionProfile = useAppStore((state) => state.setProjectionProfile);

  const heightUnit = heightUnitForWeightUnit(weightUnit);
  const latestWeightKg = useMemo(() => weightSeries(weights).at(-1)?.value, [weights]);

  const [startWeightDisplay, setStartWeightDisplay] = useState<number | undefined>(() =>
    latestWeightKg !== undefined
      ? roundWeight(fromCanonicalKg(latestWeightKg, weightUnit), weightUnit)
      : undefined,
  );
  const [intakeKcal, setIntakeKcal] = useState<number | undefined>(() =>
    goals.calories > 0 ? goals.calories : undefined,
  );
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

  const ready =
    profile.sex !== null &&
    profile.ageYears !== null &&
    profile.heightCm !== null &&
    startWeightDisplay !== undefined &&
    startWeightDisplay > 0 &&
    intakeKcal !== undefined &&
    intakeKcal > 0;

  const startDate = todayKey();
  const result = useMemo(() => {
    if (!ready || !profile.sex || profile.ageYears === null || profile.heightCm === null) {
      return null;
    }
    if (startWeightDisplay === undefined || intakeKcal === undefined) return null;
    return projectWeightLoss({
      sex: profile.sex,
      ageYears: profile.ageYears,
      heightCm: profile.heightCm,
      startWeightKg: toCanonicalKg(startWeightDisplay, weightUnit),
      activity: profile.activity,
      intakeKcal,
      startDate,
      weeks: Number(weeks),
    });
  }, [
    ready,
    profile.sex,
    profile.ageYears,
    profile.heightCm,
    profile.activity,
    startWeightDisplay,
    intakeKcal,
    weightUnit,
    startDate,
    weeks,
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

  return (
    <section className="grid gap-5" data-testid="projection-view">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Projection</h1>
        <p className="mt-0.5 text-sm text-muted">
          Estimate how weight changes if you hold a steady daily calorie intake. Maintenance
          calories fall as you get lighter, so the deficit shrinks over time.
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
            label="Daily calorie intake"
            testId="projection-intake"
            value={intakeKcal}
            unit="kcal"
            integer
            min={1}
            max={20000}
            allowEmpty
            placeholder={goals.calories > 0 ? 'Calorie goal' : 'Required'}
            onCommit={(value) => setIntakeKcal(value)}
            className="max-w-48"
          />

          <div className="sm:col-span-2">
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-subtle">
            Profile fields are saved in Settings. Weight and intake here are what-if values for this
            chart.
          </p>
          <SegmentedControl
            label="Projection length"
            testId="projection-weeks"
            value={weeks}
            options={weekOptions}
            onChange={setWeeks}
          />
        </div>
      </article>

      {!ready ? (
        <div
          data-testid="projection-incomplete"
          className="card flex h-40 items-center justify-center p-5 text-sm text-muted"
        >
          Fill in sex, age, height, starting weight, and daily intake to see the projection.
        </div>
      ) : result ? (
        <>
          <article className="card grid gap-3 p-5" data-testid="projection-summary">
            <h2 className="text-sm font-semibold tracking-tight">Summary</h2>
            <p className="text-sm text-muted">
              From {formatLongDate(startDate)}, eating {formatCalories(intakeKcal!)} kcal/day.
              Starting maintenance is about {formatCalories(Math.round(result.startTdeeKcal))}{' '}
              kcal/day (BMR {formatCalories(Math.round(result.startBmrKcal))} × activity).
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
            <h2 className="text-sm font-semibold tracking-tight">Projected weight</h2>
            <LineChart
              testId="projection-weight-chart"
              points={chartPoints}
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
