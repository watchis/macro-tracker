import { AccentPicker } from '../components/settings/AccentPicker';
import { DataSettings } from '../components/settings/DataSettings';
import { ImportExportSettings } from '../components/settings/ImportExportSettings';
import { MacroSettings } from '../components/settings/MacroSettings';
import { SegmentedControl } from '../components/settings/SegmentedControl';
import { SettingsSection } from '../components/settings/SettingsSection';
import { useAppStore } from '../store/useAppStore';
import { useSettings } from '../store/selectors';
import { useTheme } from '../theme/useTheme';
import type { SegmentedOption } from '../components/settings/SegmentedControl';
import type { ThemeMode, WeightUnit } from '../types';

/** Preferences and data management. */
export function SettingsView() {
  const settings = useSettings();
  // Re-applying the already-applied theme is a no-op; the return value is what
  // labels the "System" option with the theme it currently resolves to.
  const resolvedTheme = useTheme();
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const setAccent = useAppStore((state) => state.setAccent);
  const setWeightUnit = useAppStore((state) => state.setWeightUnit);

  const themeOptions: ReadonlyArray<SegmentedOption<ThemeMode>> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System', hint: `(${resolvedTheme})` },
  ];

  const weightUnitOptions: ReadonlyArray<SegmentedOption<WeightUnit>> = [
    { value: 'lb', label: 'lb' },
    { value: 'kg', label: 'kg' },
  ];

  return (
    <div className="grid gap-5">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <SettingsSection id="goals" title="Goals and macros">
        <MacroSettings />
      </SettingsSection>

      <SettingsSection id="appearance" title="Appearance">
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
          <div>
            <span className="block text-xs font-medium tracking-wide text-muted uppercase">
              Weight unit
            </span>
            <p className="mt-1 text-xs text-muted">
              Used on the Day weigh-in and Graphs page. Stored weights stay in kilograms.
            </p>
            <div className="mt-2">
              <SegmentedControl
                label="Weight unit"
                testId="settings-weight-unit"
                value={settings.weightUnit}
                options={weightUnitOptions}
                onChange={setWeightUnit}
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection id="import-export" title="Import/Export">
        <ImportExportSettings />
      </SettingsSection>

      <SettingsSection id="data" title="Data">
        <DataSettings />
      </SettingsSection>
    </div>
  );
}
