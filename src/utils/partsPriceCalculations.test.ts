import { describe,it,expect } from 'vitest';
import { normalizePartsPrice,displayPartsPrice } from './partsPriceCalculations';

describe('reviewed parts-price contract',()=>{
  it('normalizes explicit fixed amounts, including zero',()=>{
    expect(normalizePartsPrice('fixed','$12.5')).toBe('12.50');
    expect(normalizePartsPrice('fixed','0')).toBe('0.00');
  });
  it('validates ordered ranges without inventing amounts',()=>{
    expect(normalizePartsPrice('range','$10 - $20.75')).toBe('10.00–20.75');
    expect(()=>normalizePartsPrice('range','20–10')).toThrow();
    expect(()=>normalizePartsPrice('fixed','12.999')).toThrow();
    expect(()=>normalizePartsPrice('fixed','NaN')).toThrow();
    expect(()=>normalizePartsPrice('fixed','-5')).toThrow();
    expect(()=>normalizePartsPrice('fixed','1000001')).toThrow();
  });
  it('keeps meaningful descriptive prices and rejects blank uncertainty',()=>{
    expect(normalizePartsPrice('description','Call yard for current price')).toBe('Call yard for current price');
    expect(()=>normalizePartsPrice('description',' ')).toThrow();
    expect(displayPartsPrice({priceKind:'range',price:'10.00–20.00'})).toBe('$10.00 – $20.00');
  });
});
