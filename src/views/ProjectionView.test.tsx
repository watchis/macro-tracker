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
});
