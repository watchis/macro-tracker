import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BudgetBar } from './BudgetBar';
import { useAppStore } from '../store/useAppStore';

const DATE = '2026-09-17';

function log(calories: number, macros: Record<string, number> = {}) {
  useAppStore.getState().addEntry(DATE, { name: 'Food', grams: 100, calories, macros });
}

function fillWidth(): string {
  return screen.getByTestId('budget-progress-fill').style.width;
}

describe('BudgetBar', () => {
  it('starts at a full bar with the whole budget remaining', () => {
    render(<BudgetBar date={DATE} />);

    expect(screen.getByTestId('budget-headline')).toHaveTextContent('2,000 kcal left');
    expect(fillWidth()).toBe('100%');
    expect(screen.getByTestId('budget-bar')).toHaveAttribute('data-over-budget', 'false');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('depletes as the day is logged', () => {
    log(1500, { protein: 100 });
    render(<BudgetBar date={DATE} />);

    expect(screen.getByTestId('budget-headline')).toHaveTextContent('500 kcal left');
    expect(fillWidth()).toBe('25%');
    expect(screen.getByTestId('macro-chip-protein')).toHaveTextContent('50 g left');
  });

  it('switches to an over-budget state past the goal', () => {
    log(2400, { protein: 180 });
    render(<BudgetBar date={DATE} />);

    expect(screen.getByTestId('budget-headline')).toHaveTextContent('400 kcal over');
    expect(screen.getByTestId('budget-bar')).toHaveAttribute('data-over-budget', 'true');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByTestId('macro-chip-protein')).toHaveTextContent('30 g over');
  });

  it('shows a chip for each visible macro and nothing for hidden ones', () => {
    useAppStore.getState().setVisibleMacros(['protein', 'fiber']);
    log(500, { protein: 40, carbs: 60, fiber: 5 });
    render(<BudgetBar date={DATE} />);

    expect(screen.getByTestId('macro-chip-protein')).toBeInTheDocument();
    expect(screen.getByTestId('macro-chip-fiber')).toBeInTheDocument();
    expect(screen.queryByTestId('macro-chip-carbs')).not.toBeInTheDocument();
    // Fiber has no goal by default, so the chip falls back to the consumed amount.
    expect(screen.getByTestId('macro-chip-fiber')).toHaveTextContent('5 g');
  });

  it('reports logged calories instead of a budget when no goal is set', () => {
    useAppStore.getState().setCalorieGoal(0);
    log(650);
    render(<BudgetBar date={DATE} />);

    expect(screen.getByTestId('budget-headline')).toHaveTextContent('650 kcal logged');
    expect(fillWidth()).toBe('100%');
  });

  it('depletes proportionally at every point of the day', () => {
    log(500);
    const { rerender } = render(<BudgetBar date={DATE} />);
    expect(fillWidth()).toBe('75%');

    log(500);
    rerender(<BudgetBar date={DATE} />);
    expect(fillWidth()).toBe('50%');
    expect(screen.getByTestId('budget-headline')).toHaveTextContent('1,000 kcal left');

    log(1000);
    rerender(<BudgetBar date={DATE} />);
    expect(fillWidth()).toBe('0%');
    expect(screen.getByTestId('budget-headline')).toHaveTextContent('0 kcal left');
    expect(screen.getByTestId('budget-bar')).toHaveAttribute('data-over-budget', 'false');
  });

  it('refills with the overshoot once past the goal', () => {
    log(3000);
    const { unmount } = render(<BudgetBar date={DATE} />);

    // 1,000 kcal over a 2,000 kcal goal is half the budget again.
    expect(fillWidth()).toBe('50%');
    expect(screen.getByTestId('budget-over-badge')).toBeInTheDocument();
    unmount();

    useAppStore.getState().clearDay(DATE);
    log(2050);
    render(<BudgetBar date={DATE} />);

    // A sliver stays visible even when barely over.
    expect(fillWidth()).toBe('6%');
    expect(screen.getByTestId('budget-headline')).toHaveTextContent('50 kcal over');
  });

  it('publishes its height so content can clear the fixed bar', () => {
    const { unmount } = render(<BudgetBar date={DATE} />);

    expect(document.documentElement.style.getPropertyValue('--budget-bar-height')).toMatch(/px$/);

    unmount();
    expect(document.documentElement.style.getPropertyValue('--budget-bar-height')).toBe('');
  });

  it('follows the selected date when no date prop is given', () => {
    useAppStore.getState().openDay(DATE);
    log(1000);
    render(<BudgetBar />);

    expect(screen.getByTestId('budget-headline')).toHaveTextContent('1,000 kcal left');
  });
});
