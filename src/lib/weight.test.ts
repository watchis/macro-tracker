import { describe, expect, it } from 'vitest';
import {
  formatWeight,
  fromCanonicalKg,
  kgToLb,
  lbToKg,
  roundWeight,
  toCanonicalKg,
} from './weight';

describe('weight conversion', () => {
  it('round-trips pounds through kilograms', () => {
    expect(kgToLb(lbToKg(180))).toBeCloseTo(180, 10);
    expect(lbToKg(kgToLb(81.65))).toBeCloseTo(81.65, 10);
  });

  it('converts display units into canonical kilograms', () => {
    expect(toCanonicalKg(100, 'kg')).toBe(100);
    expect(toCanonicalKg(220.462, 'lb')).toBeCloseTo(100, 3);
  });

  it('formats in the preferred unit', () => {
    expect(formatWeight(80, 'kg')).toBe('80 kg');
    expect(formatWeight(toCanonicalKg(180, 'lb'), 'lb')).toMatch(/^180(\.0)? lb$/);
  });

  it('rounds display values sensibly per unit', () => {
    expect(roundWeight(80.456, 'kg')).toBe(80.46);
    expect(roundWeight(fromCanonicalKg(toCanonicalKg(180.44, 'lb'), 'lb'), 'lb')).toBe(180.4);
  });
});
