import { describe, expect, it } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FoodLibraryView } from './FoodLibraryView';
import { STARTER_FOOD_COUNT, STARTER_MANIFEST } from '../data/starterCatalog';
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
  it('adds a custom food stated for its reference weight', async () => {
    const user = userEvent.setup();
    render(<FoodLibraryView />);
    const before = state().foodLibrary.length;

    await user.click(screen.getByTestId('food-add-open'));
    await user.type(screen.getByTestId('food-add-form-name'), 'Almond Butter');
    await user.clear(screen.getByTestId('food-add-form-grams'));
    await user.type(screen.getByTestId('food-add-form-grams'), '28');
    await user.type(screen.getByTestId('food-add-form-calories'), '164');
    await user.type(screen.getByTestId('food-add-form-protein'), '6');
    await user.click(screen.getByRole('button', { name: 'Add food' }));

    const library = state().foodLibrary;
    expect(library).toHaveLength(before + 1);
    expect(library.at(-1)).toEqual({
      name: 'Almond Butter',
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

  it('edits a custom food by its array index', async () => {
    const user = userEvent.setup();
    state().addFood({ name: 'Protein bar', grams: 60, calories: 200, macros: { protein: 20 } });
    render(<FoodLibraryView />);

    await user.click(screen.getByTestId('food-edit-0'));
    const calories = screen.getByTestId('food-edit-form-calories');
    await user.clear(calories);
    await user.type(calories, '210');
    await user.click(screen.getByRole('button', { name: 'Save food' }));

    expect(state().foodLibrary[0]?.calories).toBe(210);
    expect(state().foodLibrary[0]?.name).toBe('Protein bar');
    expect(screen.queryByTestId('food-edit-form')).not.toBeInTheDocument();
  });

  it('deletes a custom food only after confirming', async () => {
    const user = userEvent.setup();
    state().addFood({ name: 'Shake', grams: 250, calories: 180, macros: {} });
    state().addFood({ name: 'Bar', grams: 40, calories: 150, macros: {} });
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

  it('defaults to All and browses by category with pagination', async () => {
    const user = userEvent.setup();
    render(<FoodLibraryView />);

    expect(STARTER_FOOD_COUNT).toBeGreaterThan(200);
    expect(STARTER_MANIFEST.categories.length).toBeGreaterThan(5);

    const category = screen.getByTestId('starter-category');
    expect(category).toHaveValue('');
    expect(
      within(category).getByRole('option', { name: new RegExp(`All \\(${STARTER_FOOD_COUNT}\\)`) }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('starter-food-list').textContent).not.toMatch(/Loading/);
    });

    await waitFor(() => {
      expect(screen.getByTestId('starter-food-count')).toHaveTextContent(
        new RegExp(`of ${STARTER_FOOD_COUNT}`),
      );
    });

    const poultry = STARTER_MANIFEST.categories.find((c) => c.id === 'poultry');
    if (poultry) {
      await user.selectOptions(category, poultry.id);
      await waitFor(() => {
        expect(screen.getByTestId('starter-food-count')).toHaveTextContent(
          new RegExp(`of ${poultry.count}`),
        );
      });
      expect(screen.getByTestId('starter-food-list')).toHaveTextContent(/Chicken breast/);
    }

    await waitFor(() => {
      const count = screen.getByTestId('starter-food-count').textContent ?? '';
      expect(count).toMatch(/Showing/);
    });
  });

  it('searches across the catalog', async () => {
    const user = userEvent.setup();
    render(<FoodLibraryView />);

    await user.type(screen.getByTestId('food-library-search'), 'banana');
    await waitFor(() => {
      expect(screen.getByTestId('starter-food-list')).toHaveTextContent(/[Bb]anana/);
    });
  });

  it('filters custom foods with the same search box', async () => {
    const user = userEvent.setup();
    state().addFood({ name: 'Gym shake', grams: 300, calories: 220, macros: { protein: 40 } });
    state().addFood({ name: 'Trail mix', grams: 40, calories: 180, macros: {} });
    render(<FoodLibraryView />);

    await user.type(screen.getByTestId('food-library-search'), 'shake');
    expect(screen.getByTestId('food-library-list')).toHaveTextContent('Gym shake');
    expect(screen.queryByText('Trail mix')).not.toBeInTheDocument();
  });
});
