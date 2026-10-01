/** Exact inch-to-centimeter factor. */
export const CM_PER_IN = 2.54;

export type HeightUnit = 'in' | 'cm';

export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

/** Canonical store unit is centimeters. */
export function toCanonicalCm(value: number, unit: HeightUnit): number {
  return unit === 'in' ? inToCm(value) : value;
}

export function fromCanonicalCm(cm: number, unit: HeightUnit): number {
  return unit === 'in' ? cmToIn(cm) : cm;
}

export function heightUnitLabel(unit: HeightUnit): string {
  return unit === 'in' ? 'in' : 'cm';
}

/** Round for form fields: tenths of an inch, whole centimeters. */
export function roundHeight(value: number, unit: HeightUnit): number {
  if (unit === 'in') {
    return Math.round(value * 10) / 10;
  }
  return Math.round(value);
}

export function formatHeight(cm: number, unit: HeightUnit): string {
  const display = roundHeight(fromCanonicalCm(cm, unit), unit);
  return `${display.toLocaleString(undefined, {
    maximumFractionDigits: unit === 'in' ? 1 : 0,
  })} ${heightUnitLabel(unit)}`;
}

/** Prefer inches when the weight unit is lb, otherwise cm. */
export function heightUnitForWeightUnit(weightUnit: 'lb' | 'kg'): HeightUnit {
  return weightUnit === 'lb' ? 'in' : 'cm';
}
