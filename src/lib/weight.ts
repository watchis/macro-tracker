import type { WeightUnit } from '../types';

/** Exact international avoirdupois pound. */
export const KG_PER_LB = 0.45359237;

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

/** Converts a display-unit value into the canonical kilogram store value. */
export function toCanonicalKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? lbToKg(value) : value;
}

/** Converts a stored kilogram value into the preferred display unit. */
export function fromCanonicalKg(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kgToLb(kg) : kg;
}

export function weightUnitLabel(unit: WeightUnit): string {
  return unit === 'lb' ? 'lb' : 'kg';
}

/** Rounds for form fields and chart tooltips without inventing false precision. */
export function roundWeight(value: number, unit: WeightUnit): number {
  const precision = unit === 'lb' ? 1 : 2;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  const display = roundWeight(fromCanonicalKg(kg, unit), unit);
  return `${display.toLocaleString(undefined, {
    maximumFractionDigits: unit === 'lb' ? 1 : 2,
    minimumFractionDigits: 0,
  })} ${weightUnitLabel(unit)}`;
}

export function isWeightUnit(value: unknown): value is WeightUnit {
  return value === 'lb' || value === 'kg';
}
