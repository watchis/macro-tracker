import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetBar } from '../components/BudgetBar';
import { GoalsView } from './GoalsView';
import { useAppStore } from '../store/useAppStore';

/** Birthday that yields age 35 on 2026-10-01 (and near that date). */
const BIRTHDAY_AGE_35 = '1991-03-15';

function state() {
  return useAppStore.getState();
}

describe('GoalsView', () => {
  it('shows goals and macros plus an incomplete projection prompt', () => {
    render(<GoalsView />);

    expect(screen.getByRole('heading', { name: 'Goals' })).toBeInTheDocument();
    expect(screen.getByTestId('settings-section-goals')).toBeInTheDocument();
    expect(screen.getByTestId('calorie-goal-input')).toBeInTheDocument();
    expect(screen.getByTestId('projection-incomplete')).toBeInTheDocument();
    expect(screen.queryByTestId('projection-table')).not.toBeInTheDocument();
  });

  it('validates the calorie goal and keeps the last valid value', async () => {
    const user = userEvent.setup();
    render(<GoalsView />);
    const input = screen.getByTestId('calorie-goal-input');

    await user.clear(input);
    await user.type(input, '1800');
    expect(state().settings.goals.calories).toBe(1800);

    await user.clear(input);
    await user.type(input, '-5');
    expect(screen.getByRole('alert')).toHaveTextContent('Must be 0 or more.');
    expect(state().settings.goals.calories).toBe(1800);
  });

  it('sets and clears per-macro goals', async () => {
    const user = userEvent.setup();
    render(<GoalsView />);

    const fiber = screen.getByTestId('macro-goal-fiber');
    await user.type(fiber, '30');
    expect(state().settings.goals.macros.fiber).toBe(30);

    await user.clear(screen.getByTestId('macro-goal-protein'));
    expect(state().settings.goals.macros.protein).toBeUndefined();
  });

  it('rejects a macro goal that is not a number', async () => {
    const user = userEvent.setup();
    render(<GoalsView />);

    await user.type(screen.getByTestId('macro-goal-carbs'), 'abc');

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number.');
    expect(state().settings.goals.macros.carbs).toBe(200);
  });

  it('shows and hides macros, in the canonical order', async () => {
    const user = userEvent.setup();
    render(<GoalsView />);

    await user.click(screen.getByTestId('macro-toggle-fiber'));
    expect(state().settings.visibleMacros).toEqual(['protein', 'carbs', 'fat', 'fiber']);

    await user.click(screen.getByTestId('macro-toggle-carbs'));
    expect(state().settings.visibleMacros).toEqual(['protein', 'fat', 'fiber']);
    expect(screen.getByTestId('macro-toggle-carbs')).not.toBeChecked();
  });

  it('drives which chips the budget bar renders', async () => {
    const user = userEvent.setup();
    render(
      <>
        <GoalsView />
        <BudgetBar date="2026-09-17" />
      </>,
    );

    expect(screen.getByTestId('macro-chip-carbs')).toBeInTheDocument();
    expect(screen.queryByTestId('macro-chip-sodium')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('macro-toggle-carbs'));
    await user.click(screen.getByTestId('macro-toggle-sodium'));

    expect(screen.queryByTestId('macro-chip-carbs')).not.toBeInTheDocument();
    expect(screen.getByTestId('macro-chip-sodium')).toBeInTheDocument();
  });

  it('projects weekly weight from profile fields and goal series', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCalorieGoal(1800);
    useAppStore.getState().setWeightUnit('lb');
    useAppStore.getState().setWeight('2026-09-20', 200, 'lb');

    render(<GoalsView />);

    await user.selectOptions(screen.getByTestId('projection-sex'), 'male');

    fireEvent.change(screen.getByTestId('projection-birthday'), {
      target: { value: BIRTHDAY_AGE_35 },
    });
    expect(screen.getByTestId('projection-age-hint')).toHaveTextContent(/Age 3[45]/);

    const height = screen.getByTestId('projection-height');
    await user.clear(height);
    await user.type(height, '70');

    expect(screen.getByTestId('projection-weight')).toHaveValue('200');
    expect(screen.getByTestId('projection-series-goal')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('projection-series-formula')).toHaveAttribute('aria-pressed', 'true');

    expect(screen.getByTestId('projection-summary')).toHaveTextContent(/Goal · Formula/);
    expect(screen.getByTestId('projection-weight-chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-series-goal-formula')).toBeInTheDocument();

    const table = screen.getByTestId('projection-table');
    expect(within(table).getByText('Date')).toBeInTheDocument();
    expect(within(table).getByText('Calories used')).toBeInTheDocument();
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(10);

    expect(useAppStore.getState().settings.projection).toMatchObject({
      sex: 'male',
      birthday: BIRTHDAY_AGE_35,
      heightCm: 177.8,
      activity: 1.2,
    });
  });

  it('can lengthen the projection to two years', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setProjectionProfile({
      sex: 'female',
      birthday: '1996-06-01',
      heightCm: 165,
      activity: 1.375,
    });
    useAppStore.getState().setWeight('2026-09-20', 70, 'kg');
    useAppStore.getState().setWeightUnit('kg');
    useAppStore.getState().setCalorieGoal(1600);

    render(<GoalsView />);

    await user.click(
      within(screen.getByTestId('projection-weeks')).getByRole('radio', { name: '2 yr' }),
    );

    const rows = within(screen.getByTestId('projection-table')).getAllByRole('row');
    // header + 104 weekly rows
    expect(rows).toHaveLength(105);
  });

  it('overlays logged-average intake on the chart when toggled', async () => {
    const user = userEvent.setup();
    const store = useAppStore.getState();
    store.setProjectionProfile({
      sex: 'male',
      birthday: BIRTHDAY_AGE_35,
      heightCm: 178,
      activity: 1.2,
    });
    store.setCalorieGoal(2200);
    store.setWeight('2026-09-01', 200, 'lb');
    store.setWeight('2026-09-20', 198, 'lb');
    store.addEntry('2026-09-25', { name: 'Lunch', grams: 100, calories: 1700, macros: {} });
    store.addEntry('2026-09-28', { name: 'Dinner', grams: 100, calories: 1900, macros: {} });

    render(<GoalsView />);

    expect(screen.getByTestId('chart-series-goal-formula')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-series-logged-formula')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('projection-series-logged'));

    expect(screen.getByTestId('projection-series-logged')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('chart-series-logged-formula')).toBeInTheDocument();
    expect(screen.getByTestId('projection-series-legend')).toHaveTextContent(/Logged · Formula/);
    expect(screen.getByTestId('projection-summary')).toHaveTextContent(/other scenario/);
  });

  it('overlays from-logs maintenance on the chart when toggled', async () => {
    const user = userEvent.setup();
    const store = useAppStore.getState();
    store.setProjectionProfile({
      sex: 'male',
      birthday: BIRTHDAY_AGE_35,
      heightCm: 178,
      activity: 1.2,
    });
    store.setCalorieGoal(1800);
    store.setWeightUnit('lb');
    store.setWeight('2026-09-01', 200, 'lb');
    store.setWeight('2026-09-15', 198, 'lb');
    for (let day = 1; day <= 15; day += 1) {
      const key = `2026-09-${String(day).padStart(2, '0')}`;
      store.addEntry(key, { name: 'Meal', grams: 100, calories: 1800, macros: {} });
    }

    render(<GoalsView />);

    expect(screen.getByTestId('projection-activity')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-series-goal-logs')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('projection-series-logs'));

    expect(screen.getByTestId('projection-series-logs')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('chart-series-goal-logs')).toBeInTheDocument();
    expect(screen.getByTestId('projection-series-legend')).toHaveTextContent(/Goal · From logs/);
  });
});
