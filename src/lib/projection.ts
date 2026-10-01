import { addDays } from './dates';
import { weightSeries } from './series';
import { sumEntries } from './totals';
import { KG_PER_LB } from './weight';
import type { ActivityMultiplier, DateKey, FoodEntry, Sex } from '../types';

export type { ActivityMultiplier, Sex } from '../types';

export type ActivityOption = {
  value: ActivityMultiplier;
  label: string;
  shortLabel: string;
};

export const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  { value: 1.2, label: 'Sedentary (little or no exercise)', shortLabel: 'Sedentary' },
  { value: 1.375, label: 'Light exercise 1–3 days/week', shortLabel: 'Light' },
  { value: 1.55, label: 'Moderate exercise 3–5 days/week', shortLabel: 'Moderate' },
  { value: 1.725, label: 'Hard exercise 6–7 days/week', shortLabel: 'Very active' },
  { value: 1.9, label: 'Very hard exercise / physical job', shortLabel: 'Athlete' },
] as const;

export const DEFAULT_ACTIVITY: ActivityMultiplier = 1.2;

/** Default lookback when averaging logged calorie intake. */
export const LOGGED_INTAKE_LOOKBACK_DAYS = 14;

/** ~3500 kcal per pound of body fat. */
export const KCAL_PER_LB = 3500;

/** ~7700 kcal per kilogram of body fat. */
export const KCAL_PER_KG = KCAL_PER_LB / KG_PER_LB;

export const BMI_HEALTHY_MIN = 18.5;
export const BMI_HEALTHY_MAX = 24.9;

export type ProjectionInput = {
  sex: Sex;
  /** Whole years. */
  ageYears: number;
  /** Centimeters. */
  heightCm: number;
  /** Starting body weight in kilograms. */
  startWeightKg: number;
  /**
   * Activity multiplier applied to BMR. May be a standard preset or an effective
   * value inferred from logged intake + weight change.
   */
  activity: number;
  /** Planned daily energy intake in kcal. */
  intakeKcal: number;
  /** Projection start date (`YYYY-MM-DD`). */
  startDate: DateKey;
  /** How many weekly snapshots to emit (LoserTown runs ~2 years ≈ 104). */
  weeks?: number;
};

export type ProjectionRow = {
  date: DateKey;
  /** Projected weight at the end of this week, kg. */
  weightKg: number;
  /** Maintenance calories (TDEE) at the listed weight. */
  maintenanceKcal: number;
  /** `maintenanceKcal - intakeKcal` (positive = deficit). */
  deficitKcal: number;
};

export type ProjectionResult = {
  rows: ProjectionRow[];
  /** Weight where TDEE equals planned intake, kg. */
  equilibriumWeightKg: number;
  healthyWeightKg: { min: number; max: number };
  /** BMR at the starting weight. */
  startBmrKcal: number;
  /** TDEE at the starting weight. */
  startTdeeKcal: number;
};

export type LoggedIntakeAverage = {
  averageKcal: number;
  loggedDays: number;
  lookbackDays: number;
  fromDate: DateKey;
  toDate: DateKey;
};

export type LogMaintenanceEstimate = {
  maintenanceKcal: number;
  averageIntakeKcal: number;
  weightChangeKg: number;
  spanDays: number;
  loggedDays: number;
  startDate: DateKey;
  endDate: DateKey;
  startWeightKg: number;
  endWeightKg: number;
};

export function isSex(value: unknown): value is Sex {
  return value === 'male' || value === 'female';
}

export function isActivityMultiplier(value: unknown): value is ActivityMultiplier {
  return value === 1.2 || value === 1.375 || value === 1.55 || value === 1.725 || value === 1.9;
}

/**
 * Mifflin–St Jeor resting metabolic rate in kcal/day.
 * `weightKg` and `heightCm` must be positive; `ageYears` ≥ 0.
 */
export function mifflinStJeorBmr(args: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  const base = 10 * args.weightKg + 6.25 * args.heightCm - 5 * args.ageYears;
  return args.sex === 'male' ? base + 5 : base - 161;
}

export function tdeeKcal(bmr: number, activity: number): number {
  return bmr * activity;
}

/** Adult BMI healthy-weight band for a given height (kg). */
export function healthyWeightRangeKg(heightCm: number): { min: number; max: number } {
  const heightM = heightCm / 100;
  const area = heightM * heightM;
  return {
    min: BMI_HEALTHY_MIN * area,
    max: BMI_HEALTHY_MAX * area,
  };
}

