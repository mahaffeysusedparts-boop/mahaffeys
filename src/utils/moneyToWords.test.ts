import { describe, expect, it } from 'vitest';
import { moneyToWords } from './moneyToWords';

describe('moneyToWords', () => {
  it('formats zero', () => {
    expect(moneyToWords(0)).toBe('Zero and 00/100 Dollars');
  });

  it('formats cents-only amounts', () => {
    expect(moneyToWords(0.45)).toBe('Zero and 45/100 Dollars');
    expect(moneyToWords(0.05)).toBe('Zero and 05/100 Dollars');
  });

  it('formats single dollars', () => {
    expect(moneyToWords(1)).toBe('One and 00/100 Dollar');
    expect(moneyToWords(2.5)).toBe('Two and 50/100 Dollars');
  });

  it('formats teens and hyphenated tens', () => {
    expect(moneyToWords(13)).toBe('Thirteen and 00/100 Dollars');
    expect(moneyToWords(42)).toBe('Forty-Two and 00/100 Dollars');
    expect(moneyToWords(110)).toBe('One Hundred Ten and 00/100 Dollars');
  });

  it('formats hundreds with remainder', () => {
    expect(moneyToWords(305.1)).toBe('Three Hundred Five and 10/100 Dollars');
    expect(moneyToWords(999.99)).toBe('Nine Hundred Ninety-Nine and 99/100 Dollars');
  });

  it('formats thousands', () => {
    expect(moneyToWords(1234.56)).toBe(
      'One Thousand Two Hundred Thirty-Four and 56/100 Dollars'
    );
    expect(moneyToWords(1000)).toBe('One Thousand and 00/100 Dollars');
    expect(moneyToWords(100000)).toBe('One Hundred Thousand and 00/100 Dollars');
  });

  it('formats millions with cents', () => {
    expect(moneyToWords(1000000.01)).toBe('One Million and 01/100 Dollars');
    expect(moneyToWords(999999999.99)).toBe(
      'Nine Hundred Ninety-Nine Million Nine Hundred Ninety-Nine Thousand Nine Hundred Ninety-Nine and 99/100 Dollars'
    );
  });

  it('rejects out-of-range, negative, and non-finite amounts', () => {
    expect(() => moneyToWords(-1)).toThrow();
    expect(() => moneyToWords(1000000000)).toThrow();
    expect(() => moneyToWords(Number.NaN)).toThrow();
    expect(() => moneyToWords(Number.POSITIVE_INFINITY)).toThrow();
  });
});
