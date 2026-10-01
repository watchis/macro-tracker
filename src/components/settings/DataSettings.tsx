import { useId, useState } from 'react';
import { ConfirmAction } from './ConfirmAction';
import {
  AUTO_OPTIMIZE_THRESHOLD_MAX,
  AUTO_OPTIMIZE_THRESHOLD_MIN,
  DEFAULT_AUTO_OPTIMIZE_THRESHOLD,
  normalizeAutoOptimizeThreshold,
} from '../../lib/retention';
import { formatBytes } from '../../lib/storage';
import { useAppStore } from '../../store/useAppStore';
import { useSettings } from '../../store/selectors';
import { isStorageCritical, useLocalStorageUsage } from '../../hooks/useStorageUsage';

type Status = { kind: 'ok' | 'error'; message: string };

function optimizeStatusMessage(freedBytes: number, monthsDropped: number): string {
  if (monthsDropped === 0) {
    return 'Nothing to remove — storage is already in good shape.';
  }
  const monthLabel = monthsDropped === 1 ? '1 oldest month' : `${monthsDropped} oldest months`;
  return `Freed ${formatBytes(freedBytes)} by removing ${monthLabel} of logs. Settings and recent data kept.`;
}

/** Local storage meter, auto-optimize threshold, and manual storage optimization. */
export function DataSettings() {
  const thresholdId = useId();
  const settings = useSettings();
  const setAutoOptimizeThreshold = useAppStore((state) => state.setAutoOptimizeThreshold);
  const optimizeStorage = useAppStore((state) => state.optimizeStorage);
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState(() =>
    settings.autoOptimizeThreshold === null ? '' : String(settings.autoOptimizeThreshold),
  );
  const [draftError, setDraftError] = useState<string | null>(null);
  const [lastThreshold, setLastThreshold] = useState(settings.autoOptimizeThreshold);
  const usage = useLocalStorageUsage();
  const critical = isStorageCritical(usage);
  const disabled = settings.autoOptimizeThreshold === null;

  if (lastThreshold !== settings.autoOptimizeThreshold) {
    setLastThreshold(settings.autoOptimizeThreshold);
    setDraft(settings.autoOptimizeThreshold === null ? '' : String(settings.autoOptimizeThreshold));
    setDraftError(null);
  }

  const percent = Math.round(usage.usedRatio * 1000) / 10;

  function commitThreshold(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      setDraftError(`Enter ${AUTO_OPTIMIZE_THRESHOLD_MIN}–${AUTO_OPTIMIZE_THRESHOLD_MAX}.`);
      return;
    }
    const normalized = normalizeAutoOptimizeThreshold(trimmed);
    if (normalized === null) {
      setDraftError(`Use ${AUTO_OPTIMIZE_THRESHOLD_MIN}–${AUTO_OPTIMIZE_THRESHOLD_MAX}.`);
      return;
    }
    setDraftError(null);
    setDraft(String(normalized));
    setAutoOptimizeThreshold(normalized);
  }

  return (
    <div className="grid gap-5" data-testid="data-settings">
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
              critical || usage.usedRatio >= 0.9 ? 'bg-danger' : 'bg-accent',
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
          htmlFor={thresholdId}
          className="block text-xs font-medium tracking-wide text-muted uppercase"
        >
          Auto-optimization
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            id={thresholdId}
            data-testid="auto-optimize-threshold"
            data-storage-exempt=""
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={disabled}
            value={disabled ? '' : draft}
            placeholder={disabled ? 'Off' : String(DEFAULT_AUTO_OPTIMIZE_THRESHOLD)}
            aria-invalid={draftError ? true : undefined}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              if (next.trim() === '') {
                setDraftError(null);
                return;
              }
              const normalized = normalizeAutoOptimizeThreshold(next);
              if (normalized === null) {
                setDraftError(`Use ${AUTO_OPTIMIZE_THRESHOLD_MIN}–${AUTO_OPTIMIZE_THRESHOLD_MAX}.`);
                return;
              }
              setDraftError(null);
              setAutoOptimizeThreshold(normalized);
            }}
            onBlur={() => {
              if (!disabled) commitThreshold(draft);
            }}
            className={[
              'w-20 rounded-md border bg-raised px-2.5 py-2 text-sm tabular-nums text-ink',
              'focus:border-accent-border focus:outline-none disabled:opacity-50',
              draftError ? 'border-danger' : 'border-line',
            ].join(' ')}
          />
          <span className="text-sm text-muted">%</span>
          <button
            type="button"
            data-testid="auto-optimize-disable"
            data-storage-exempt=""
            aria-pressed={disabled}
            onClick={() => {
              if (disabled) {
                setDraft(String(DEFAULT_AUTO_OPTIMIZE_THRESHOLD));
                setDraftError(null);
                setAutoOptimizeThreshold(DEFAULT_AUTO_OPTIMIZE_THRESHOLD);
              } else {
                setDraft('');
                setDraftError(null);
                setAutoOptimizeThreshold(null);
              }
            }}
            className={[
              'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
              disabled
                ? 'border-accent-border bg-accent-soft text-ink'
                : 'border-line text-muted hover:bg-surface',
            ].join(' ')}
          >
            Disable
          </button>
        </div>
        {draftError ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            {draftError}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-subtle" data-testid="auto-optimize-hint">
            {disabled
              ? 'Automatic cleanup is off. Use Optimize storage when you need space.'
              : `When usage reaches ${settings.autoOptimizeThreshold}%, oldest logs are removed automatically.`}
          </p>
        )}
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
