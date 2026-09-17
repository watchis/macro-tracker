import { useMemo, useState } from 'react';
import { ConfirmAction } from './ConfirmAction';
import { FoodForm } from './FoodForm';
import { STARTER_FOOD_LIBRARY } from '../../data/starterFoodLibrary';
import { MACROS, formatMacro } from '../../lib/macros';
import { formatCalories } from '../../lib/totals';
import { useAppStore } from '../../store/useAppStore';
import { useCustomFoods } from '../../store/selectors';
import type { FoodLibraryItem } from '../../types';

function macroSummary(item: FoodLibraryItem): string {
  const parts = MACROS.filter((macro) => typeof item.macros[macro.key] === 'number').map(
    (macro) => `${macro.shortLabel} ${formatMacro(macro.key, item.macros[macro.key] ?? 0)}`,
  );
  return parts.length > 0 ? parts.join(' · ') : 'No macros recorded';
}

function matchesQuery(item: FoodLibraryItem, query: string): boolean {
  if (!query) return true;
  return item.name.toLowerCase().includes(query);
}

/**
 * Custom foods (editable, persisted) plus the bundled USDA starter catalog
 * (read-only, searchable). Library mutations address custom items by index.
 */
export function FoodLibrarySettings() {
  const customFoods = useCustomFoods();
  const addFood = useAppStore((state) => state.addFood);
  const updateFood = useAppStore((state) => state.updateFood);
  const removeFood = useAppStore((state) => state.removeFood);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [starterQuery, setStarterQuery] = useState('');

  const starterMatches = useMemo(() => {
    const query = starterQuery.trim().toLowerCase();
    return STARTER_FOOD_LIBRARY.filter((item) => matchesQuery(item, query));
  }, [starterQuery]);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3" aria-labelledby="custom-foods-heading">
        <div>
          <h3 id="custom-foods-heading" className="text-sm font-semibold text-ink">
            Your foods
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            Custom foods you add here are saved in this browser and show up first in quick-add.
          </p>
        </div>

        {customFoods.length === 0 ? (
          <p data-testid="food-library-empty" className="text-sm text-muted">
            No custom foods yet. The starter library below is always available.
          </p>
        ) : (
          <ul data-testid="food-library-list" className="grid gap-2">
            {customFoods.map((item, index) => (
              <li
                key={`custom-${item.name}-${index}`}
                data-testid={`food-item-${index}`}
                className="rounded-lg border border-line bg-surface p-3"
              >
                {editingIndex === index ? (
                  <FoodForm
                    initial={item}
                    testId="food-edit-form"
                    submitLabel="Save food"
                    onCancel={() => setEditingIndex(null)}
                    onSubmit={(next) => {
                      updateFood(index, next);
                      setEditingIndex(null);
                    }}
                  />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatCalories(item.calories)} kcal per {item.grams} g ·{' '}
                        {macroSummary(item)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        data-testid={`food-edit-${index}`}
                        onClick={() => {
                          setAdding(false);
                          setEditingIndex(index);
                        }}
                        className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-raised"
                      >
                        Edit
                      </button>
                      <ConfirmAction
                        label="Delete"
                        confirmLabel={`Delete ${item.name}?`}
                        testId={`food-delete-${index}`}
                        onConfirm={() => {
                          setEditingIndex(null);
                          removeFood(index);
                        }}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <FoodForm
            testId="food-add-form"
            submitLabel="Add food"
            onCancel={() => setAdding(false)}
            onSubmit={(item) => {
              addFood(item);
              setAdding(false);
            }}
          />
        ) : (
          <div>
            <button
              type="button"
              data-testid="food-add-open"
              onClick={() => {
                setEditingIndex(null);
                setAdding(true);
              }}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:bg-accent-strong"
            >
              Add custom food
            </button>
          </div>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="starter-foods-heading">
        <div>
          <h3 id="starter-foods-heading" className="text-sm font-semibold text-ink">
            Starter library
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {STARTER_FOOD_LIBRARY.length} common foods from USDA FoodData Central (per 100 g). Built
            into the app — always available, not editable here.
          </p>
        </div>

        <label className="grid gap-1 text-xs tracking-wide text-subtle uppercase">
          Search starter foods
          <input
            type="search"
            data-testid="starter-food-search"
            value={starterQuery}
            onChange={(event) => setStarterQuery(event.target.value)}
            placeholder="e.g. chicken, banana, oats"
            className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink placeholder:text-subtle"
          />
        </label>

        <p data-testid="starter-food-count" className="text-xs text-muted">
          Showing {starterMatches.length} of {STARTER_FOOD_LIBRARY.length}
        </p>

        <ul
          data-testid="starter-food-list"
          className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border border-line p-2"
        >
          {starterMatches.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted">No starter foods match that search.</li>
          ) : (
            starterMatches.map((item) => (
              <li
                key={`starter-${item.name}`}
                className="rounded-md px-2 py-2 text-sm hover:bg-raised"
              >
                <p className="font-medium text-ink">{item.name}</p>
                <p className="text-xs text-muted">
                  {formatCalories(item.calories)} kcal / {item.grams} g · {macroSummary(item)}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
