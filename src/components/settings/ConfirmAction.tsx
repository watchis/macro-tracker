import { useState } from 'react';

export type ConfirmActionProps = {
  label: string;
  /** Replaces the label once the button is armed, e.g. "Delete forever?". */
  confirmLabel: string;
  onConfirm: () => void;
  /** `danger` is the red treatment used for destructive actions. */
  tone?: 'danger' | 'neutral';
  testId?: string;
  disabled?: boolean;
};

/**
 * Two-step button for destructive actions: the first click arms it, the second
 * runs it. Keeps the confirmation inline instead of behind a blocking dialog.
 */
export function ConfirmAction({
  label,
  confirmLabel,
  onConfirm,
  tone = 'danger',
  testId,
  disabled,
}: ConfirmActionProps) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={() => setArmed(true)}
        className={[
          'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
          tone === 'danger'
            ? 'border-line text-danger hover:bg-danger-soft'
            : 'border-line text-ink hover:bg-surface',
        ].join(' ')}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      className="inline-flex flex-wrap items-center gap-2"
      data-testid={testId ? `${testId}-confirm` : undefined}
    >
      <span className="text-sm text-muted">{confirmLabel}</span>
      <button
        type="button"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        className="rounded-md border border-danger bg-danger-soft px-3 py-1.5 text-sm font-semibold text-danger"
      >
        Yes, {label.toLowerCase()}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface"
      >
        Cancel
      </button>
    </span>
  );
}
