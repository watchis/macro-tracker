import { useMemo } from 'react';
import { addDays, ageYearsFromBirthday, daysBetween, fromDateKey, todayKey } from '../lib/dates';
import {
  projectWeightLoss,
  weeksForEndMode,
  type ProjectionResult,
  type ProjectionRow,
} from '../lib/projection';
import { weightNearDate, weightSeries } from '../lib/series';
import { useGoals, useProjectionProfile, useWeights } from '../store/selectors';
import type { DateKey } from '../types';

export type ProjectionIntakeKey = 'goal';

export type ProjectionScenario = {
  id: ProjectionIntakeKey;
  intake: ProjectionIntakeKey;
  label: string;
  intakeKcal: number;
  result: ProjectionResult;
};

function weeksBetween(start: DateKey, end: DateKey): number {
  return Math.max(1, Math.floor(daysBetween(start, end) / 7));
}

export type WeightProjectionModel = {
  profileReady: boolean;
  ready: boolean;
  incompleteReason: string | null;
  resolvedStartDate: DateKey;
  resolvedEndDate: DateKey;
  startWeightKg: number | undefined;
  goalWeightKg: number | undefined;
  usingStartDate: boolean;
  usingEndDate: boolean;
  usingGoalWeight: boolean;
  ageYears: number | null;
  goalIntake: number | undefined;
  scenarios: ProjectionScenario[];
  primary: ProjectionScenario | null;
  primaryRows: ProjectionRow[];
};

/**
 * Shared weight-projection model driven by the persisted profile + calorie goal.
 * Used by Goals (chart + table) and Home (chart + table).
 */
export function useWeightProjection(): WeightProjectionModel {
  const profile = useProjectionProfile();
  const goals = useGoals();
  const weights = useWeights();
  const today = todayKey();

  const usingStartDate = profile.startMode === 'date';
  const usingEndDate = profile.endMode === 'date';
  const usingGoalWeight = profile.endMode === 'goal';

  const startDate = profile.startDate ?? today;
  const endDate = profile.endDate ?? addDays(today, 364);
  const resolvedStartDate: DateKey = usingStartDate ? startDate : today;

  const latestWeightKg = useMemo(() => weightSeries(weights).at(-1)?.value, [weights]);

  const startWeightPoint = useMemo(
    () => (usingStartDate ? weightNearDate(weights, startDate) : undefined),
    [usingStartDate, weights, startDate],
  );

  const startWeightKg = usingStartDate
    ? startWeightPoint?.value
    : (profile.startWeightKg ?? latestWeightKg);

  const goalWeightKg = usingGoalWeight ? (profile.goalWeightKg ?? undefined) : undefined;

  const ageYears =
    profile.birthday !== null
      ? ageYearsFromBirthday(profile.birthday, fromDateKey(resolvedStartDate))
      : null;

  const goalIntake = goals.calories > 0 ? goals.calories : undefined;

  const dateRangeValid = !usingEndDate || daysBetween(resolvedStartDate, endDate) >= 7;
  const goalWeightValid =
    !usingGoalWeight ||
    (goalWeightKg !== undefined &&
      goalWeightKg > 0 &&
      startWeightKg !== undefined &&
      Math.abs(goalWeightKg - startWeightKg) >= 0.05);

  const weeksForHorizon = usingEndDate
    ? weeksBetween(resolvedStartDate, endDate)
    : weeksForEndMode(profile.endMode);

  const profileReady =
    profile.sex !== null &&
    ageYears !== null &&
    profile.heightCm !== null &&
    startWeightKg !== undefined &&
    startWeightKg > 0 &&
    dateRangeValid &&
    goalWeightValid;

  const ready = profileReady && goalIntake !== undefined;

  const scenarios = useMemo((): ProjectionScenario[] => {
    if (!ready || !profile.sex || ageYears === null || profile.heightCm === null) return [];
    if (startWeightKg === undefined || goalIntake === undefined) return [];

    const result = projectWeightLoss({
      sex: profile.sex,
      ageYears,
      heightCm: profile.heightCm,
      startWeightKg,
      activity: profile.activity,
      intakeKcal: goalIntake,
      startDate: resolvedStartDate,
      ...(usingGoalWeight && goalWeightKg !== undefined
        ? { goalWeightKg }
        : { weeks: weeksForHorizon ?? 52 }),
    });

    return [
      {
        id: 'goal',
        intake: 'goal',
        label: 'Goal',
        intakeKcal: goalIntake,
        result,
      },
    ];
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
    weeksForHorizon,
    goalIntake,
  ]);

  const primary = scenarios[0] ?? null;
  const resolvedEndDate = primary?.result.rows.length
    ? primary.result.rows[primary.result.rows.length - 1]!.date
    : addDays(resolvedStartDate, (weeksForHorizon ?? 52) * 7);

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
    : goalIntake === undefined
      ? 'Set a calorie goal above.'
      : null;

  return {
    profileReady,
    ready,
    incompleteReason,
    resolvedStartDate,
    resolvedEndDate,
    startWeightKg,
    goalWeightKg,
    usingStartDate,
    usingEndDate,
    usingGoalWeight,
    ageYears,
    goalIntake,
    scenarios,
    primary,
    primaryRows: primary?.result.rows ?? [],
  };
}
