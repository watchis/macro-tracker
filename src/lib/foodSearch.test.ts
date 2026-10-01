import { describe, expect, it } from 'vitest';
import {
  compareFoodSearchRelevance,
  foodSearchScore,
  sortByFoodSearchRelevance,
} from './foodSearch';

describe('foodSearchScore', () => {
  it('ranks exact and leading whole-token matches above weaker hits', () => {
    expect(foodSearchScore({ name: 'Corn' }, 'corn')).toBe(0);
    expect(foodSearchScore({ name: 'Corn, white' }, 'corn')).toBe(1);
    expect(foodSearchScore({ name: 'Popcorn' }, 'corn')).toBe(2);
    expect(foodSearchScore({ name: 'Cornish hen' }, 'corn')).toBe(3);
    expect(foodSearchScore({ name: 'Crackers made with corn flour' }, 'corn')).toBeGreaterThan(
      foodSearchScore({ name: 'Popcorn' }, 'corn')!,
    );
    expect(foodSearchScore({ name: 'Acorn squash' }, 'corn')).toBeGreaterThan(
      foodSearchScore({ name: 'Cornish hen' }, 'corn')!,
    );
  });

  it('returns null when nothing matches', () => {
    expect(foodSearchScore({ name: 'Apple' }, 'corn')).toBeNull();
  });

  it('prefers name matches over alias-only matches', () => {
    const nameHit = foodSearchScore({ name: 'Corn, white' }, 'corn')!;
    const aliasHit = foodSearchScore({ name: 'Zea mays', aliases: ['corn, white'] }, 'corn')!;
    expect(nameHit).toBeLessThan(aliasHit);
  });
});

describe('sortByFoodSearchRelevance', () => {
  it('orders corn-like names by match precision', () => {
    const sorted = sortByFoodSearchRelevance(
      [
        { name: 'Crackers made with corn flour' },
        { name: 'Cornish hen' },
        { name: 'Popcorn' },
        { name: 'Corn, white' },
        { name: 'Acorn squash' },
      ],
      'corn',
    ).map((item) => item.name);

    expect(sorted.slice(0, 2)).toEqual(['Corn, white', 'Popcorn']);
    expect(sorted.indexOf('Cornish hen')).toBeLessThan(
      sorted.indexOf('Crackers made with corn flour'),
    );
    expect(sorted.at(-1)).toBe('Acorn squash');
  });

  it('keeps shorter equally-precise names ahead', () => {
    const sorted = sortByFoodSearchRelevance(
      [{ name: 'Chicken breast, raw, skinless' }, { name: 'Chicken breast' }],
      'chicken breast',
    ).map((item) => item.name);
    expect(sorted[0]).toBe('Chicken breast');
  });
});

describe('compareFoodSearchRelevance', () => {
  it('breaks equal scores alphabetically', () => {
    expect(
      compareFoodSearchRelevance({ name: 'Alpha corn meal' }, { name: 'Bravo corn meal' }, 'corn'),
    ).toBeLessThan(0);
  });
});
