export function policyDollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d*(?:\.\d{0,2})?$/.test(trimmed) || !/\d/.test(trimmed)) {
    throw new Error('Enter dollar amounts with no more than two decimal places, such as 25.00.');
  }
  const [dollars, fraction = ''] = trimmed.split('.');
  const cents = Number(dollars || '0') * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100000000) {
    throw new Error('Payment limits must be between $0 and $1,000,000.');
  }
  return cents;
}
