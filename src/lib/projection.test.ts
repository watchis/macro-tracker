import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_OPTIONS,
  activityFromMaintenance,
  averageLoggedIntake,
  bodyMassIndex,
  equilibriumWeightKg,
  estimateMaintenanceFromLogs,
  healthyWeightRangeKg,
  mifflinStJeorBmr,
  projectWeightLoss,
  tdeeKcal,
} from './projection';
import { KG_PER_LB } from './weight';
import type { FoodEntry } from '../types';

function meal(calories: number, id: string): FoodEntry {
  return { id, name: 'Meal', grams: 1, calories, macros: {}, createdAt: '' };
}

describe('mifflinStJeorBmr', () => {
  it('matches a known male example (90.7 kg, 178 cm, age 35)', () => {
    const bmr = mifflinStJeorBmr({
      sex: 'male',
      weightKg: 90.7,
      heightCm: 178,
      ageYears: 35,
    });
    // 10*90.7 + 6.25*178 - 5*35 + 5 = 907 + 1112.5 - 175 + 5 = 1849.5
    expect(bmr).toBeCloseTo(1849.5, 5);
    expect(tdeeKcal(bmr, 1.2)).toBeCloseTo(2219.4, 5);
  });

  it('uses the female offset', () => {
    const male = mifflinStJeorBmr({
      sex: 'male',
      weightKg: 70,
      heightCm: 165,
      ageYears: 30,
    });
    const female = mifflinStJeorBmr({
      sex: 'female',
      weightKg: 70,
      heightCm: 165,
      ageYears: 30,
    });
    expect(male - female).toBe(166);
  });
});

describe('healthyWeightRangeKg', () => {
  it('returns the adult BMI 18.5–24.9 band', () => {
    const range = healthyWeightRangeKg(178);
    const heightM = 1.78;
    expect(range.min).toBeCloseTo(18.5 * heightM * heightM, 5);
    expect(range.max).toBeCloseTo(24.9 * heightM * heightM, 5);
    expect(bodyMassIndex(range.min, 178)).toBeCloseTo(18.5, 5);
    expect(bodyMassIndex(range.max, 178)).toBeCloseTo(24.9, 5);
  });
});

describe('projectWeightLoss', () => {
  it('projects weekly loss with shrinking maintenance as weight falls', () => {
    const result = projectWeightLoss({
      sex: 'male',
      ageYears: 35,
      heightCm: 177.8,
      startWeightKg: 90.718474,
      activity: 1.2,
      intakeKcal: 1800,
      startDate: '2026-10-01',
      weeks: 8,
    });

    expect(result.rows).toHaveLength(8);
    expect(result.startTdeeKcal).toBeGreaterThan(1800);
    expect(result.rows[0]!.date).toBe('2026-10-08');
    expect(result.rows[0]!.weightKg).toBeLessThan(90.718474);
    expect(result.rows[0]!.deficitKcal).toBeGreaterThan(0);

    const first = result.rows[0]!;
    const last = result.rows[7]!;
    expect(last.weightKg).toBeLessThan(first.weightKg);
    expect(last.maintenanceKcal).toBeLessThan(first.maintenanceKcal);
    expect(last.deficitKcal).toBeLessThan(first.deficitKcal);
    expect(last.deficitKcal).toBeCloseTo(last.maintenanceKcal - 1800, 5);
  });

  it('gains weight when intake exceeds starting TDEE', () => {
    const result = projectWeightLoss({
      sex: 'female',
      ageYears: 28,
      heightCm: 165,
      startWeightKg: 60,
      activity: 1.2,
      intakeKcal: 2800,
      startDate: '2026-01-01',
      weeks: 4,
    });
    expect(result.rows[0]!.weightKg).toBeGreaterThan(60);
    expect(result.rows[0]!.deficitKcal).toBeLessThan(0);
  });

  it('exposes equilibrium and healthy range', () => {
    const result = projectWeightLoss({
      sex: 'male',
      ageYears: 35,
      heightCm: 177.8,
      startWeightKg: 90,
      activity: 1.55,
      intakeKcal: 2000,
      startDate: '2026-01-01',
      weeks: 1,
    });
    expect(result.equilibriumWeightKg).toBeCloseTo(
      equilibriumWeightKg({
        sex: 'male',
        heightCm: 177.8,
        ageYears: 35,
        activity: 1.55,
        intakeKcal: 2000,
      }),
      5,
    );
    expect(result.healthyWeightKg.min).toBeLessThan(result.healthyWeightKg.max);
  });
});

describe('averageLoggedIntake', () => {
  it('averages only days with food entries inside the lookback', () => {
    const result = averageLoggedIntake(
      {
        '2026-09-20': [meal(1600, '1')],
        '2026-09-25': [meal(2000, '2')],
        '2026-08-01': [meal(900, '3')],
      },
      '2026-10-01',
      14,
    );
    expect(result).toEqual({
      averageKcal: 1800,
      loggedDays: 2,
      lookbackDays: 14,
      fromDate: '2026-09-18',
      toDate: '2026-10-01',
    });
  });

  it('returns null when nothing was logged', () => {
    expect(averageLoggedIntake({}, '2026-10-01', 14)).toBeNull();
  });
});

describe('estimateMaintenanceFromLogs', () => {
  it('infers TDEE from intake and weight change', () => {
    const startKg = 90;
    const endKg = 88;
    const days: Record<string, FoodEntry[]> = {};
    for (let i = 0; i < 14; i += 1) {
      const day = String(i + 1).padStart(2, '0');
      days[`2026-09-${day}`] = [meal(2000, String(i))];
    }
    const estimate = estimateMaintenanceFromLogs(
      { '2026-09-01': startKg, '2026-09-14': endKg },
      days,
    );
    expect(estimate).not.toBeNull();
    const expected = 2000 - ((endKg - startKg) * (3500 / KG_PER_LB)) / 13;
    expect(estimate!.maintenanceKcal).toBe(Math.round(expected));
    expect(estimate!.loggedDays).toBe(14);
    expect(estimate!.spanDays).toBe(13);
  });

  it('returns null without enough weigh-ins or food days', () => {
    expect(estimateMaintenanceFromLogs({ '2026-09-01': 90 }, {})).toBeNull();
    expect(
      estimateMaintenanceFromLogs(
        { '2026-09-01': 90, '2026-09-03': 89.5 },
        { '2026-09-01': [meal(1800, '1')] },
      ),
    ).toBeNull();
  });
});

describe('activityFromMaintenance', () => {
  it('recovers the activity multiplier from TDEE / BMR', () => {
    const weightKg = 90;
    const heightCm = 178;
    const ageYears = 35;
    const bmr = mifflinStJeorBmr({ sex: 'male', weightKg, heightCm, ageYears });
    const activity = activityFromMaintenance({
      sex: 'male',
      weightKg,
      heightCm,
      ageYears,
      maintenanceKcal: bmr * 1.55,
    });
    expect(activity).toBeCloseTo(1.55, 5);
  });
});

describe('ACTIVITY_OPTIONS', () => {
  it('covers the five standard multipliers', () => {
    expect(ACTIVITY_OPTIONS.map((option) => option.value)).toEqual([1.2, 1.375, 1.55, 1.725, 1.9]);
  });
});
