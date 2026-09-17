import { describe, expect, it } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayView } from './DayView';
import { todayKey } from '../lib/dates';
import { useAppStore } from '../store/useAppStore';
import type { MacroAmounts } from '../types';

const DATE = '2026-03-05';

function log(name: string, calories: number, macros: MacroAmounts = {}, grams = 100) {
  return useAppStore.getState().addEntry(DATE, { name, grams, calories, macros });
}

function entries() {
  return useAppStore.getState().days[DATE] ?? [];
}

function entryAt(index = 0) {
  const entry = entries()[index];
  if (!entry) throw new Error(`No entry logged at index ${index}`);
  return entry;
}

function columnHeaders(): string[] {
  return screen
    .getAllByRole('columnheader')
    .map((header) => header.textContent?.trim() ?? '')
    .filter(Boolean);
}

async function fillAddRow(
  user: ReturnType<typeof userEvent.setup>,
  values: { name: string; grams?: string; calories?: string; protein?: string },
) {
  await user.type(screen.getByLabelText('Food name for new entry'), values.name);
  if (values.grams) await user.type(screen.getByLabelText('Grams for new entry'), values.grams);
  if (values.calories)
    await user.type(screen.getByLabelText('Calories for new entry'), values.calories);
  if (values.protein)
    await user.type(screen.getByLabelText('Protein for new entry'), values.protein);
}

describe('DayView table', () => {
  it('renders a column per visible macro in canonical order', () => {
    useAppStore.getState().setVisibleMacros(['fat', 'protein']);
    render(<DayView date={DATE} />);

    expect(columnHeaders()).toEqual([
      'Food',
      'Grams',
      'Calories',
      'Protein (g)',
      'Fat (g)',
      'Actions',
    ]);
  });

  it('shows an empty state until something is logged', () => {
    render(<DayView date={DATE} />);

    expect(screen.getByText(/no food logged yet/i)).toBeInTheDocument();
  });

  it('lists entries with their grams, calories and macro amounts', () => {
    log('Oats', 379, { protein: 13, carbs: 68, fat: 6.5 });
    render(<DayView date={DATE} />);

    const row = screen.getByRole('rowheader', { name: 'Oats' }).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement)
      .getAllByRole('cell')
      .map((td) => td.textContent?.trim());
    expect(cells.slice(0, 5)).toEqual(['100', '379', '13', '68', '6.5']);
  });

  it('marks macros the entry does not carry', () => {
    log('Butter', 100, { fat: 11 });
    render(<DayView date={DATE} />);

    const row = screen.getByRole('rowheader', { name: 'Butter' }).closest('tr');
    const cells = within(row as HTMLElement)
      .getAllByRole('cell')
      .map((td) => td.textContent?.trim());
    expect(cells.slice(2, 5)).toEqual(['—', '—', '11']);
  });

  it('totals the day against the goals', () => {
    log('Oats', 400, { protein: 15, carbs: 60, fat: 7 });
    log('Chicken', 330, { protein: 62, carbs: 0, fat: 7 });
    render(<DayView date={DATE} />);

    const totals = within(screen.getByTestId('day-totals'));
    const totalRow = totals.getByRole('rowheader', { name: 'Total' }).closest('tr');
    expect(
      within(totalRow as HTMLElement)
        .getAllByRole('cell')
        .map((td) => td.textContent?.trim())
        .slice(0, 5),
    ).toEqual(['200', '730', '77', '60', '14']);

    expect(screen.getByTestId('totals-remaining-calories')).toHaveTextContent('1,270');
    expect(screen.getByTestId('totals-remaining-protein')).toHaveTextContent('73');
    expect(screen.getByTestId('day-remaining')).toHaveTextContent('1,270 kcal');
  });

  it('turns the remainder into an over-budget readout past the goal', () => {
    log('Cake', 2400, { protein: 200 });
    render(<DayView date={DATE} />);

    expect(screen.getByTestId('day-remaining')).toHaveTextContent('400 kcal');
    expect(screen.getByText('Over budget')).toBeInTheDocument();
    expect(screen.getByTestId('totals-remaining-calories')).toHaveTextContent('-400');
    expect(screen.getByTestId('totals-remaining-protein')).toHaveTextContent('-50');
  });

  it('keeps each macro remainder on its own goal when only some are over', () => {
    log('Pizza', 1400, { protein: 60, carbs: 150, fat: 55 });
    log('Ice cream', 900, { protein: 12, carbs: 100, fat: 45 });
    render(<DayView date={DATE} />);

    // 2,300 of 2,000 kcal and past the carb and fat goals, but protein is not.
    expect(screen.getByTestId('totals-remaining-calories')).toHaveTextContent('-300');
    expect(screen.getByTestId('totals-remaining-protein')).toHaveTextContent('78');
    expect(screen.getByTestId('totals-remaining-protein').className).not.toContain('text-danger');
    expect(screen.getByTestId('totals-remaining-carbs')).toHaveTextContent('-50');
    expect(screen.getByTestId('totals-remaining-carbs').className).toContain('text-danger');
  });

  it('marks macros with no goal instead of inventing a remainder', () => {
    useAppStore.getState().setVisibleMacros(['protein', 'fiber']);
    log('Oats', 379, { protein: 13, fiber: 10 });
    render(<DayView date={DATE} />);

    expect(screen.getByTestId('totals-remaining-fiber')).toHaveTextContent('—');
  });
});

