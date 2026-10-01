import { useId, useState } from 'react';
import { ConfirmAction } from './ConfirmAction';
import { DATA_RETENTION_OPTIONS, isDataRetentionPolicy } from '../../lib/retention';
import { formatBytes, measureLocalStorageUsage } from '../../lib/storage';
import { STORAGE_KEY } from '../../store/defaults';
import { useAppStore } from '../../store/useAppStore';
import { useSettings } from '../../store/selectors';

type Status = { kind: 'ok' | 'error'; message: string };

function optimizeStatusMessage(freedBytes: number, monthsDropped: number): string {
  if (monthsDropped === 0) {
    return 'Nothing to remove — storage is already in good shape.';
  }
  const monthLabel = monthsDropped === 1 ? '1 oldest month' : `${monthsDropped} oldest months`;
  return `Freed ${formatBytes(freedBytes)} by removing ${monthLabel} of logs. Settings and recent data kept.`;
}

/** Local storage meter, retention policy, and storage optimization. */
export function DataSettings() {
  const retentionId = useId();
  const settings = useSettings();
  // Subscribe so the meter re-reads localStorage after day or policy changes.
  useAppStore((state) => state.days);
  const setDataRetention = useAppStore((state) => state.setDataRetention);
  const optimizeStorage = useAppStore((state) => state.optimizeStorage);
  const [status, setStatus] = useState<Status | null>(null);
  const usage = measureLocalStorageUsage(STORAGE_KEY);

  const percent = Math.round(usage.usedRatio * 1000) / 10;

  return (
    <div className="grid gap-5">
      <div>
        <span className="block text-xs font-medium tracking-wide text-muted uppercase">
          Local storage
        </span>
        <p className="mt-1 text-sm text-ink" data-testid="storage-usage-summary">
          {formatBytes(usage.totalBytes)} of {formatBytes(usage.quotaBytes)} used
          <span className="text-muted"> ({percent}%)</span>
        </p>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-surface"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usage.usedRatio * 100)}
          aria-label="Local storage used"
          data-testid="storage-usage-bar"
        >
          <div
            className={[
              'h-full rounded-full transition-[width]',
              usage.usedRatio >= 0.9 ? 'bg-danger' : 'bg-accent',
            ].join(' ')}
            style={{ width: `${Math.min(100, usage.usedRatio * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-subtle" data-testid="storage-usage-detail">
          App data: {formatBytes(usage.appBytes)}
        </p>
      </div>

      <div>
        <label
          htmlFor={retentionId}
          className="block text-xs font-medium tracking-wide text-muted uppercase"
        >
          Retention policy
        </label>
        <select
          id={retentionId}
          data-testid="data-retention"
          value={settings.dataRetention}
          onChange={(event) => {
            const value = event.target.value;
            if (isDataRetentionPolicy(value)) setDataRetention(value);
          }}
          className="mt-1 w-full max-w-xl rounded-md border border-line bg-raised px-2.5 py-2 text-sm text-ink focus:border-accent-border focus:outline-none"
        >
          {DATA_RETENTION_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <ConfirmAction
          label="Optimize storage"
          confirmLabel="Free space by removing oldest logs first?"
          tone="neutral"
          testId="optimize-storage-confirm"
          onConfirm={() => {
            const result = optimizeStorage();
            setStatus({
              kind: 'ok',
              message: optimizeStatusMessage(result.freedBytes, result.monthsDropped),
            });
          }}
        />
      </div>

      {status ? (
        <p
          role="status"
          data-testid="data-status"
          className={['text-sm', status.kind === 'error' ? 'text-danger' : 'text-muted'].join(' ')}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
