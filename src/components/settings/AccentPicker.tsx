import { useId, useState } from 'react';
import { ACCENT_PRESETS } from '../../theme/presets';
import { normalizeHex } from '../../theme/color';

export type AccentPickerProps = {
  accent: string;
  /** Applied on every valid hex so the whole app restyles while typing. */
  onChange: (hex: string) => void;
};

/** Preset swatches plus a free-form hex field that previews as it is typed. */
export function AccentPicker({ accent, onChange }: AccentPickerProps) {
  const hexId = useId();
  const errorId = `${hexId}-error`;
  const [draft, setDraft] = useState(accent);
  const [lastAccent, setLastAccent] = useState(accent);
  const [error, setError] = useState<string | null>(null);

  if (lastAccent !== accent) {
    setLastAccent(accent);
    if (normalizeHex(draft) !== accent) {
      setDraft(accent);
      setError(null);
    }
  }

  function handleDraft(next: string) {
    setDraft(next);
    const hex = normalizeHex(next);
    if (hex) {
      setError(null);
      onChange(hex);
    } else {
      setError('Use a hex color such as #3b82f6.');
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <span className="block text-xs font-medium tracking-wide text-muted uppercase">
          Presets
        </span>
        <ul className="mt-2 flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((preset) => {
            const selected = preset.hex === accent;
            return (
              <li key={preset.hex}>
                <button
                  type="button"
                  data-testid={`accent-preset-${preset.hex.slice(1)}`}
                  aria-label={preset.name}
                  aria-pressed={selected}
                  title={`${preset.name} ${preset.hex}`}
                  onClick={() => onChange(preset.hex)}
                  style={{ backgroundColor: preset.hex }}
                  className={[
                    'size-8 rounded-full border transition-transform hover:scale-110',
                    selected ? 'border-ink ring-2 ring-accent ring-offset-2' : 'border-line-strong',
                  ].join(' ')}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor={hexId}
            className="block text-xs font-medium tracking-wide text-muted uppercase"
          >
            Custom hex
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={hexId}
              data-testid="accent-hex-input"
              type="text"
              spellCheck={false}
              autoComplete="off"
              value={draft}
              onChange={(event) => handleDraft(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={[
                'w-32 rounded-md border bg-raised px-2.5 py-1.5 font-mono text-sm text-ink',
                'focus:border-accent-border focus:outline-none',
                error ? 'border-danger' : 'border-line',
              ].join(' ')}
            />
            <input
              type="color"
              data-testid="accent-color-input"
              aria-label="Pick accent color"
              value={normalizeHex(draft) ?? accent}
              onChange={(event) => handleDraft(event.target.value)}
              className="size-9 cursor-pointer rounded-md border border-line bg-raised p-1"
            />
          </div>
          {error ? (
            <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <div
          data-testid="accent-preview"
          className="flex items-center gap-2 rounded-lg border border-accent-border bg-accent-faint px-3 py-2"
        >
          <span className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-contrast">
            Accent
          </span>
          <span className="font-mono text-xs text-muted">{accent}</span>
        </div>
      </div>
    </div>
  );
}
