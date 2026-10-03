import { useMemo } from 'react';
import { addDays, ageYearsFromBirthday, daysBetween, fromDateKey, todayKey } from '../lib/dates';
import {
  LOGGED_INTAKE_LOOKBACK_DAYS,
  averageLoggedIntake,
  projectWeightLoss,
  weeksForEndMode,
  type ProjectionResult,
  type ProjectionRow,
} from '../lib/projection';
import { weightNearDate, weightSeries } from '../lib/series';
import { useAppStore } from '../store/useAppStore';
import { useGoals, useProjectionProfile, useWeights } from '../store/selectors';
import type { DateKey } from '../types';

export type ProjectionIntakeKey = 'goal' | 'logged';

export type ProjectionScenario = {
  id: ProjectionIntakeKey;
  intake: ProjectionIntakeKey;
  label: string;
  intakeKcal: number;
  result: ProjectionResult;
};

const INTAKE_LABEL: Record<ProjectionIntakeKey, string> = {
  goal: 'Goal',
  logged: 'Logged',
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
  loggedIntakeKcal: number | undefined;
  goalIntake: number | undefined;
  scenarios: ProjectionScenario[];
  primary: ProjectionScenario | null;
  primaryRows: ProjectionRow[];
};

/**
 * Shared weight-projection model driven by the persisted profile + food/weight
 * logs. Used by Goals (chart + table) and Home (table).
 */
export function useWeightProjection(options?: {
  /** When false, skips the Goal intake series even if a calorie goal exists. */
  showGoal?: boolean;
  /** When true and logged intake exists, includes the Logged avg series. */
  showLogged?: boolean;
}): WeightProjectionModel {
  const showGoal = options?.showGoal !== false;
  const showLogged = options?.showLogged === true;

  const profile = useProjectionProfile();
  const goals = useGoals();
  const weights = useWeights();
  const days = useAppStore((state) => state.days);
  const today = todayKey();

  const usingStartDate = profile.startMode === 'date';
  const usingEndDate = profile.endMode === 'date';
  const usingGoalWeight = profile.endMode === 'goal';

  const startDate = profile.startDate ?? today;
  const endDate = profile.endDate ?? addDays(today, 364);
  const resolvedStartDate: DateKey = usingStartDate ? startDate : today;

  const latestWeightKg = useMemo(() => weightSeries(weights).at(-1)?.value, [weights]);

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
    : (profile.startWeightKg ?? latestWeightKg);

  const goalWeightKg = usingGoalWeight ? (profile.goalWeightKg ?? undefined) : undefined;

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

  const anyIntakeOn = useGoal || useLogged;
  const ready = profileReady && anyIntakeOn;

  const scenarios = useMemo((): ProjectionScenario[] => {
    if (!ready || !profile.sex || ageYears === null || profile.heightCm === null) return [];
    if (startWeightKg === undefined) return [];

    const intakes: Array<{ key: ProjectionIntakeKey; kcal: number }> = [];
    if (useGoal && goalIntake !== undefined) intakes.push({ key: 'goal', kcal: goalIntake });
    if (useLogged && loggedIntakeKcal !== undefined) {
      intakes.push({ key: 'logged', kcal: loggedIntakeKcal });
    }

    return intakes.map((intake) => {
      const result = projectWeightLoss({
        sex: profile.sex!,
        ageYears,
        heightCm: profile.heightCm!,
        startWeightKg,
        activity: profile.activity,
        intakeKcal: intake.kcal,
        startDate: resolvedStartDate,
        ...(usingGoalWeight && goalWeightKg !== undefined
          ? { goalWeightKg }
          : { weeks: weeksForHorizon ?? 52 }),
      });

      return {
        id: intake.key,
        intake: intake.key,
        label: INTAKE_LABEL[intake.key],
        intakeKcal: intake.kcal,
        result,
      };
    });
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
    useGoal,
    useLogged,
    goalIntake,
    loggedIntakeKcal,
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
    : !anyIntakeOn
      ? 'Turn on Goal or Logged avg on the chart.'
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
    loggedIntakeKcal,
    goalIntake,
    scenarios,
    primary,
    primaryRows: primary?.result.rows ?? [],
  };
}
