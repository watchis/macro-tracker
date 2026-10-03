import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  addDays,
  addMonths,
  dayOfMonth,
  formatMonthYear,
  monthKeyOf,
  todayKey,
} from '../lib/dates';
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
    expect(
      within(screen.getByTestId('home-mini-calendar')).getByTestId('calendar-month'),
    ).toHaveTextContent(formatMonthYear(monthKeyOf(todayKey())));
    expect(screen.queryByTestId('home-weight-unit')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Full calendar' })).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('home-mini-calendar')).getByRole('button', {
        name: 'Previous month',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('home-mini-calendar')).getByRole('button', { name: 'Next month' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('home-mini-calendar')).getByRole('button', { name: 'Today' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('home-chart')).toBeInTheDocument();
    expect(screen.getByTestId('weight-chart')).toHaveTextContent(/weigh-in/i);
    expect(screen.queryByTestId('calorie-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('calorie-delta-chart')).not.toBeInTheDocument();
  });

  it('lets the mini calendar step months and jump back to today', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    // Stay in the current month so Previous/Next assertions stay relative to it.
    const otherInMonth = dayOfMonth(today) > 1 ? addDays(today, -1) : addDays(today, 1);
    useAppStore.getState().setSelectedDate(otherInMonth);
    render(<HomeView />);

    const mini = screen.getByTestId('home-mini-calendar');
    const monthLabel = () => within(mini).getByTestId('calendar-month');
    const currentMonth = monthKeyOf(today);

    await user.click(within(mini).getByRole('button', { name: 'Previous month' }));
    expect(monthLabel()).toHaveTextContent(formatMonthYear(addMonths(currentMonth, -1)));

    await user.click(within(mini).getByRole('button', { name: 'Next month' }));
    await user.click(within(mini).getByRole('button', { name: 'Next month' }));
    expect(monthLabel()).toHaveTextContent(formatMonthYear(addMonths(currentMonth, 1)));

    await user.click(within(mini).getByRole('button', { name: 'Today' }));
    expect(monthLabel()).toHaveTextContent(formatMonthYear(currentMonth));
    expect(useAppStore.getState().selectedDate).toBe(today);
    expect(useAppStore.getState().view).not.toBe('day');
  });

  it('selects an inactive mini-calendar day, then opens it on a second click', async () => {
    const user = userEvent.setup();
    const today = todayKey();
    const other = addDays(today, -2);
    useAppStore.getState().setSelectedDate(today);
    render(<HomeView />);

    const mini = screen.getByTestId('home-mini-calendar');
    await user.click(within(mini).getByTestId(`mini-calendar-day-${other}`));
    expect(useAppStore.getState().selectedDate).toBe(other);
    expect(useAppStore.getState().view).toBe('home');

    await user.click(within(mini).getByTestId(`mini-calendar-day-${other}`));
    expect(useAppStore.getState().view).toBe('day');
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

  it('defaults projected weight to the chart and toggles to the weekly table', async () => {
    const user = userEvent.setup();
    const store = useAppStore.getState();
    store.setProjectionProfile({
      sex: 'female',
      birthday: '1996-06-01',
      heightCm: 165,
      activity: 1.375,
      startMode: 'weight',
      endMode: '13',
      startWeightKg: 70,
    });
    store.setCalorieGoal(1600);
    store.setWeightUnit('kg');

    render(<HomeView />);

    expect(screen.getByTestId('home-projection')).toBeInTheDocument();
    expect(screen.getByTestId('home-projection-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('home-projection-table')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('home-projection-view')).getByRole('radio', { name: 'Chart' }),
    ).toHaveAttribute('aria-checked', 'true');

    await user.click(
      within(screen.getByTestId('home-projection-view')).getByRole('radio', { name: 'Weekly' }),
    );

    expect(screen.queryByTestId('home-projection-chart')).not.toBeInTheDocument();
    const table = screen.getByTestId('home-projection-table');
    expect(within(table).getByText('Date')).toBeInTheDocument();
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
  });

  it('hides the projected weight section when the profile is incomplete', () => {
    render(<HomeView />);
    expect(screen.queryByTestId('home-projection')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-projection-table')).not.toBeInTheDocument();
  });
});