export function bodyMassIndex(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/**
 * Weight (kg) at which Mifflin–St Jeor × activity equals `intakeKcal`.
 * Can be below a realistic floor when intake is very low.
 */
export function equilibriumWeightKg(args: {
  sex: Sex;
  heightCm: number;
  ageYears: number;
  activity: number;
  intakeKcal: number;
}): number {
  // TDEE = activity * (10*w + 6.25*h - 5*age + s) = intake
  // 10*w = intake/activity - (6.25*h - 5*age + s)
  const sexOffset = args.sex === 'male' ? 5 : -161;
  const constant = 6.25 * args.heightCm - 5 * args.ageYears + sexOffset;
  return (args.intakeKcal / args.activity - constant) / 10;
}

/**
 * Mean daily calories on days that have at least one food entry inside the
 * lookback window ending on `endDate` (inclusive).
 */
export function averageLoggedIntake(
  days: Record<DateKey, FoodEntry[]>,
  endDate: DateKey,
  lookbackDays: number = LOGGED_INTAKE_LOOKBACK_DAYS,
): LoggedIntakeAverage | null {
  if (lookbackDays < 1) return null;
  const fromDate = addDays(endDate, -(lookbackDays - 1));
  let sum = 0;
  let loggedDays = 0;

  for (let offset = 0; offset < lookbackDays; offset += 1) {
    const date = addDays(fromDate, offset);
    const entries = days[date];
    if (!entries || entries.length === 0) continue;
    sum += sumEntries(entries).calories;
    loggedDays += 1;
  }

  if (loggedDays === 0) return null;
  return {
    averageKcal: Math.round(sum / loggedDays),
    loggedDays,
    lookbackDays,
    fromDate,
    toDate: endDate,
  };
}

/**
 * Infer maintenance from weigh-ins + food logs via energy balance:
 * `TDEE ≈ avg logged intake − (Δkg × kcal/kg) / span days`.
 *
 * Needs ≥2 weigh-ins spanning ≥7 days and ≥5 logged food days in that window.
 */
export function estimateMaintenanceFromLogs(
  weights: Record<DateKey, number>,
  days: Record<DateKey, FoodEntry[]>,
): LogMaintenanceEstimate | null {
  const series = weightSeries(weights);
  if (series.length < 2) return null;

  const first = series[0]!;
  const last = series[series.length - 1]!;
  const spanDays = Math.round((last.t - first.t) / 86_400_000);
  if (spanDays < 7) return null;

  let intakeSum = 0;
  let loggedDays = 0;
  for (let offset = 0; offset <= spanDays; offset += 1) {
    const date = addDays(first.date, offset);
    const entries = days[date];
    if (!entries || entries.length === 0) continue;
    intakeSum += sumEntries(entries).calories;
    loggedDays += 1;
  }
  if (loggedDays < 5) return null;

  const averageIntakeKcal = intakeSum / loggedDays;
  const weightChangeKg = last.value - first.value;
  const maintenanceKcal = averageIntakeKcal - (weightChangeKg * KCAL_PER_KG) / spanDays;
  if (!Number.isFinite(maintenanceKcal) || maintenanceKcal <= 500 || maintenanceKcal > 10000) {
    return null;
  }

  return {
    maintenanceKcal: Math.round(maintenanceKcal),
    averageIntakeKcal: Math.round(averageIntakeKcal),
    weightChangeKg,
    spanDays,
    loggedDays,
    startDate: first.date,
    endDate: last.date,
    startWeightKg: first.value,
    endWeightKg: last.value,
  };
}

/** Effective activity multiplier so Mifflin×activity matches an observed TDEE. */
export function activityFromMaintenance(args: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  maintenanceKcal: number;
}): number {
  const bmr = mifflinStJeorBmr(args);
  if (!(bmr > 0)) return DEFAULT_ACTIVITY;
  return args.maintenanceKcal / bmr;
}

/**
 * Day-by-day energy-balance projection, sampled every 7 days (LoserTown-style).
 * Weight drifts toward the intake/TDEE equilibrium; maintenance falls as mass is lost.
 */
export function projectWeightLoss(input: ProjectionInput): ProjectionResult {
  const weeks = input.weeks ?? 104;
  const healthyWeightKg = healthyWeightRangeKg(input.heightCm);
  const startBmrKcal = mifflinStJeorBmr({
    sex: input.sex,
    weightKg: input.startWeightKg,
    heightCm: input.heightCm,
    ageYears: input.ageYears,
  });
  const startTdeeKcal = tdeeKcal(startBmrKcal, input.activity);
  const equilibrium = equilibriumWeightKg({
    sex: input.sex,
    heightCm: input.heightCm,
    ageYears: input.ageYears,
    activity: input.activity,
    intakeKcal: input.intakeKcal,
  });

  const rows: ProjectionRow[] = [];
  let weightKg = input.startWeightKg;

  for (let week = 1; week <= weeks; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      const bmr = mifflinStJeorBmr({
        sex: input.sex,
        weightKg,
        heightCm: input.heightCm,
        ageYears: input.ageYears,
      });
      const maintenance = tdeeKcal(bmr, input.activity);
      const deltaKg = (input.intakeKcal - maintenance) / KCAL_PER_KG;
      weightKg = Math.max(0, weightKg + deltaKg);
    }

    const bmr = mifflinStJeorBmr({
      sex: input.sex,
      weightKg,
      heightCm: input.heightCm,
      ageYears: input.ageYears,
    });
    const maintenanceKcal = tdeeKcal(bmr, input.activity);
    rows.push({
      date: addDays(input.startDate, week * 7),
      weightKg,
      maintenanceKcal,
      deficitKcal: maintenanceKcal - input.intakeKcal,
    });
  }

  return {
    rows,
    equilibriumWeightKg: equilibrium,
    healthyWeightKg,
    startBmrKcal,
    startTdeeKcal,
  };
}
