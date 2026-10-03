import { formatShortDate } from '../lib/dates';
import { formatCalories } from '../lib/totals';
import { fromCanonicalKg, roundWeight, weightUnitLabel } from '../lib/weight';
import type { ProjectionRow } from '../lib/projection';
import type { WeightUnit } from '../types';

function formatDisplayWeight(value: number, unit: WeightUnit): string {
  return `${roundWeight(value, unit).toLocaleString(undefined, {
    maximumFractionDigits: unit === 'lb' ? 1 : 2,
  })} ${weightUnitLabel(unit)}`;
}

/**
 * Weekly projected-weight table shared by Goals and Home.
 */
export function ProjectionWeeklyTable({
  rows,
  weightUnit,
  title = 'Weekly table',
  testId = 'projection-table',
}: {
  rows: readonly ProjectionRow[];
  weightUnit: WeightUnit;
  title?: string;
  testId?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <article className="card overflow-hidden p-0" data-testid={testId}>
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead className="sticky top-0 bg-surface text-left text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Weight</th>
              <th className="px-4 py-2 font-medium text-right">Used</th>
              <th className="px-4 py-2 font-medium text-right">Deficit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-t border-line tabular-nums">
                <td className="px-4 py-1.5 text-ink">{formatShortDate(row.date)}</td>
                <td className="px-4 py-1.5 text-ink">
                  {formatDisplayWeight(fromCanonicalKg(row.weightKg, weightUnit), weightUnit)}
                </td>
                <td className="px-4 py-1.5 text-right text-ink">
                  {formatCalories(Math.round(row.maintenanceKcal))}
                </td>
                <td
                  className={[
                    'px-4 py-1.5 text-right',
                    row.deficitKcal >= 0 ? 'text-ink' : 'text-danger',
                  ].join(' ')}
                >
                  {row.deficitKcal >= 0 ? '' : '−'}
                  {formatCalories(Math.round(Math.abs(row.deficitKcal)))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
