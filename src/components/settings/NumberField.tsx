import { useId, useState } from 'react';
import { formatNumberInput, parseNumberInput } from './numberInput';
import type { NumberInputRules } from './numberInput';

export type NumberFieldProps = NumberInputRules & {
  label: string;
  value: number | undefined;
  /** Called only with valid input; invalid text stays on screen as an error. */
  onCommit: (value: number | undefined) => void;
  unit?: string;
  placeholder?: string;
  /** Renders the label for assistive tech only, for fields inside a labelled row. */
  labelHidden?: boolean;
  testId?: string;
  className?: string;
};

/**
 * Validated numeric input. The store stays the source of truth: every keystroke
 * that parses is committed immediately, and one that does not leaves the last
 * valid value in place while showing why it was rejected.
 */
export function NumberField({
  label,
  value,
  onCommit,
  unit,
  placeholder,
  labelHidden,
  testId,
  className,
  ...rules
}: NumberFieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [draft, setDraft] = useState(() => formatNumberInput(value));
  const [error, setError] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState(value);

  // The value can also change from outside (import, reset, another field), in
  // which case the draft has to catch up without clobbering in-flight typing.
  if (lastValue !== value) {
    setLastValue(value);
    const parsed = parseNumberInput(draft, rules);
    if (!parsed.ok || parsed.value !== value) {
      setDraft(formatNumberInput(value));
      setError(null);
    }
  }

  function handleChange(next: string) {
    setDraft(next);
    const parsed = parseNumberInput(next, rules);
    if (parsed.ok) {
      setError(null);
      onCommit(parsed.value);
    } else {
      setError(parsed.error);
    }
  }

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={
          labelHidden ? 'sr-only' : 'block text-xs font-medium text-muted uppercase tracking-wide'
        }
      >
        {label}
      </label>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          id={inputId}
          data-testid={testId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => handleChange(event.target.value)}
          className={[
            'w-full min-w-0 rounded-md border bg-raised px-2.5 py-1.5 text-sm text-ink tabular-nums',
            'focus:border-accent-border focus:outline-none',
            error ? 'border-danger' : 'border-line',
          ].join(' ')}
        />
        {unit ? <span className="shrink-0 text-xs text-subtle">{unit}</span> : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
