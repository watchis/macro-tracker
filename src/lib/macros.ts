import type { MacroAmounts, MacroKey, MacroTotals } from '../types';

export type MacroMeta = {
  key: MacroKey;
  label: string;
  /** Short label for tight spots such as calendar cells and budget chips. */
  shortLabel: string;
  unit: 'g' | 'mg';
};

/** Canonical macro order used by every table, chip row and settings toggle list. */
export const MACROS: readonly MacroMeta[] = [
  { key: 'protein', label: 'Protein', shortLabel: 'P', unit: 'g' },
  { key: 'carbs', label: 'Carbs', shortLabel: 'C', unit: 'g' },
  { key: 'fat', label: 'Fat', shortLabel: 'F', unit: 'g' },
  { key: 'fiber', label: 'Fiber', shortLabel: 'Fib', unit: 'g' },
  { key: 'sugar', label: 'Sugar', shortLabel: 'Sug', unit: 'g' },
  { key: 'satFat', label: 'Saturated fat', shortLabel: 'Sat', unit: 'g' },
  { key: 'sodium', label: 'Sodium', shortLabel: 'Na', unit: 'mg' },
];

export const MACRO_KEYS: readonly MacroKey[] = MACROS.map((macro) => macro.key);

const MACRO_BY_KEY = new Map<MacroKey, MacroMeta>(MACROS.map((macro) => [macro.key, macro]));

export function isMacroKey(value: unknown): value is MacroKey {
  return typeof value === 'string' && MACRO_BY_KEY.has(value as MacroKey);
}

export function macroMeta(key: MacroKey): MacroMeta {
  const meta = MACRO_BY_KEY.get(key);
  if (!meta) throw new Error(`Unknown macro key: ${key}`);
  return meta;
}

export function macroLabel(key: MacroKey): string {
  return macroMeta(key).label;
}

export function macroUnit(key: MacroKey): 'g' | 'mg' {
  return macroMeta(key).unit;
}

/** Sorts an arbitrary macro list into the canonical display order. */
export function sortMacros(keys: readonly MacroKey[]): MacroKey[] {
  const unique = new Set(keys.filter(isMacroKey));
  return MACRO_KEYS.filter((key) => unique.has(key));
}

export function emptyMacroTotals(): MacroTotals {
  return {
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    satFat: 0,
    sodium: 0,
  };
}

/** Drops absent/non-finite macro values so persisted entries stay compact. */
export function normalizeMacros(macros: MacroAmounts | undefined): MacroAmounts {
  const result: MacroAmounts = {};
  if (!macros) return result;
  for (const key of MACRO_KEYS) {
    const value = macros[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return result;
}

/** Formats a macro amount with its unit, e.g. `31 g` or `450 mg`. */
export function formatMacro(key: MacroKey, value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}${macroUnit(key) === 'mg' ? ' mg' : ' g'}`;
}
