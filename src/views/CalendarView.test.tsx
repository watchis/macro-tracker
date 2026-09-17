import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarView } from './CalendarView';
import { formatMonthYear, monthKeyOf, todayKey } from '../lib/dates';
import { useAppStore } from '../store/useAppStore';
import type { MacroAmounts } from '../types';

/** March 2026 starts on a Sunday, which makes the padding math easy to assert. */
const MONTH = '2026-03';
const DAY = '2026-03-05';

function log(date: string, calories: number, macros: MacroAmounts = {}) {
  useAppStore.getState().addEntry(date, { name: 'Food', grams: 100, calories, macros });
}

function cell(date: string): HTMLElement {
  return screen.getByTestId(`calendar-day-${date}`);
}

function cells(): HTMLElement[] {
  return within(screen.getByTestId('calendar-grid')).getAllByRole('button');
}

describe('CalendarView grid', () => {
  it('renders whole weeks with no padding when the month fits exactly', () => {
    render(<CalendarView month={MONTH} />);

    const rendered = cells();
    expect(rendered).toHaveLength(35);
    expect(rendered[0]).toBe(cell('2026-03-01'));
    expect(rendered[34]).toBe(cell('2026-04-04'));
  });

  it('shifts the weekday labels and the leading padding for a Monday week start', () => {
    useAppStore.getState().setWeekStart('monday');
    render(<CalendarView month={MONTH} />);

    expect(screen.getByText('Mon')).toBeInTheDocument();
    const rendered = cells();
    expect(rendered).toHaveLength(42);
    // March 1 is a Sunday, so a Monday-first grid pads back six days.
    expect(rendered[0]).toBe(cell('2026-02-23'));
    expect(rendered[6]).toBe(cell('2026-03-01'));
  });

  it('dims days that belong to a neighbouring month', () => {
    render(<CalendarView month={MONTH} />);

    expect(cell('2026-04-01').className).toContain('opacity-45');
    expect(cell('2026-03-31').className).not.toContain('opacity-45');
  });

  it('keeps untouched days quiet and shows numbers only once a day is logged', () => {
    log(DAY, 1500, { protein: 100, carbs: 120, fat: 40 });
    render(<CalendarView month={MONTH} />);

    expect(cell(DAY)).toHaveAttribute('data-logged', 'true');
    expect(screen.getByTestId(`calendar-remaining-${DAY}`)).toHaveTextContent('500 left');
    expect(within(cell(DAY)).getByText('P')).toBeInTheDocument();
    expect(within(cell(DAY)).getByText('100', { exact: false })).toBeInTheDocument();

    const empty = cell('2026-03-06');
    expect(empty).toHaveAttribute('data-logged', 'false');
    expect(screen.queryByTestId('calendar-remaining-2026-03-06')).not.toBeInTheDocument();
  });

  it('flips a day past its goal into an over-budget readout', () => {
    log(DAY, 2400);
    render(<CalendarView month={MONTH} />);

    expect(screen.getByTestId(`calendar-remaining-${DAY}`)).toHaveTextContent('400 over');
    expect(screen.getByTestId(`calendar-fill-${DAY}`).style.width).toBe('100%');
  });

  it('depletes the cell indicator in proportion to the calories logged', () => {
    log(DAY, 500);
    render(<CalendarView month={MONTH} />);

    expect(screen.getByTestId(`calendar-fill-${DAY}`).style.width).toBe('75%');
  });

  it('reports logged calories instead of a remainder when no goal is set', () => {
    useAppStore.getState().setCalorieGoal(0);
    log(DAY, 640);
    render(<CalendarView month={MONTH} />);

    expect(screen.getByTestId(`calendar-remaining-${DAY}`)).toHaveTextContent('640 kcal');
    expect(screen.queryByTestId(`calendar-fill-${DAY}`)).not.toBeInTheDocument();
  });

  it('shows a cell column per visible macro and drops hidden ones', () => {
    useAppStore.getState().setVisibleMacros(['protein', 'fiber']);
    log(DAY, 500, { protein: 40, carbs: 60, fiber: 5 });
    render(<CalendarView month={MONTH} />);

    const label = cell(DAY).getAttribute('aria-label') ?? '';
    expect(label).toContain('Protein 40 g');
    expect(label).toContain('Fiber 5 g');
    expect(label).not.toContain('Carbs');
  });

  it('summarises the visible month', () => {
    log(DAY, 1500);
    log('2026-03-09', 700);
    log('2026-04-02', 900);
    render(<CalendarView month={MONTH} />);

    expect(screen.getByText('2 days logged · 2,200 kcal total')).toBeInTheDocument();
  });

  it('marks today with the accent and an aria-current date', () => {
    const today = todayKey();
    render(<CalendarView month={monthKeyOf(today)} />);

    expect(cell(today)).toHaveAttribute('aria-current', 'date');
    expect(cell(today).className).toContain('bg-accent-faint');
  });

  it('opens a day in the day view when its cell is clicked', async () => {
    const user = userEvent.setup();
    render(<CalendarView month={MONTH} />);

    await user.click(cell(DAY));

    expect(useAppStore.getState().selectedDate).toBe(DAY);
    expect(useAppStore.getState().view).toBe('day');
  });

  it('lets a caller override the day click handler', async () => {
    const user = userEvent.setup();
    const onOpenDay = vi.fn();
    render(<CalendarView month={MONTH} onOpenDay={onOpenDay} />);

    await user.click(cell(DAY));

    expect(onOpenDay).toHaveBeenCalledWith(DAY);
    expect(useAppStore.getState().view).toBe('calendar');
  });
});

describe('CalendarView navigation', () => {
  it('steps between months and jumps back to today', async () => {
    const user = userEvent.setup();
    render(<CalendarView month={MONTH} />);

    expect(screen.getByTestId('calendar-month')).toHaveTextContent(formatMonthYear(MONTH));

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByTestId('calendar-month')).toHaveTextContent(formatMonthYear('2026-02'));

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByTestId('calendar-month')).toHaveTextContent(formatMonthYear('2026-04'));

    await user.click(screen.getByRole('button', { name: 'Today' }));
    const today = todayKey();
    expect(screen.getByTestId('calendar-month')).toHaveTextContent(
      formatMonthYear(monthKeyOf(today)),
    );
    expect(useAppStore.getState().selectedDate).toBe(today);
    expect(useAppStore.getState().view).toBe('calendar');
  });

  it('follows the selected date when it moves to another month', () => {
    const { rerender } = render(<CalendarView month={MONTH} />);

    useAppStore.getState().setSelectedDate('2026-06-10');
    rerender(<CalendarView month={MONTH} />);

    expect(screen.getByTestId('calendar-month')).toHaveTextContent(formatMonthYear('2026-06'));
  });

  it('moves focus around the grid with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<CalendarView month={MONTH} />);

    cell(DAY).focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(cell('2026-03-06'));

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(cell('2026-03-13'));

    await user.keyboard('{ArrowUp}{ArrowLeft}');
    expect(document.activeElement).toBe(cell('2026-03-05'));

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(cell('2026-03-01'));

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(cell('2026-03-31'));
  });

  it('pages months with PageUp and PageDown', async () => {
    const user = userEvent.setup();
    render(<CalendarView month={MONTH} />);

    cell(DAY).focus();
    await user.keyboard('{PageUp}');
    expect(screen.getByTestId('calendar-month')).toHaveTextContent(formatMonthYear('2026-02'));

    cell('2026-02-05').focus();
    await user.keyboard('{PageDown}');
    expect(screen.getByTestId('calendar-month')).toHaveTextContent(formatMonthYear(MONTH));
  });
});
