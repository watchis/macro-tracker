export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Extra context shown under the label, e.g. which theme "system" resolves to. */
  hint?: string;
};

export type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  testId?: string;
};

/**
 * Radio group rendered as a pill row. Used for the small exclusive choices in
 * settings (theme mode, week start) where a select would be heavier than needed.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className="inline-flex flex-wrap gap-1 rounded-lg bg-surface p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'bg-accent text-accent-contrast'
                : 'text-muted hover:bg-accent-soft hover:text-ink',
            ].join(' ')}
          >
            {option.label}
            {option.hint ? (
              <span
                className={selected ? 'ml-1.5 text-xs opacity-80' : 'ml-1.5 text-xs text-subtle'}
              >
                {option.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
