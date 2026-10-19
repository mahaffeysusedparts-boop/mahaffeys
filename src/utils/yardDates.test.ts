import { expect, it } from 'vitest';
import { yardDate } from './yardDates';

it('uses Eastern seller/day boundaries, including daylight saving changes',()=>{
  expect(yardDate('2026-01-02T04:59:59Z')).toBe('2026-01-01');
  expect(yardDate('2026-01-02T05:00:00Z')).toBe('2026-01-02');
  expect(yardDate('2026-07-02T03:59:59Z')).toBe('2026-07-01');
  expect(yardDate('2026-07-02T04:00:00Z')).toBe('2026-07-02');
  expect(yardDate('2026-03-08T07:00:00Z')).toBe('2026-03-08');
  expect(yardDate('2026-11-01T06:00:00Z')).toBe('2026-11-01');
});
