import type { FoodLibraryItem } from '../types';
import usdaFoodLibrary from './food-library-usda.json';

/**
 * Immutable starter catalog shipped with the app (USDA FoodData Central).
 * Always available on load; not stored in localStorage. User-added foods live
 * separately in the persisted `foodLibrary` array.
 */
export const STARTER_FOOD_LIBRARY: readonly FoodLibraryItem[] = usdaFoodLibrary.foodLibrary.map(
  (item) => ({
    name: item.name,
    grams: item.grams,
    calories: item.calories,
    macros: { ...item.macros },
  }),
);

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

/** Custom foods first, then the starter catalog (for quick-add and search). */
export function mergeFoodLibraries(
  custom: readonly FoodLibraryItem[],
  starter: readonly FoodLibraryItem[] = STARTER_FOOD_LIBRARY,
): FoodLibraryItem[] {
  return [
    ...custom.map((item) => ({ ...item, macros: { ...item.macros } })),
    ...starter.map((item) => ({ ...item, macros: { ...item.macros } })),
  ];
}
