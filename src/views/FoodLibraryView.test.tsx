import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FoodLibraryView } from './FoodLibraryView';
import { useAppStore } from '../store/useAppStore';

function state() {
  return useAppStore.getState();
}

async function confirmAction(testId: string, label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByTestId(testId));
  await user.click(
    within(screen.getByTestId(`${testId}-confirm`)).getByRole('button', { name: label }),
  );
}

describe('FoodLibraryView', () => {
  it('adds a food stated for its reference weight', async () => {
    const user = userEvent.setup();
    render(<FoodLibraryView />);
    const before = state().foodLibrary.length;

    await user.click(screen.getByTestId('food-add-open'));
    await user.type(screen.getByTestId('food-add-form-name'), 'Almonds');
    await user.clear(screen.getByTestId('food-add-form-grams'));
    await user.type(screen.getByTestId('food-add-form-grams'), '28');
    await user.type(screen.getByTestId('food-add-form-calories'), '164');
    await user.type(screen.getByTestId('food-add-form-protein'), '6');
    await user.click(screen.getByRole('button', { name: 'Add food' }));

    const library = state().foodLibrary;
    expect(library).toHaveLength(before + 1);
    expect(library.at(-1)).toEqual({
      name: 'Almonds',
      grams: 28,
      calories: 164,
      macros: { protein: 6 },
    });
  });

  it('refuses to add a food without a name', async () => {
    const user = userEvent.setup();
    render(<FoodLibraryView />);
    const before = state().foodLibrary.length;

    await user.click(screen.getByTestId('food-add-open'));
    await user.type(screen.getByTestId('food-add-form-calories'), '100');
    await user.click(screen.getByRole('button', { name: 'Add food' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Name this food.');
    expect(state().foodLibrary).toHaveLength(before);
  });

  it('edits a food by its array index', async () => {
    const user = userEvent.setup();
    render(<FoodLibraryView />);

    await user.click(screen.getByTestId('food-edit-0'));
    const calories = screen.getByTestId('food-edit-form-calories');
    await user.clear(calories);
    await user.type(calories, '170');
    await user.click(screen.getByRole('button', { name: 'Save food' }));

    expect(state().foodLibrary[0]?.calories).toBe(170);
    expect(state().foodLibrary[0]?.name).toBe('Chicken breast');
    expect(screen.queryByTestId('food-edit-form')).not.toBeInTheDocument();
  });

  it('deletes a food only after confirming', async () => {
    const user = userEvent.setup();
    render(<FoodLibraryView />);
    const before = state().foodLibrary;

    await user.click(screen.getByTestId('food-delete-0'));
    await user.click(
      within(screen.getByTestId('food-delete-0-confirm')).getByRole('button', { name: 'Cancel' }),
    );
    expect(state().foodLibrary).toHaveLength(before.length);

    await confirmAction('food-delete-0', 'Yes, delete');

    expect(state().foodLibrary).toHaveLength(before.length - 1);
    expect(state().foodLibrary[0]?.name).toBe(before[1]?.name);
  });
});
