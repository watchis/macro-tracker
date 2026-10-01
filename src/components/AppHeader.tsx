import { useAppStore } from '../store/useAppStore';
import { useSelectedDate, useView } from '../store/selectors';
import { formatShortDate, isToday } from '../lib/dates';
import { isStorageCritical, useLocalStorageUsage } from '../hooks/useStorageUsage';
import type { ViewName } from '../types';

const NAV_ITEMS: ReadonlyArray<{ view: ViewName; label: string }> = [
  { view: 'home', label: 'Home' },
  { view: 'calendar', label: 'Calendar' },
  { view: 'library', label: 'Food library' },
  { view: 'settings', label: 'Settings' },
];

/**
 * Sticky top bar with the only navigation in the app. Views are app state, not
 * routes, so GitHub Pages never has to serve a deep link.
 */
export function AppHeader() {
  const view = useView();
  const selectedDate = useSelectedDate();
  const setView = useAppStore((state) => state.setView);
  const usage = useLocalStorageUsage();
  const critical = isStorageCritical(usage);
  const percent = Math.round(usage.usedRatio * 100);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight">Macro Tracker</span>
          <span className="hidden text-xs text-subtle sm:inline">
            {isToday(selectedDate) ? 'Today' : formatShortDate(selectedDate)}
          </span>
        </div>

        <nav aria-label="Views">
          <ul className="flex items-center gap-1 rounded-lg bg-surface p-1">
            {NAV_ITEMS.map((item) => {
              const active = item.view === view;
              return (
                <li key={item.view}>
                  <button
                    type="button"
                    onClick={() => setView(item.view)}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-accent text-accent-contrast'
                        : 'text-muted hover:bg-accent-soft hover:text-ink',
                    ].join(' ')}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {critical ? (
        <div
          role="alert"
          data-testid="storage-critical-banner"
          className="border-t border-danger/40 bg-danger-soft"
        >
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-danger">
            <p>
              Storage is {percent}% full. Inputs are locked until you free space — open Settings and
              use Optimize storage.
            </p>
            {view !== 'settings' ? (
              <button
                type="button"
                className="shrink-0 rounded-md border border-danger px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10"
                onClick={() => setView('settings')}
              >
                Open Settings
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
