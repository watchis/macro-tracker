import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphsView } from './GraphsView';
import { lbToKg } from '../lib/weight';
import { useAppStore } from '../store/useAppStore';

describe('GraphsView', () => {
  it('shows empty states when there is nothing to chart', () => {
    render(<GraphsView />);

    expect(screen.getByRole('heading', { name: 'Graphs' })).toBeInTheDocument();
    expect(screen.getByTestId('weight-chart')).toHaveTextContent(/weigh-in/i);
    expect(screen.getByTestId('calorie-chart')).toHaveTextContent(/Log food/i);
    expect(screen.getByTestId('calorie-delta-chart')).toHaveTextContent(/Log food|calorie goal/i);
  });

  it('charts weight, calories and overages once data exists', async () => {
    const user = userEvent.setup();
    const store = useAppStore.getState();
    store.setCalorieGoal(2000);
    store.setWeightUnit('lb');
    store.setWeight('2026-09-10', 180, 'lb');
    store.setWeight('2026-09-17', 178, 'lb');
    store.addEntry('2026-09-10', { name: 'Lunch', grams: 100, calories: 1800, macros: {} });
    store.addEntry('2026-09-17', { name: 'Dinner', grams: 100, calories: 2300, macros: {} });

    render(<GraphsView />);

    expect(screen.getByTestId('weight-chart').querySelector('circle')).toBeTruthy();
    expect(screen.getByTestId('calorie-chart').querySelector('circle')).toBeTruthy();
    expect(screen.getByTestId('calorie-delta-chart').querySelector('rect')).toBeTruthy();
    expect(screen.getByText(/Avg/i)).toBeInTheDocument();

    await user.click(
      within(screen.getByTestId('graphs-weight-unit')).getByRole('radio', { name: 'kg' }),
    );
    expect(useAppStore.getState().settings.weightUnit).toBe('kg');
    expect(useAppStore.getState().weights['2026-09-10']).toBeCloseTo(lbToKg(180), 3);
  });
});
