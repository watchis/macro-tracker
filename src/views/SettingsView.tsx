import { ViewPlaceholder } from '../components/ViewPlaceholder';
import { useFoodLibrary, useSettings } from '../store/selectors';

/**
 * Preferences, food library and data management. Placeholder for the settings
 * feature work: every control maps to a store action (`setThemeMode`,
 * `setAccent`, `toggleMacro`, `setCalorieGoal`, `setMacroGoal`, `setWeekStart`,
 * `addFood` / `updateFood` / `removeFood`, `exportJson` / `importJson` /
 * `resetAll`).
 */
export function SettingsView() {
  const settings = useSettings();
  const foodLibrary = useFoodLibrary();

  return (
    <ViewPlaceholder
      title="Settings"
      description={`Theme ${settings.themeMode} · accent ${settings.accent} · ${settings.visibleMacros.length} visible macros · ${foodLibrary.length} foods in the library.`}
      items={[
        'Theme mode and accent color picker',
        'Macro show/hide toggles and per-macro goals',
        'Daily calorie goal and week start',
        'Food library management',
        'JSON export, import and reset',
      ]}
    />
  );
}
