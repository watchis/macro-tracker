import { useState } from 'react';
import { ConfirmAction } from './ConfirmAction';
import { FoodForm } from './FoodForm';
import { MACROS, formatMacro } from '../../lib/macros';
import { formatCalories } from '../../lib/totals';
import { useAppStore } from '../../store/useAppStore';
import { useFoodLibrary } from '../../store/selectors';
import type { FoodLibraryItem } from '../../types';

function macroSummary(item: FoodLibraryItem): string {
  const parts = MACROS.filter((macro) => typeof item.macros[macro.key] === 'number').map(
    (macro) => `${macro.shortLabel} ${formatMacro(macro.key, item.macros[macro.key] ?? 0)}`,
  );
  return parts.length > 0 ? parts.join(' · ') : 'No macros recorded';
}

/**
 * Add, edit and delete reusable foods. Library items carry no id, so every
 * mutation addresses them by array index (see the store contract).
 */
export function FoodLibrarySettings() {
  const foodLibrary = useFoodLibrary();
  const addFood = useAppStore((state) => state.addFood);
  const updateFood = useAppStore((state) => state.updateFood);
  const removeFood = useAppStore((state) => state.removeFood);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="grid gap-4">
      {foodLibrary.length === 0 ? (
        <p data-testid="food-library-empty" className="text-sm text-muted">
          The library is empty. Add a food to quick-add it from any day.
        </p>
      ) : (
        <ul data-testid="food-library-list" className="grid gap-2">
          {foodLibrary.map((item, index) => (
            <li
              key={`${item.name}-${index}`}
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
                      {formatCalories(item.calories)} kcal per {item.grams} g · {macroSummary(item)}
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
            Add food
          </button>
        </div>
      )}
    </div>
  );
}
