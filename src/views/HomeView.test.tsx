import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatMonthYear, monthKeyOf, todayKey } from '../lib/dates';
import { HomeView } from './HomeView';
import { useAppStore } from '../store/useAppStore';

describe('HomeView', () => {
  it('shows snapshot cards, mini calendar, and a switchable empty chart', () => {
    render(<HomeView />);

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByTestId('home-today-card')).toBeInTheDocument();
    expect(screen.getByTestId('home-week-card')).toBeInTheDocument();
    expect(screen.getByTestId('home-weight-card')).toBeInTheDocument();
    expect(screen.getByTestId('home-mini-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('mini-calendar-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-month')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('home-mini-calendar')).queryByText(
        formatMonthYear(monthKeyOf(todayKey())),
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-weight-unit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Full calendar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous month' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next month' })).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('home-mini-calendar')).queryByRole('button', { name: 'Today' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('home-chart')).toBeInTheDocument();
    expect(screen.getByTestId('weight-chart')).toHaveTextContent(/weigh-in/i);
    expect(screen.queryByTestId('calorie-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calorie-delta-chart')).not.toBeInTheDocument();
  });

  it('switches charts using the Settings weight unit and opens today from the today card', async () => {
    const user = userEvent.setup();
    const store = useAppStore.getState();
    store.setCalorieGoal(2000);
    store.setWeightUnit('kg');
    store.setWeight('2026-09-10', 81.65, 'kg');
    store.setWeight('2026-09-17', 80.74, 'kg');
    store.addEntry('2026-09-10', { name: 'Lunch', grams: 100, calories: 1800, macros: {} });
    store.addEntry('2026-09-17', { name: 'Dinner', grams: 100, calories: 2300, macros: {} });

    render(<HomeView />);

    expect(screen.getByTestId('weight-chart').querySelector('circle')).toBeTruthy();
    expect(screen.getByText(/Avg 81/i)).toBeInTheDocument();
    expect(screen.getByText(/kg\/day/i)).toBeInTheDocument();

    await user.click(
      within(screen.getByTestId('home-chart-switch')).getByRole('radio', { name: 'Calories' }),
    );
    expect(screen.getByTestId('calorie-chart').querySelector('circle')).toBeTruthy();
    expect(screen.queryByTestId('weight-chart')).not.toBeInTheDocument();

    await user.click(
      within(screen.getByTestId('home-chart-switch')).getByRole('radio', { name: 'Over / under' }),
    );
    expect(screen.getByTestId('calorie-delta-chart').querySelector('rect')).toBeTruthy();
    expect(screen.queryByTestId('calorie-chart')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('home-today-card'));
    expect(useAppStore.getState().view).toBe('day');
  });
});
