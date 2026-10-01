import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

    // Starting weight and intake are prefilled from the latest weigh-in and goal.
    expect(screen.getByTestId('projection-weight')).toHaveValue('200');
    expect(screen.getByTestId('projection-intake')).toHaveValue('1800');

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

  it('can lengthen the projection to two years', async () => {
    const user = userEvent.setup();
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

    await user.click(
      within(screen.getByTestId('projection-weeks')).getByRole('radio', { name: '2 yr' }),
    );

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

    expect(screen.getByTestId('projection-intake')).toHaveValue('2200');

    await user.click(
      within(screen.getByTestId('projection-intake-source')).getByRole('radio', {
        name: 'Logged avg',
      }),
    );

    expect(screen.getByTestId('projection-intake')).toHaveValue('1800');
    expect(screen.getByTestId('projection-intake-hint')).toHaveTextContent(/2 logged days/i);
    expect(screen.getByTestId('projection-summary')).toHaveTextContent(/logged average/i);
  });

  it('can estimate maintenance from weigh-ins and food logs', async () => {
    const user = userEvent.setup();
    const store = useAppStore.getState();
    store.setProjectionProfile({
      sex: 'male',
      ageYears: 35,
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

    render(<ProjectionView />);

    await user.click(
      within(screen.getByTestId('projection-maintenance-source')).getByRole('radio', {
        name: 'From logs',
      }),
    );

    expect(screen.getByTestId('projection-maintenance-hint')).toHaveTextContent(/Estimated/i);
    expect(screen.getByTestId('projection-summary')).toHaveTextContent(/from logs/i);
    expect(screen.queryByTestId('projection-activity')).not.toBeInTheDocument();
  });
});
