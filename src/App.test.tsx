import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { todayKey } from './lib/dates';
import { useAppStore } from './store/useAppStore';

describe('App shell', () => {
  it('renders Home by default with the header and budget bar', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByTestId('budget-bar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Day' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Graphs' })).not.toBeInTheDocument();
  });

  it('switches views from the header nav', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(useAppStore.getState().view).toBe('settings');

    await user.click(screen.getByRole('button', { name: 'Food library' }));
    expect(screen.getByRole('heading', { name: 'Food library' })).toBeInTheDocument();
    expect(useAppStore.getState().view).toBe('library');

    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(useAppStore.getState().view).toBe('calendar');

    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(useAppStore.getState().view).toBe('home');
  });

  it('opens the day view from a calendar day cell', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    await user.click(screen.getByTestId(`calendar-day-${todayKey()}`));
    expect(useAppStore.getState().view).toBe('day');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
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
