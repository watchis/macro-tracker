export type NumberInputRules = {
  min?: number;
  max?: number;
  /** When true an empty field is valid and means "no value" (clears a goal). */
  allowEmpty?: boolean;
  /** Rejects fractions, used for whole-number fields such as the calorie goal. */
  integer?: boolean;
};

export type ParsedNumberInput =
  { ok: true; value: number | undefined } | { ok: false; error: string };

/**
 * Shared validation for every numeric settings field. Returning an error rather
 * than a fallback number lets the UI keep the user's text on screen while the
 * store holds the last valid value.
 */
export function parseNumberInput(raw: string, rules: NumberInputRules = {}): ParsedNumberInput {
  const { min = 0, max = 100000, allowEmpty = false, integer = false } = rules;
  const trimmed = raw.trim();

  if (trimmed === '') {
    return allowEmpty ? { ok: true, value: undefined } : { ok: false, error: 'Enter a number.' };
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a number.' };
  if (integer && !Number.isInteger(value)) return { ok: false, error: 'Use a whole number.' };
  if (value < min) return { ok: false, error: `Must be ${min.toLocaleString()} or more.` };
  if (value > max) return { ok: false, error: `Must be ${max.toLocaleString()} or less.` };

  return { ok: true, value };
}

/** Text shown in an input for a stored value; `undefined` shows as empty. */
export function formatNumberInput(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}
