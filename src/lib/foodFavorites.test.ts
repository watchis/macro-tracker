import { describe, expect, it } from 'vitest';
import {
  isFoodFavorited,
  removeCustomFavorite,
  syncCustomFavorite,
  toggleFoodFavoriteList,
} from './foodFavorites';
import type { FoodFavorite } from '../types';

const oats = { name: 'Oats', grams: 100, calories: 379, macros: { protein: 13 } };
const rice = { name: 'Rice', grams: 100, calories: 130, macros: { carbs: 28 } };

describe('foodFavorites', () => {
  it('toggles favorites on and off by source and name', () => {
    let favorites: FoodFavorite[] = [];
    favorites = toggleFoodFavoriteList(favorites, 'custom', oats);
    expect(isFoodFavorited(favorites, 'custom', 'Oats')).toBe(true);
    expect(favorites[0]).toMatchObject({ source: 'custom', name: 'Oats', calories: 379 });

    favorites = toggleFoodFavoriteList(favorites, 'starter', rice);
    expect(favorites).toHaveLength(2);

    favorites = toggleFoodFavoriteList(favorites, 'custom', oats);
    expect(isFoodFavorited(favorites, 'custom', 'oats')).toBe(false);
    expect(favorites).toHaveLength(1);
  });

  it('treats the same name under different sources as distinct', () => {
    let favorites = toggleFoodFavoriteList([], 'custom', oats);
    favorites = toggleFoodFavoriteList(favorites, 'starter', oats);
    expect(favorites).toHaveLength(2);
    expect(isFoodFavorited(favorites, 'custom', 'Oats')).toBe(true);
    expect(isFoodFavorited(favorites, 'starter', 'Oats')).toBe(true);
  });

  it('keeps custom favorites in sync when a food is renamed', () => {
    const favorites = toggleFoodFavoriteList([], 'custom', oats);
    const next = syncCustomFavorite(favorites, 'Oats', {
      name: 'Rolled oats',
      grams: 80,
      calories: 300,
      macros: { protein: 10 },
    });
    expect(isFoodFavorited(next, 'custom', 'Oats')).toBe(false);
    expect(next[0]).toMatchObject({
      source: 'custom',
      name: 'Rolled oats',
      grams: 80,
      calories: 300,
    });
  });

  it('removes a custom favorite by name', () => {
    const favorites = toggleFoodFavoriteList(
      toggleFoodFavoriteList([], 'custom', oats),
      'starter',
      rice,
    );
    expect(removeCustomFavorite(favorites, 'Oats')).toEqual([
      expect.objectContaining({ source: 'starter', name: 'Rice' }),
    ]);
  });
});