describe('DayView add', () => {
  it('adds an entry from the inline row and clears the draft', async () => {
    const user = userEvent.setup();
    render(<DayView date={DATE} />);

    await fillAddRow(user, { name: 'Toast', grams: '60', calories: '160', protein: '6' });
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({
      name: 'Toast',
      grams: 60,
      calories: 160,
      macros: { protein: 6 },
    });
    expect(screen.getByRole('rowheader', { name: 'Toast' })).toBeInTheDocument();
    expect(screen.getByTestId('totals-remaining-calories')).toHaveTextContent('1,840');
    expect(screen.getByLabelText('Food name for new entry')).toHaveValue('');
  });

  it('submits the add row on Enter', async () => {
    const user = userEvent.setup();
    render(<DayView date={DATE} />);

    await fillAddRow(user, { name: 'Apple', calories: '95' });
    await user.keyboard('{Enter}');

    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({ name: 'Apple', grams: 0, calories: 95 });
  });

  it('refuses an entry without a name', async () => {
    const user = userEvent.setup();
    render(<DayView date={DATE} />);

    await user.type(screen.getByLabelText('Calories for new entry'), '120');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    await user.keyboard('{Enter}');
    expect(entries()).toHaveLength(0);
  });

  it('clears the draft on Escape', async () => {
    const user = userEvent.setup();
    render(<DayView date={DATE} />);

    await fillAddRow(user, { name: 'Scrapped', calories: '10' });
    await user.keyboard('{Escape}');

    expect(screen.getByLabelText('Food name for new entry')).toHaveValue('');
    expect(entries()).toHaveLength(0);
  });
});

describe('DayView edit and delete', () => {
  it('edits an entry in place and updates the totals', async () => {
    const user = userEvent.setup();
    log('Rice', 130, { protein: 2.7, carbs: 28, fat: 0.3 });
    render(<DayView date={DATE} />);

    await user.click(screen.getByRole('button', { name: 'Edit Rice' }));

    const calories = screen.getByLabelText('Calories for Rice');
    expect(calories).toHaveValue(130);
    await user.clear(calories);
    await user.type(calories, '260');
    const grams = screen.getByLabelText('Grams for Rice');
    await user.clear(grams);
    await user.type(grams, '200');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(entries()[0]).toMatchObject({ name: 'Rice', grams: 200, calories: 260 });
    // Hidden macros survive an edit made while they were switched off.
    expect(entryAt().macros).toMatchObject({ protein: 2.7, carbs: 28, fat: 0.3 });
    expect(screen.getByTestId('totals-remaining-calories')).toHaveTextContent('1,740');
    expect(screen.queryByLabelText('Calories for Rice')).not.toBeInTheDocument();
  });

  it('saves an edit on Enter and abandons it on Escape', async () => {
    const user = userEvent.setup();
    log('Rice', 130);
    render(<DayView date={DATE} />);

    await user.click(screen.getByRole('button', { name: 'Edit Rice' }));
    const name = screen.getByLabelText('Food name for Rice');
    await user.clear(name);
    await user.type(name, 'Brown rice{Enter}');
    expect(entryAt().name).toBe('Brown rice');

    await user.click(screen.getByRole('button', { name: 'Edit Brown rice' }));
    await user.type(screen.getByLabelText('Food name for Brown rice'), ' leftovers{Escape}');
    expect(entryAt().name).toBe('Brown rice');
    expect(screen.getByRole('rowheader', { name: 'Brown rice' })).toBeInTheDocument();
  });

  it('cancels an edit without touching the entry', async () => {
    const user = userEvent.setup();
    log('Rice', 130);
    render(<DayView date={DATE} />);

    await user.click(screen.getByRole('button', { name: 'Edit Rice' }));
    await user.clear(screen.getByLabelText('Calories for Rice'));
    await user.type(screen.getByLabelText('Calories for Rice'), '999');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(entryAt().calories).toBe(130);
    expect(screen.getByRole('rowheader', { name: 'Rice' })).toBeInTheDocument();
  });

  it('keeps hidden macros out of the edit row', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setVisibleMacros(['protein']);
    log('Rice', 130, { protein: 2.7, carbs: 28 });
    render(<DayView date={DATE} />);

    await user.click(screen.getByRole('button', { name: 'Edit Rice' }));

    expect(screen.getByLabelText('Protein for Rice')).toHaveValue(2.7);
    expect(screen.queryByLabelText('Carbs for Rice')).not.toBeInTheDocument();
  });

  it('deletes an entry', async () => {
    const user = userEvent.setup();
    log('Rice', 130);
    log('Chicken', 165);
    render(<DayView date={DATE} />);

    await user.click(screen.getByRole('button', { name: 'Delete Rice' }));

    expect(entries().map((entry) => entry.name)).toEqual(['Chicken']);
    expect(screen.queryByRole('rowheader', { name: 'Rice' })).not.toBeInTheDocument();
    expect(screen.getByTestId('totals-remaining-calories')).toHaveTextContent('1,835');
  });

  it('drops the day from the store once its last entry is deleted', async () => {
    const user = userEvent.setup();
    log('Rice', 130);
    render(<DayView date={DATE} />);

    await user.click(screen.getByRole('button', { name: 'Delete Rice' }));

    expect(useAppStore.getState().days[DATE]).toBeUndefined();
    expect(screen.getByText(/no food logged yet/i)).toBeInTheDocument();
  });
});

