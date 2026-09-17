import { formatMacro, macroMeta } from '../lib/macros';
import type { BudgetSlice } from '../lib/totals';
import type { MacroKey } from '../types';

export type MacroChipProps = {
  macro: MacroKey;
  /** Amount eaten so far today. */
  consumed: number;
  /** Present only when the macro has a goal; drives the remaining readout. */
  slice?: BudgetSlice | undefined;
  className?: string;
};

/**
 * Compact `P 92 g left` pill. Without a goal it falls back to the consumed
 * amount so a macro can be shown without forcing the user to set a target.
 */
export function MacroChip({ macro, consumed, slice, className }: MacroChipProps) {
  const meta = macroMeta(macro);
  const over = slice?.isOver ?? false;
  const value = slice
    ? formatMacro(macro, Math.abs(slice.remaining))
    : formatMacro(macro, consumed);
  const suffix = slice ? (over ? 'over' : 'left') : '';

  return (
    <span
      data-testid={`macro-chip-${macro}`}
      title={
        slice
          ? `${meta.label}: ${formatMacro(macro, slice.consumed)} of ${formatMacro(macro, slice.goal)}`
          : `${meta.label}: ${formatMacro(macro, consumed)}`
      }
      className={[
        'inline-flex items-baseline gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap',
        over ? 'border-danger/40 bg-danger-soft text-danger' : 'border-line bg-surface text-muted',
        className ?? '',
      ].join(' ')}
    >
      {/* Whitespace-only nodes are dropped by the flex layout but keep the
          chip's text content readable for assistive tech. */}
      <span className="font-semibold text-ink">{meta.shortLabel}</span> <span>{value}</span>
      {suffix ? (
        <>
          {' '}
          <span className="text-subtle">{suffix}</span>
        </>
      ) : null}
    </span>
  );
}
