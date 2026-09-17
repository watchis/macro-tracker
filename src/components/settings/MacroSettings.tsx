import { NumberField } from './NumberField';
import { MACROS } from '../../lib/macros';
import { useAppStore } from '../../store/useAppStore';
import { useGoals, useVisibleMacros } from '../../store/selectors';

/**
 * Daily calorie goal plus, for each macro, whether it shows in tables and chips
 * and what its daily target is. Hidden macros keep their goal so turning one
 * back on does not lose the number.
 */
export function MacroSettings() {
  const goals = useGoals();
  const visibleMacros = useVisibleMacros();
  const setCalorieGoal = useAppStore((state) => state.setCalorieGoal);
  const setMacroGoal = useAppStore((state) => state.setMacroGoal);
  const toggleMacro = useAppStore((state) => state.toggleMacro);

  return (
    <div className="grid gap-5">
      <NumberField
        label="Daily calorie goal"
        testId="calorie-goal-input"
        value={goals.calories}
        unit="kcal"
        integer
        max={20000}
        onCommit={(value) => setCalorieGoal(value ?? 0)}
        className="max-w-48"
      />
      <p className="-mt-3 text-xs text-subtle">
        Set 0 to hide the budget and just count what you log.
      </p>

      <div>
        <span className="block text-xs font-medium tracking-wide text-muted uppercase">
          Macros and targets
        </span>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {MACROS.map((macro) => {
            const visible = visibleMacros.includes(macro.key);
            return (
              <li
                key={macro.key}
                data-testid={`macro-row-${macro.key}`}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    data-testid={`macro-toggle-${macro.key}`}
                    checked={visible}
                    onChange={() => toggleMacro(macro.key)}
                    className="size-4"
                  />
                  <span className={visible ? 'text-ink' : 'text-subtle'}>{macro.label}</span>
                </label>
                <NumberField
                  label={`${macro.label} goal`}
                  labelHidden
                  testId={`macro-goal-${macro.key}`}
                  value={goals.macros[macro.key]}
                  unit={macro.unit}
                  allowEmpty
                  placeholder="No goal"
                  max={macro.unit === 'mg' ? 100000 : 2000}
                  onCommit={(value) => setMacroGoal(macro.key, value)}
                  className="w-32"
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
