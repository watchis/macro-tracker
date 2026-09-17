import { useId, useState } from 'react';
import { ConfirmAction } from './ConfirmAction';
import { todayKey } from '../../lib/dates';
import { useAppStore } from '../../store/useAppStore';

type Status = { kind: 'ok' | 'error'; message: string };

function downloadJson(json: string, filename: string): boolean {
  if (typeof URL.createObjectURL !== 'function') return false;
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

/** JSON export, import and a full reset. Both destructive actions confirm first. */
export function DataSettings() {
  const importId = useId();
  const exportJson = useAppStore((state) => state.exportJson);
  const importJson = useAppStore((state) => state.importJson);
  const resetAll = useAppStore((state) => state.resetAll);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<Status | null>(null);

  function handleExport() {
    const json = exportJson();
    if (downloadJson(json, `macro-tracker-${todayKey()}.json`)) {
      setStatus({ kind: 'ok', message: 'Exported your data as a JSON file.' });
    } else {
      setStatus({ kind: 'error', message: 'This browser cannot download files.' });
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportJson());
      setStatus({ kind: 'ok', message: 'Copied the export JSON to your clipboard.' });
    } catch {
      setStatus({ kind: 'error', message: 'Could not reach the clipboard.' });
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setDraft(await file.text());
      setStatus({ kind: 'ok', message: `Loaded ${file.name}. Import to apply it.` });
    } catch {
      setStatus({ kind: 'error', message: 'Could not read that file.' });
    }
  }

  function handleImport() {
    const result = importJson(draft);
    if (result.ok) {
      setDraft('');
      setStatus({ kind: 'ok', message: 'Imported. Your days, foods and settings were replaced.' });
    } else {
      setStatus({ kind: 'error', message: result.error });
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="export-download"
          onClick={handleExport}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:bg-accent-strong"
        >
          Export JSON
        </button>
        <button
          type="button"
          data-testid="export-copy"
          onClick={() => void handleCopy()}
          className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface"
        >
          Copy JSON
        </button>
      </div>

      <div>
        <label
          htmlFor={importId}
          className="block text-xs font-medium tracking-wide text-muted uppercase"
        >
          Import
        </label>
        <textarea
          id={importId}
          data-testid="import-input"
          rows={4}
          spellCheck={false}
          value={draft}
          placeholder="Paste an export here, or choose a file below."
          onChange={(event) => setDraft(event.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-raised px-2.5 py-2 font-mono text-xs text-ink focus:border-accent-border focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="application/json,.json"
            data-testid="import-file"
            aria-label="Import from a file"
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="max-w-full text-xs text-muted file:mr-2 file:rounded-md file:border file:border-line file:bg-surface file:px-2 file:py-1 file:text-xs file:text-ink"
          />
          <ConfirmAction
            label="Import"
            confirmLabel="Replace everything with this data?"
            testId="import-confirm"
            disabled={draft.trim() === ''}
            onConfirm={handleImport}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <ConfirmAction
          label="Reset all data"
          confirmLabel="Delete every logged day, food and setting?"
          testId="reset-confirm"
          onConfirm={() => {
            resetAll();
            setStatus({ kind: 'ok', message: 'Everything is back to the defaults.' });
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
