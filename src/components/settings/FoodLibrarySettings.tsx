import { useMemo, useState } from 'react';
import { STARTER_FOOD_COUNT, STARTER_MANIFEST } from '../../data/starterCatalog';
import { useStarterFoodPage } from '../../hooks/useStarterFoodPage';
import { MACROS, formatMacro } from '../../lib/macros';
import { formatCalories } from '../../lib/totals';
import { useCustomFoods } from '../../store/selectors';
import { useAppStore } from '../../store/useAppStore';
import type { FoodLibraryItem } from '../../types';
import { ConfirmAction } from './ConfirmAction';
import { FoodForm } from './FoodForm';

const PAGE_SIZE = 40;

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
 * (read-only, category-filtered, searchable, paginated).
 */
export function FoodLibrarySettings() {
  const customFoods = useCustomFoods();
  const addFood = useAppStore((state) => state.addFood);
  const updateFood = useAppStore((state) => state.updateFood);
  const removeFood = useAppStore((state) => state.removeFood);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string>(STARTER_MANIFEST.categories[0]?.id ?? '');
  const [offset, setOffset] = useState(0);

  const normalizedQuery = query.trim().toLowerCase();
  const searching = normalizedQuery.length > 0;

  const customMatches = useMemo(
    () =>
      customFoods
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => matchesQuery(item, normalizedQuery)),
    [customFoods, normalizedQuery],
  );

  const { page, loading, error } = useStarterFoodPage({
    query: normalizedQuery,
    // Cross-category search ignores the category chip; browsing uses it.
    categoryId: searching ? null : categoryId || null,
    offset,
    limit: PAGE_SIZE,
  });

  const totalPages = page ? Math.max(1, Math.ceil(page.total / PAGE_SIZE)) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="grid gap-6">
      <label className="grid gap-1 text-xs tracking-wide text-subtle uppercase">
        Search foods
        <input
          type="search"
          data-testid="food-library-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOffset(0);
          }}
          placeholder={`Search ${customFoods.length + STARTER_FOOD_COUNT} foods`}
          className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink placeholder:text-subtle"
        />
      </label>

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
        ) : customMatches.length === 0 ? (
          <p data-testid="food-library-no-custom-matches" className="text-sm text-muted">
            No custom foods match that search.
          </p>
        ) : (
          <ul data-testid="food-library-list" className="grid gap-2">
            {customMatches.map(({ item, index }) => (
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
            {STARTER_FOOD_COUNT.toLocaleString()} foods from USDA FoodData Central (per 100 g),
            split into {STARTER_MANIFEST.categories.length} categories and loaded as you browse or
            search.
          </p>
        </div>

        {!searching ? (
          <label className="grid gap-1 text-xs tracking-wide text-subtle uppercase">
            Category
            <select
              data-testid="starter-category"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setOffset(0);
              }}
              className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink"
            >
              {STARTER_MANIFEST.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label} ({category.count})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <p data-testid="starter-food-count" className="text-xs text-muted">
          {loading
            ? 'Loading…'
            : error
              ? error
              : `Showing ${page ? Math.min(page.total, offset + 1) : 0}–${
                  page ? Math.min(offset + page.items.length, page.total) : 0
                } of ${page?.total ?? 0}${searching ? ' matches' : ''}`}
        </p>

        <ul
          data-testid="starter-food-list"
          className="grid max-h-96 gap-1 overflow-y-auto rounded-lg border border-line p-2"
        >
          {loading ? (
            <li className="px-2 py-3 text-sm text-muted">Loading starter foods…</li>
          ) : error ? (
            <li className="px-2 py-3 text-sm text-danger">{error}</li>
          ) : !page || page.items.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted">No starter foods match that search.</li>
          ) : (
            page.items.map((item) => (
              <li
                key={`starter-${item.categoryId}-${item.fdcId ?? item.name}`}
                className="rounded-md px-2 py-2 text-sm hover:bg-raised"
              >
                <p className="font-medium text-ink">{item.name}</p>
                <p className="text-xs text-muted">
                  {formatCalories(item.calories)} kcal / {item.grams} g · {macroSummary(item)}
                  {searching ? ` · ${item.categoryLabel}` : ''}
                </p>
              </li>
            ))
          )}
        </ul>

        {page && page.total > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center gap-2" data-testid="starter-pagination">
            <button
              type="button"
              data-testid="starter-page-prev"
              disabled={offset <= 0 || loading}
              onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-raised disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-muted tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              data-testid="starter-page-next"
              disabled={offset + PAGE_SIZE >= page.total || loading}
              onClick={() => setOffset((value) => value + PAGE_SIZE)}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-raised disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
