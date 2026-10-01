import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectionView } from './ProjectionView';
import { useAppStore } from '../store/useAppStore';

function seedReadyProfile() {
  useAppStore.getState().setProjectionProfile({
    sex: 'female',
    ageYears: 30,
    heightCm: 165,
    activity: 1.375,
  });
  useAppStore.getState().setWeight('2026-09-20', 70, 'kg');
  useAppStore.getState().setWeightUnit('kg');
  useAppStore.getState().setCalorieGoal(1600);
}

describe('ProjectionView', () => {
  it('prompts for missing profile fields before projecting', () => {
    render(<ProjectionView />);

    expect(screen.getByRole('heading', { name: 'Projection' })).toBeInTheDocument();
    expect(screen.getByTestId('projection-incomplete')).toBeInTheDocument();
    expect(screen.queryByTestId('projection-table')).not.toBeInTheDocument();
  });

  it('projects weekly weight, maintenance, and deficit from a filled form', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCalorieGoal(1800);
    useAppStore.getState().setWeightUnit('lb');
    useAppStore.getState().setWeight('2026-09-20', 200, 'lb');

    render(<ProjectionView />);

    await user.selectOptions(screen.getByTestId('projection-sex'), 'male');

    const age = screen.getByTestId('projection-age');
    await user.clear(age);
    await user.type(age, '35');

    const height = screen.getByTestId('projection-height');
    await user.clear(height);
    await user.type(height, '70');

    // No start date → manual starting weight (prefilled from latest weigh-in).
    expect(screen.getByTestId('projection-start-date')).toHaveValue('');
    expect(screen.getByTestId('projection-weight')).toHaveValue('200');
    expect(screen.getByTestId('projection-intake')).toHaveTextContent('1,800 kcal');
    expect(screen.getByTestId('projection-end-date')).toHaveValue('');
    expect(screen.queryByRole('radio', { name: 'Custom' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'From logs' })).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('projection-horizon-preset')).getByRole('radio', { name: '1 yr' }),
    ).toHaveAttribute('aria-checked', 'true');
    // Helper / remnant copy should be gone.
    expect(screen.queryByText(/Profile fields are saved/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('projection-intake-hint')).not.toBeInTheDocument();
    expect(screen.queryByTestId('projection-horizon-hint')).not.toBeInTheDocument();

    expect(screen.getByTestId('projection-summary')).toBeInTheDocument();
    expect(screen.getByTestId('projection-weight-chart')).toBeInTheDocument();

    const table = screen.getByTestId('projection-table');
    expect(within(table).getByText('Date')).toBeInTheDocument();
    expect(within(table).getByText('Calories used')).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(53); // header + 52 weeks

    expect(useAppStore.getState().settings.projection).toMatchObject({
      sex: 'male',
      ageYears: 35,
      heightCm: 177.8,
      activity: 1.2,
    });
  });

  it('uses a weigh-in near the start date when a start date is set', () => {
    seedReadyProfile();
    useAppStore.getState().setWeight('2026-10-01', 68, 'kg');

    render(<ProjectionView />);

    fireEvent.change(screen.getByTestId('projection-start-date'), {
      target: { value: '2026-10-01' },
    });

    expect(screen.queryByTestId('projection-weight')).not.toBeInTheDocument();
    expect(screen.getByTestId('projection-start-weight')).toHaveTextContent(/68/);
    expect(screen.getByTestId('projection-summary')).toBeInTheDocument();
  });

  it('uses a duration preset when end date is blank', async () => {
    const user = userEvent.setup();
    seedReadyProfile();

    render(<ProjectionView />);

    await user.click(
      within(screen.getByTestId('projection-horizon-preset')).getByRole('radio', {
        name: '3 mo',
      }),
    );

    expect(within(screen.getByTestId('projection-table')).getAllByRole('row')).toHaveLength(14);
    expect(screen.getByTestId('projection-summary')).toHaveTextContent(/3 mo/i);
  });

  it('uses an explicit end date instead of presets', () => {
    seedReadyProfile();

    render(<ProjectionView />);

    fireEvent.change(screen.getByTestId('projection-start-date'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByTestId('projection-end-date'), {
      target: { value: '2028-09-28' }, // 104 weeks = 728 days after start
    });

    expect(screen.queryByTestId('projection-horizon-preset')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('projection-table')).getAllByRole('row')).toHaveLength(105);
  });

  it('restores presets when the end date is cleared', async () => {
    const user = userEvent.setup();
    seedReadyProfile();

    render(<ProjectionView />);

    fireEvent.change(screen.getByTestId('projection-end-date'), {
      target: { value: '2027-04-01' },
    });
    expect(screen.queryByTestId('projection-horizon-preset')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('projection-end-date'), {
      target: { value: '' },
    });

    expect(screen.getByTestId('projection-horizon-preset')).toBeInTheDocument();
    await user.click(
      within(screen.getByTestId('projection-horizon-preset')).getByRole('radio', {
        name: '6 mo',
      }),
    );
    expect(within(screen.getByTestId('projection-table')).getAllByRole('row')).toHaveLength(27);
  });

  it('projects until a goal weight when that horizon is selected', async () => {
    const user = userEvent.setup();
    seedReadyProfile();

    render(<ProjectionView />);

    await user.click(
      within(screen.getByTestId('projection-horizon-preset')).getByRole('radio', {
        name: 'Goal weight',
      }),
    );

    const goal = screen.getByTestId('projection-goal-weight');
    await user.clear(goal);
    await user.type(goal, '65');

    expect(screen.getByTestId('projection-summary')).toHaveTextContent(/Goal/i);
    const rows = within(screen.getByTestId('projection-table')).getAllByRole('row');
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.length).toBeLessThan(53);
  });

  it('can drive intake from recent food logs', async () => {
    const user = userEvent.setup();
    const store = useAppStore.getState();
    store.setProjectionProfile({
      sex: 'male',
      ageYears: 35,
      heightCm: 178,
      activity: 1.2,
    });
    store.setCalorieGoal(2200);
    store.setWeight('2026-09-01', 200, 'lb');
    store.setWeight('2026-09-20', 198, 'lb');
    store.addEntry('2026-09-25', { name: 'Lunch', grams: 100, calories: 1700, macros: {} });
    store.addEntry('2026-09-28', { name: 'Dinner', grams: 100, calories: 1900, macros: {} });

    render(<ProjectionView />);

    expect(screen.getByTestId('projection-intake')).toHaveTextContent('2,200 kcal');

    await user.click(
      within(screen.getByTestId('projection-intake-source')).getByRole('radio', {
        name: 'Logged avg',
      }),
    );

    expect(screen.getByTestId('projection-intake')).toHaveTextContent('1,800 kcal');
    expect(screen.getByTestId('projection-summary')).toHaveTextContent(/1,800/);
  });
});
