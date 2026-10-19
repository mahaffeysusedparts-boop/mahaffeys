import { describe, expect, it } from 'vitest';
import { policyDollarsToCents } from './buyingPolicyForm';

describe('policy dollar amount inputs', () => {
  it.each([['', null], [' ', null], ['0', 0], ['0.00', 0], ['25', 2500], ['25.01', 2501], ['.50', 50], ['1.1', 110], ['00025.00', 2500], [' 100.99 ', 10099], ['1000000', 100000000]] as const)('converts %j to %s cents', (input, expected) => {
    expect(policyDollarsToCents(input)).toBe(expected);
  });
  it.each(['-1', '1.001', '1e3', 'NaN', 'Infinity', '.', '$25', '1,000', '1000000.01'])('rejects invalid amount %j', input => {
    expect(() => policyDollarsToCents(input)).toThrow();
  });
});
