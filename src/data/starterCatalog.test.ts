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
    expect(STARTER_FOOD_COUNT).toBeGreaterThan(750);
    expect(STARTER_FOOD_COUNT).toBeLessThan(5000);
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
      expect(food.source).toMatch(/^(sr|fd|cofid|cnf)$/);
      expect(food.sourceRef === 0 ? '0' : food.sourceRef).toBeTruthy();
      if (food.source === 'sr' || food.source === 'fd') {
        expect(food.fdcId).toBe(food.sourceRef);
      }
      expect(food.calories).toBeGreaterThanOrEqual(0);
      for (const [macro, value] of Object.entries(food.macros)) {
        expect(value, `${food.name}.${macro}`).toBeGreaterThanOrEqual(0);
      }
    }
    expect(foods).toHaveLength(STARTER_FOOD_COUNT);
  });

  it('includes winged beans and mung beans from the source databases', async () => {
    const foods = await loadAllStarterFoods();
    const names = foods.map((food) => food.name.toLowerCase());
    expect(names.some((name) => name.includes('sigarilyas'))).toBe(true);
    expect(names.some((name) => name.includes('mung beans, dry'))).toBe(true);
    expect(names.some((name) => name.includes('mung beans, cooked'))).toBe(true);
    expect(names.some((name) => name.includes('mung bean sprouts'))).toBe(true);
    expect(names.some((name) => name.includes('cellophane noodles') && name.includes('mung'))).toBe(
      true,
    );
    const winged = foods.find((food) => food.name.includes('sigarilyas'));
    expect(winged?.source).toBeTruthy();
    expect(winged?.sourceRef).toBeTruthy();
  });

  it('finds foods by common aliases and accent-insensitive spellings', async () => {
    const cases: Array<[string, string]> = [
      ['aubergine', 'Eggplant, raw'],
      ['courgette', 'Zucchini, raw'],
      ['calamari', 'Squid, raw'],
      ['sigarillias', 'Winged beans (sigarilyas), raw'],
      ['garbanzo', 'Chickpeas, cooked'],
      ['chana', 'Chickpeas, cooked'],
      ['pak choi', 'Bok choy, raw'],
      ['yuca', 'Cassava, raw'],
      ['prawn', 'Shrimp, cooked'],
      ['glass noodles', 'Cellophane noodles (mung bean), dry'],
      ['hamachi', 'Yellowtail, cooked'],
      ['bangus', 'Milkfish, cooked'],
      ['karela', 'Bitter melon, raw'],
      ['creme fraiche', 'Crème fraîche'],
    ];
    for (const [query, name] of cases) {
      const page = await queryStarterFoods({ query, limit: 40 });
      const hit = page.items.find((item) => item.name === name);
      expect(hit, query).toBeDefined();
    }

    const creme = await queryStarterFoods({ query: 'creme fraiche', limit: 5 });
    const fraiche = creme.items.find((item) => item.name === 'Crème fraîche');
    expect(fraiche?.aliases ?? []).not.toContain('creme fraiche');
  });
});
