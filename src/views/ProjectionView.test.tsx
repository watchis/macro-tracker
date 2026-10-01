import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectionView } from './ProjectionView';
import { useAppStore } from '../store/useAppStore';

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

    // Start weight comes from the nearest weigh-in; intake from the calorie goal.
    expect(screen.getByTestId('projection-start-weight-hint')).toHaveTextContent(/200/);
    expect(screen.getByTestId('projection-intake')).toHaveTextContent('1,800 kcal');
    expect(screen.getByTestId('projection-start-date')).toBeInTheDocument();
    expect(screen.getByTestId('projection-end-date')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Custom' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'From logs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: '6 mo' })).not.toBeInTheDocument();

    expect(screen.getByTestId('projection-summary')).toBeInTheDocument();
    expect(screen.getByTestId('projection-weight-chart')).toBeInTheDocument();

    const table = screen.getByTestId('projection-table');
    expect(within(table).getByText('Date')).toBeInTheDocument();
    expect(within(table).getByText('Calories used')).toBeInTheDocument();
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(10);

    expect(useAppStore.getState().settings.projection).toMatchObject({
      sex: 'male',
      ageYears: 35,
      heightCm: 177.8,
      activity: 1.2,
    });
  });

  it('uses start and end dates to set the projection horizon', () => {
    useAppStore.getState().setProjectionProfile({
      sex: 'female',
      ageYears: 30,
      heightCm: 165,
      activity: 1.375,
    });
    useAppStore.getState().setWeight('2026-09-20', 70, 'kg');
    useAppStore.getState().setWeightUnit('kg');
    useAppStore.getState().setCalorieGoal(1600);

    render(<ProjectionView />);

    fireEvent.change(screen.getByTestId('projection-start-date'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByTestId('projection-end-date'), {
      target: { value: '2028-09-28' }, // 104 weeks = 728 days after start
    });

    expect(screen.getByTestId('projection-horizon-hint')).toHaveTextContent(/104 weeks/i);

    const rows = within(screen.getByTestId('projection-table')).getAllByRole('row');
    // header + 104 weekly rows
    expect(rows).toHaveLength(105);
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
    expect(screen.getByTestId('projection-intake-hint')).toHaveTextContent(/2 logged days/i);
    expect(screen.getByTestId('projection-summary')).toHaveTextContent(/logged average/i);
  });
});