describe('DayView quick add', () => {
  it('logs a custom library food scaled to the grams entered', async () => {
    const user = userEvent.setup();
    useAppStore.getState().addFood({
      name: 'Test oats',
      grams: 100,
      calories: 379,
      macros: { protein: 13 },
    });
    render(<DayView date={DATE} />);

    await user.selectOptions(
      screen.getByLabelText(/quick add from library/i),
      screen.getByRole('option', { name: /test oats/i }),
    );
    const grams = screen.getByLabelText('Grams');
    await user.clear(grams);
    await user.type(grams, '50');

    expect(screen.getByTestId('quick-add-preview')).toHaveTextContent(/189\.5|190/);
    await user.click(screen.getByRole('button', { name: 'Quick add' }));

    expect(entries()[0]).toMatchObject({
      name: 'Test oats',
      grams: 50,
      calories: 189.5,
    });
    expect(entryAt().macros.protein).toBe(6.5);
  });

  it('searches the USDA catalog asynchronously', async () => {
    const user = userEvent.setup();
    render(<DayView date={DATE} />);

    await user.type(screen.getByTestId('quick-add-search'), 'banana');
    await waitFor(() => {
      expect(screen.getByTestId('quick-add-food')).toHaveTextContent(/banana/i);
    });
  });

  it('keeps quick-add available when customs are empty', () => {
    useAppStore.setState({ foodLibrary: [] });
    render(<DayView date={DATE} />);

    expect(screen.getByTestId('quick-add')).toBeInTheDocument();
    expect(screen.getByTestId('quick-add-search').getAttribute('placeholder')).toMatch(
      /Search [\d,]+ foods/,
    );
  });
});

describe('DayView navigation', () => {
  it('steps between days and jumps to today', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setSelectedDate(DATE);
    render(<DayView />);

    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(useAppStore.getState().selectedDate).toBe('2026-03-04');

    await user.click(screen.getByRole('button', { name: 'Next day' }));
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    expect(useAppStore.getState().selectedDate).toBe('2026-03-06');

    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(useAppStore.getState().selectedDate).toBe(todayKey());
    expect(screen.getByText(/· today/)).toBeInTheDocument();
  });

  it('goes back to the calendar', async () => {
    const user = userEvent.setup();
    useAppStore.getState().openDay(DATE);
    render(<DayView />);

    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(useAppStore.getState().view).toBe('calendar');
  });

  it('logs against the day it navigates to', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setSelectedDate(DATE);
    render(<DayView />);

    await user.click(screen.getByRole('button', { name: 'Next day' }));
    await fillAddRow(user, { name: 'Late snack', calories: '200' });
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(useAppStore.getState().days['2026-03-06']).toHaveLength(1);
    expect(useAppStore.getState().days[DATE]).toBeUndefined();
  });
});
