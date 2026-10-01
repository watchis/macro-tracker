import { describe, expect, it } from 'vitest';
import { aliasesForName, matchingAlias, normalizeSearchText } from './foodAliases';

describe('food aliases', () => {
  it('folds accents', () => {
    expect(normalizeSearchText('Crème fraîche')).toBe('creme fraiche');
  });

  it('adds everyday names that are not already in the official name', () => {
    expect(aliasesForName('Eggplant, raw')).toContain('aubergine');
    expect(aliasesForName('Winged beans (sigarilyas), raw')).toContain('sigarillias');
    expect(aliasesForName('Winged beans (sigarilyas), raw')).not.toContain('sigarilyas');
    expect(aliasesForName('Chickpeas, cooked')).toEqual(
      expect.arrayContaining(['garbanzo', 'chana']),
    );
  });

  it('skips aliases that would point at a different food', () => {
    expect(aliasesForName('Soy sauce')).not.toContain('soya');
    expect(aliasesForName('Soy sauce')).toContain('shoyu');
    expect(aliasesForName('Goat cheese')).not.toContain('chevon');
    expect(aliasesForName('Sweet potato leaves, raw')).not.toContain('kumara');
    expect(aliasesForName('Oyster mushrooms, raw')).not.toContain('oyster');
  });

  it('hides the alias hint when the official name already matches', () => {
    const aliases = ['aubergine', 'brinjal'];
    expect(matchingAlias('Eggplant, raw', aliases, 'aubergine')).toBe('aubergine');
    expect(matchingAlias('Eggplant, raw', aliases, 'eggplant')).toBeNull();
    expect(matchingAlias('Crème fraîche', [], 'creme')).toBeNull();
  });
});
