import { useId, useState } from 'react';
import { formatNumberInput, parseNumberInput } from './numberInput';
import { MACROS } from '../../lib/macros';
import type { FormEvent } from 'react';
import type { FoodLibraryItem, MacroAmounts, MacroKey } from '../../types';

type Draft = {
  name: string;
  grams: string;
  calories: string;
  macros: Record<MacroKey, string>;
};

export type FoodFormProps = {
  /** Present when editing an existing library item. */
  initial?: FoodLibraryItem;
  submitLabel: string;
  onSubmit: (item: FoodLibraryItem) => void;
  onCancel?: () => void;
  testId?: string;
};

function emptyMacroDraft(item?: FoodLibraryItem): Record<MacroKey, string> {
  const draft = {} as Record<MacroKey, string>;
  for (const macro of MACROS) {
    draft[macro.key] = formatNumberInput(item?.macros?.[macro.key]);
  }
  return draft;
}

function toDraft(item?: FoodLibraryItem): Draft {
  return {
    name: item?.name ?? '',
    grams: formatNumberInput(item?.grams ?? 100),
    calories: formatNumberInput(item?.calories),
    macros: emptyMacroDraft(item),
  };
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  error?: string | undefined;
  unit?: string;
  testId?: string;
  className?: string;
  onChange: (value: string) => void;
};

function Field({ id, label, value, error, unit, testId, className, onChange }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium tracking-wide text-muted uppercase">
        {label}
        {unit ? <span className="ml-1 normal-case text-subtle">({unit})</span> : null}
      </label>
      <input
        id={id}
        data-testid={testId}
        type="text"
        autoComplete="off"
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={[
          'mt-1 w-full min-w-0 rounded-md border bg-raised px-2.5 py-1.5 text-sm text-ink',
          'focus:border-accent-border focus:outline-none',
          error ? 'border-danger' : 'border-line',
        ].join(' ')}
      />
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Add/edit form for a library food. Amounts describe the reference weight, and
 * the day view scales them with `scaleFood` when the food is logged.
 */
export function FoodForm({ initial, submitLabel, onSubmit, onCancel, testId }: FoodFormProps) {
  const formId = useId();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    const name = draft.name.trim();
    if (!name) nextErrors.name = 'Name this food.';

    const grams = parseNumberInput(draft.grams, { min: 1, max: 10000, integer: false });
    if (!grams.ok) nextErrors.grams = grams.error;

    const calories = parseNumberInput(draft.calories, { min: 0, max: 20000 });
    if (!calories.ok) nextErrors.calories = calories.error;

    const macros: MacroAmounts = {};
    for (const macro of MACROS) {
      const parsed = parseNumberInput(draft.macros[macro.key], {
        min: 0,
        max: macro.unit === 'mg' ? 100000 : 10000,
        allowEmpty: true,
      });
      if (!parsed.ok) {
        nextErrors[macro.key] = parsed.error;
      } else if (parsed.value !== undefined) {
        macros[macro.key] = parsed.value;
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!grams.ok || !calories.ok) return;

    onSubmit({
      name,
      grams: grams.value ?? 100,
      calories: calories.value ?? 0,
      macros,
    });
    if (!initial) setDraft(toDraft());
  }

  return (
    <form
      data-testid={testId}
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-lg border border-line bg-surface p-3"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field
          id={`${formId}-name`}
          testId={`${testId}-name`}
          label="Food"
          value={draft.name}
          error={errors.name}
          onChange={(name) => setDraft((current) => ({ ...current, name }))}
        />
        <Field
          id={`${formId}-grams`}
          testId={`${testId}-grams`}
          label="Per"
          unit="g"
          value={draft.grams}
          error={errors.grams}
          onChange={(grams) => setDraft((current) => ({ ...current, grams }))}
        />
        <Field
          id={`${formId}-calories`}
          testId={`${testId}-calories`}
          label="Calories"
          unit="kcal"
          value={draft.calories}
          error={errors.calories}
          onChange={(calories) => setDraft((current) => ({ ...current, calories }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {MACROS.map((macro) => (
          <Field
            key={macro.key}
            id={`${formId}-${macro.key}`}
            testId={`${testId}-${macro.key}`}
            label={macro.label}
            unit={macro.unit}
            value={draft.macros[macro.key]}
            error={errors[macro.key]}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                macros: { ...current.macros, [macro.key]: value },
              }))
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:bg-accent-strong"
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-muted hover:bg-raised"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
