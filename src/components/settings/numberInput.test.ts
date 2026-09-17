import { describe, expect, it } from 'vitest';
import { formatNumberInput, parseNumberInput } from './numberInput';

describe('parseNumberInput', () => {
  it('accepts plain and decimal numbers', () => {
    expect(parseNumberInput('2000')).toEqual({ ok: true, value: 2000 });
    expect(parseNumberInput(' 12.5 ')).toEqual({ ok: true, value: 12.5 });
  });

  it('rejects text', () => {
    expect(parseNumberInput('abc')).toEqual({ ok: false, error: 'Enter a number.' });
    expect(parseNumberInput('-')).toEqual({ ok: false, error: 'Enter a number.' });
  });

  it('treats an empty field as an error unless emptiness is allowed', () => {
    expect(parseNumberInput('')).toEqual({ ok: false, error: 'Enter a number.' });
    expect(parseNumberInput('', { allowEmpty: true })).toEqual({ ok: true, value: undefined });
  });

  it('enforces the bounds', () => {
    expect(parseNumberInput('-1')).toEqual({ ok: false, error: 'Must be 0 or more.' });
    expect(parseNumberInput('5', { min: 10 })).toEqual({ ok: false, error: 'Must be 10 or more.' });
    expect(parseNumberInput('99', { max: 50 })).toEqual({
      ok: false,
      error: 'Must be 50 or less.',
    });
  });

  it('can require whole numbers', () => {
    expect(parseNumberInput('12.5', { integer: true })).toEqual({
      ok: false,
      error: 'Use a whole number.',
    });
  });
});

describe('formatNumberInput', () => {
  it('shows an absent value as an empty field', () => {
    expect(formatNumberInput(undefined)).toBe('');
    expect(formatNumberInput(Number.NaN)).toBe('');
    expect(formatNumberInput(0)).toBe('0');
    expect(formatNumberInput(31.5)).toBe('31.5');
  });
});
