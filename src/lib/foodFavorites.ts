import type { FoodFavorite, FoodFavoriteSource, FoodLibraryItem } from '../types';

/** Stable key used for lookups and toggles. */
export function foodFavoriteKey(source: FoodFavoriteSource, name: string): string {
  return `${source}:${name.trim().toLowerCase()}`;
}

export function toFoodFavorite(source: FoodFavoriteSource, item: FoodLibraryItem): FoodFavorite {
  return {
    source,
    name: item.name.trim(),
    grams: item.grams > 0 ? item.grams : 100,
    calories: Number.isFinite(item.calories) ? item.calories : 0,
    macros: { ...item.macros },
  };
}

export function favoriteEquals(a: FoodFavorite, source: FoodFavoriteSource, name: string): boolean {
  return a.source === source && a.name.trim().toLowerCase() === name.trim().toLowerCase();
}

export function isFoodFavorited(
  favorites: readonly FoodFavorite[],
  source: FoodFavoriteSource,
  name: string,
): boolean {
  return favorites.some((favorite) => favoriteEquals(favorite, source, name));
}

/**
 * Toggle a food in the favorites list. When adding, stores a snapshot so Day
 * quick-add can show favorites without reloading the catalog.
 */
export function toggleFoodFavoriteList(
  favorites: readonly FoodFavorite[],
  source: FoodFavoriteSource,
  item: FoodLibraryItem,
): FoodFavorite[] {
  const name = item.name.trim();
  if (name === '') return [...favorites];
  if (isFoodFavorited(favorites, source, name)) {
    return favorites.filter((favorite) => !favoriteEquals(favorite, source, name));
  }
  return [...favorites, toFoodFavorite(source, item)];
}

/** Keep custom favorites in sync when a custom food is renamed or nutrition changes. */
export function syncCustomFavorite(
  favorites: readonly FoodFavorite[],
  previousName: string,
  next: FoodLibraryItem,
): FoodFavorite[] {
  const index = favorites.findIndex((favorite) => favoriteEquals(favorite, 'custom', previousName));
  if (index < 0) return [...favorites];
  const name = next.name.trim();
  if (name === '') {
    return favorites.filter((_, i) => i !== index);
  }
  const updated = [...favorites];
  updated[index] = toFoodFavorite('custom', next);
  // Drop a duplicate if the rename collided with another custom favorite.
  return updated.filter((favorite, i) => i === index || !favoriteEquals(favorite, 'custom', name));
}

export function removeCustomFavorite(
  favorites: readonly FoodFavorite[],
  name: string,
): FoodFavorite[] {
  return favorites.filter((favorite) => !favoriteEquals(favorite, 'custom', name));
}
