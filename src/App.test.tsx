import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { todayKey } from './lib/dates';
import { useAppStore } from './store/useAppStore';

describe('App shell', () => {
  it('renders the calendar view, the header and the budget bar', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByTestId('budget-bar')).toBeInTheDocument();
  });

  it('switches views from the header nav', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(useAppStore.getState().view).toBe('settings');

    await user.click(screen.getByRole('button', { name: 'Day' }));
    expect(useAppStore.getState().view).toBe('day');
  });

  it('opens the day view from a calendar day cell', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByTestId(`calendar-day-${todayKey()}`));
    expect(useAppStore.getState().view).toBe('day');
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-current', 'page');
  });

  it('applies the theme and accent to the document element', () => {
    useAppStore.getState().setThemeMode('dark');
    useAppStore.getState().setAccent('#00ff00');
    render(<App />);

    const root = document.documentElement;
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.getPropertyValue('--accent')).toBe('#00ff00');
    // Bright accent, so the contrast ink flips to near-black.
    expect(root.style.getPropertyValue('--accent-contrast')).toBe('#0b0b0c');
  });
});
