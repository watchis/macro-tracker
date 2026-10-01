import { describe, expect, it } from 'vitest';
import {
  LEGACY_STARTER_NAMES,
  STARTER_FOOD_COUNT,
  STARTER_MANIFEST,
  loadAllStarterFoods,
  queryStarterFoods,
} from './starterCatalog';

describe('whole-foods starter catalog', () => {
  it('ships a curated catalog (not the bulk USDA dump)', () => {
    expect(STARTER_FOOD_COUNT).toBeGreaterThan(500);
    expect(STARTER_FOOD_COUNT).toBeLessThan(1000);
    expect(STARTER_MANIFEST.source.toLowerCase()).toMatch(/whole food/);
    expect(STARTER_MANIFEST.categories.map((c) => c.id)).toEqual([
      'poultry',
      'beef',
      'pork',
      'lamb-goat-game',
      'fish',
      'shellfish',
      'dairy-eggs',
      'grains',
      'legumes',
      'vegetables',
      'starches',
      'fruits',
      'nuts-seeds',
      'oils-fats',
      'beverages',
      'seasonings',
    ]);
    expect(STARTER_MANIFEST.categories.map((c) => c.id)).not.toContain('fast-foods');
  });

  it('includes Chicken breast at ~165 kcal / 100 g', async () => {
    const page = await queryStarterFoods({ query: 'chicken breast', limit: 20 });
    const exact = page.items.find((item) => item.name === 'Chicken breast');
    expect(exact).toBeDefined();
    expect(exact?.calories).toBe(165);
    expect(exact?.macros.protein).toBe(31);
    expect(exact?.macros.fat).toBe(3.6);
    expect(exact?.macros.carbs).toBe(0);
  });

  it('keeps legacy starter names findable in the catalog', async () => {
    const foods = await loadAllStarterFoods();
    const names = new Set(foods.map((f) => f.name.toLowerCase()));
    for (const legacy of LEGACY_STARTER_NAMES) {
      expect(names.has(legacy)).toBe(true);
    }
  });

  it('has no negative macro amounts or duplicate names', async () => {
    const foods = await loadAllStarterFoods();
    const names = new Set<string>();
    for (const food of foods) {
      const key = food.name.trim().toLowerCase();
      expect(names.has(key), food.name).toBe(false);
      names.add(key);
      expect(food.grams).toBe(100);
      expect(food.calories).toBeGreaterThanOrEqual(0);
      for (const [macro, value] of Object.entries(food.macros)) {
        expect(value, `${food.name}.${macro}`).toBeGreaterThanOrEqual(0);
      }
    }
    expect(foods).toHaveLength(STARTER_FOOD_COUNT);
  });
});
