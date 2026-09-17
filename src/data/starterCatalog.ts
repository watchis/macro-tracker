import type { FoodLibraryItem } from '../types';
import manifestJson from './starter/manifest.json';

export type StarterCategoryMeta = {
  id: string;
  label: string;
  count: number;
};

export type StarterFood = FoodLibraryItem & {
  fdcId?: number;
  categoryId: string;
  categoryLabel: string;
};

export type StarterManifest = {
  source: string;
  license: string;
  portal: string;
  basis: string;
  total: number;
  categories: StarterCategoryMeta[];
};

export type StarterQuery = {
  query?: string;
  categoryId?: string | null;
  offset?: number;
  limit?: number;
};

export type StarterPage = {
  items: StarterFood[];
  total: number;
  offset: number;
  limit: number;
};

/** Eager manifest only (~3 KB). Category JSON is loaded on demand. */
export const STARTER_MANIFEST: StarterManifest = manifestJson as StarterManifest;

export const STARTER_FOOD_COUNT = STARTER_MANIFEST.total;

/**
 * Names from the original five-item localStorage seed. Migrations drop these so
 * they are not duplicated once the bundled catalog replaced them.
 */
export const LEGACY_STARTER_NAMES = new Set(
  ['Chicken breast', 'White rice, cooked', 'Rolled oats', 'Whole egg', 'Greek yogurt, 2%'].map(
    (name) => name.toLowerCase(),
  ),
);

export function isLegacyStarterName(name: string): boolean {
  return LEGACY_STARTER_NAMES.has(name.trim().toLowerCase());
}

const categoryModules = import.meta.glob<{
  default: {
    id: string;
    label: string;
    foods: Array<FoodLibraryItem & { fdcId?: number }>;
  };
}>('./starter/categories/*.json');

const categoryCache = new Map<string, Promise<StarterFood[]>>();
let allFoodsPromise: Promise<StarterFood[]> | null = null;

function categoryPath(id: string): string {
  return `./starter/categories/${id}.json`;
}

/** Load one category file (cached). */
export function loadStarterCategory(categoryId: string): Promise<StarterFood[]> {
  const existing = categoryCache.get(categoryId);
  if (existing) return existing;

  const path = categoryPath(categoryId);
  const loader = categoryModules[path];
  if (!loader) {
    const empty = Promise.resolve([] as StarterFood[]);
    categoryCache.set(categoryId, empty);
    return empty;
  }

  const meta = STARTER_MANIFEST.categories.find((category) => category.id === categoryId);
  const promise = loader().then((mod) => {
    const data = mod.default;
    return data.foods.map((food) => ({
      name: food.name,
      grams: food.grams,
      calories: food.calories,
      macros: { ...food.macros },
      fdcId: food.fdcId,
      categoryId: data.id,
      categoryLabel: data.label || meta?.label || data.id,
    }));
  });
  categoryCache.set(categoryId, promise);
  return promise;
}

/** Load every category once and cache the flat list (used for cross-category search). */
export function loadAllStarterFoods(): Promise<StarterFood[]> {
  if (!allFoodsPromise) {
    allFoodsPromise = Promise.all(
      STARTER_MANIFEST.categories.map((category) => loadStarterCategory(category.id)),
    ).then((chunks) => chunks.flat());
  }
  return allFoodsPromise;
}

function matchesQuery(item: StarterFood, query: string): boolean {
  if (!query) return true;
  return (
    item.name.toLowerCase().includes(query) || item.categoryLabel.toLowerCase().includes(query)
  );
}

/**
 * Search / browse the starter catalog with optional category filter and pagination.
 * Loads only the needed category file(s); cross-category search loads all once, then caches.
 */
export async function queryStarterFoods(options: StarterQuery = {}): Promise<StarterPage> {
  const query = (options.query ?? '').trim().toLowerCase();
  const categoryId = options.categoryId || null;
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, options.limit ?? 50);

  let pool: StarterFood[];
  if (categoryId) {
    pool = await loadStarterCategory(categoryId);
  } else if (query) {
    pool = await loadAllStarterFoods();
  } else {
    // No category and no query: show first category page rather than loading everything.
    const first = STARTER_MANIFEST.categories[0];
    pool = first ? await loadStarterCategory(first.id) : [];
  }

  const filtered = query ? pool.filter((item) => matchesQuery(item, query)) : pool;
  return {
    items: filtered.slice(offset, offset + limit).map((item) => ({
      ...item,
      macros: { ...item.macros },
    })),
    total: filtered.length,
    offset,
    limit,
  };
}

/** Custom foods first for callers that already have a starter page. */
export function mergeCustomWithStarter(
  custom: readonly FoodLibraryItem[],
  starter: readonly FoodLibraryItem[],
): FoodLibraryItem[] {
  return [
    ...custom.map((item) => ({ ...item, macros: { ...item.macros } })),
    ...starter.map((item) => ({ ...item, macros: { ...item.macros } })),
  ];
}
