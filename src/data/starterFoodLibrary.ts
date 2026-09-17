import type { FoodLibraryItem } from '../types';
import { isLegacyStarterName, STARTER_FOOD_COUNT } from './starterCatalog';

export { isLegacyStarterName, STARTER_FOOD_COUNT };
export {
  LEGACY_STARTER_NAMES,
  STARTER_MANIFEST,
  loadAllStarterFoods,
  loadStarterCategory,
  mergeCustomWithStarter,
  queryStarterFoods,
} from './starterCatalog';
export type {
  StarterCategoryMeta,
  StarterFood,
  StarterManifest,
  StarterPage,
  StarterQuery,
} from './starterCatalog';

/**
 * @deprecated The full catalog is lazy-loaded via `queryStarterFoods`. Kept as an
 * empty array so sync call sites that only need "customs + optional starter"
 * do not pull the whole catalog into the initial bundle.
 */
export const STARTER_FOOD_LIBRARY: readonly FoodLibraryItem[] = [];

/** @deprecated Prefer `mergeCustomWithStarter` with an explicitly loaded page. */
export function mergeFoodLibraries(
  custom: readonly FoodLibraryItem[],
  starter: readonly FoodLibraryItem[] = STARTER_FOOD_LIBRARY,
): FoodLibraryItem[] {
  return [
    ...custom.map((item) => ({ ...item, macros: { ...item.macros } })),
    ...starter.map((item) => ({ ...item, macros: { ...item.macros } })),
  ];
}
