import { describe, expect, it } from 'vitest';
import { applyTheme, resolveTheme } from './applyTheme';
import { accentForeground, normalizeHex, relativeLuminance } from './color';

describe('resolveTheme', () => {
  it('honors an explicit mode and follows the system otherwise', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('normalizeHex', () => {
  it('accepts short, long and unprefixed hex values', () => {
    expect(normalizeHex('#AABBCC')).toBe('#aabbcc');
    expect(normalizeHex('aabbcc')).toBe('#aabbcc');
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex(' #ABC ')).toBe('#aabbcc');
  });

  it('rejects anything else', () => {
    for (const input of ['', 'rebeccapurple', '#12345', '#gggggg', null, 42]) {
      expect(normalizeHex(input)).toBeNull();
    }
  });
});

describe('accent contrast', () => {
  it('picks dark ink on light accents and light ink on dark ones', () => {
    expect(accentForeground('#ffffff')).toBe('#0b0b0c');
    expect(accentForeground('#facc15')).toBe('#0b0b0c');
    expect(accentForeground('#3b82f6')).toBe('#ffffff');
    expect(accentForeground('#000000')).toBe('#ffffff');
  });

  it('computes relative luminance at the extremes', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
  });
});

describe('applyTheme', () => {
  it('writes the palette selector and accent seed onto the element', () => {
    const root = document.createElement('html');

    expect(applyTheme(root, { mode: 'system', accent: '#3b82f6', prefersDark: true })).toBe('dark');
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    expect(root.style.getPropertyValue('--accent')).toBe('#3b82f6');
    expect(root.style.getPropertyValue('--accent-contrast')).toBe('#ffffff');

    applyTheme(root, { mode: 'light', accent: 'nonsense', prefersDark: true });
    expect(root.dataset.theme).toBe('light');
    // Unparsable accents fall back rather than clearing the variable.
    expect(root.style.getPropertyValue('--accent')).toBe('#3b82f6');
  });
});
