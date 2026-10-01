import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_OPTIONS,
  bodyMassIndex,
  equilibriumWeightKg,
  healthyWeightRangeKg,
  mifflinStJeorBmr,
  projectWeightLoss,
  tdeeKcal,
} from './projection';

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

    // Later weeks: lighter weight, lower maintenance, smaller deficit.
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

describe('ACTIVITY_OPTIONS', () => {
  it('covers the five standard multipliers', () => {
    expect(ACTIVITY_OPTIONS.map((option) => option.value)).toEqual([1.2, 1.375, 1.55, 1.725, 1.9]);
  });
});
