import { AccentPicker } from '../components/settings/AccentPicker';
import { DataSettings } from '../components/settings/DataSettings';
import { FoodLibrarySettings } from '../components/settings/FoodLibrarySettings';
import { MacroSettings } from '../components/settings/MacroSettings';
import { SegmentedControl } from '../components/settings/SegmentedControl';
import { SettingsSection } from '../components/settings/SettingsSection';
import { useAppStore } from '../store/useAppStore';
import { useSettings } from '../store/selectors';
import { useTheme } from '../theme/useTheme';
import type { SegmentedOption } from '../components/settings/SegmentedControl';
import type { ThemeMode, WeekStart } from '../types';

const WEEK_START_OPTIONS: ReadonlyArray<SegmentedOption<WeekStart>> = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

/** Preferences, food library and data management. */
export function SettingsView() {
  const settings = useSettings();
  // Re-applying the already-applied theme is a no-op; the return value is what
  // labels the "System" option with the theme it currently resolves to.
  const resolvedTheme = useTheme();
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const setAccent = useAppStore((state) => state.setAccent);
  const setWeekStart = useAppStore((state) => state.setWeekStart);

  const themeOptions: ReadonlyArray<SegmentedOption<ThemeMode>> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System', hint: `(${resolvedTheme})` },
  ];

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Everything is stored in this browser. Export a copy before clearing site data.
        </p>
      </div>

      <SettingsSection
        id="appearance"
        title="Appearance"
        description="Neutral gray and white surfaces, with one accent color you choose."
      >
        <div className="grid gap-5">
          <div>
            <span className="block text-xs font-medium tracking-wide text-muted uppercase">
              Theme
            </span>
            <div className="mt-2">
              <SegmentedControl
                label="Theme mode"
                testId="theme-mode"
                value={settings.themeMode}
                options={themeOptions}
                onChange={setThemeMode}
              />
            </div>
          </div>
          <AccentPicker accent={settings.accent} onChange={setAccent} />
        </div>
      </SettingsSection>

      <SettingsSection
        id="goals"
        title="Goals and macros"
        description="Targets drive the budget bar, and hidden macros disappear from tables and chips."
      >
        <MacroSettings />
      </SettingsSection>

      <SettingsSection id="calendar" title="Calendar" description="How the month grid is laid out.">
        <div>
          <span className="block text-xs font-medium tracking-wide text-muted uppercase">
            Week starts on
          </span>
          <div className="mt-2">
            <SegmentedControl
              label="Week starts on"
              testId="week-start"
              value={settings.weekStart}
              options={WEEK_START_OPTIONS}
              onChange={setWeekStart}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        id="library"
        title="Food library"
        description="Reusable foods, stated for a reference weight and scaled when you log them."
      >
        <FoodLibrarySettings />
      </SettingsSection>

      <SettingsSection
        id="data"
        title="Data"
        description="Move your log between browsers, or start over."
      >
        <DataSettings />
      </SettingsSection>
    </div>
  );
}
