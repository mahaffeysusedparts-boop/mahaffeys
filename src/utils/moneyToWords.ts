/**
 * Converts a USD amount to the English words used on the legal amount line of
 * a voucher check, e.g. 1234.56 → "One Thousand Two Hundred Thirty-Four and
 * 56/100 Dollars".
 *
 * Supported range: 0.00 – 999,999,999.99 (one-line checks rarely exceed this).
 */

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
] as const;

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
] as const;

function underThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    const ten = TENS[Math.floor(n / 10)];
    const rest = n % 10;
    return rest ? `${ten}-${ONES[rest]}` : ten;
  }
  const hundreds = `${ONES[Math.floor(n / 100)]} Hundred`;
  const rest = n % 100;
  return rest ? `${hundreds} ${underThousand(rest)}` : hundreds;
}

function integerToWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;
  if (millions) parts.push(`${underThousand(millions)} Million`);
  if (thousands) parts.push(`${underThousand(thousands)} Thousand`);
  if (rest) parts.push(underThousand(rest));
  return parts.join(' ');
}

export const MAX_CHECK_AMOUNT = 999_999_999.99;

/**
 * Formats the amount-in-words line for a check.
 * Throws on non-finite or out-of-range values so callers can refuse to print.
 */
export function moneyToWords(amount: number): string {
  if (!Number.isFinite(amount)) throw new Error('Check amount must be a finite number');
  if (amount < 0) throw new Error('Check amount cannot be negative');
  if (amount > MAX_CHECK_AMOUNT) throw new Error(`Check amounts above ${MAX_CHECK_AMOUNT.toFixed(2)} are not supported`);

  // Round to the cent — fractional cents cannot be printed on a check.
  const rounded = Math.round(amount * 100) / 100;
  const dollars = Math.floor(rounded);
  const cents = Math.round((rounded - dollars) * 100);

  const dollarWords = integerToWords(dollars);
  const centsPadded = String(cents).padStart(2, '0');
  const dollarLabel = dollars === 1 ? 'Dollar' : 'Dollars';
  return `${dollarWords} and ${centsPadded}/100 ${dollarLabel}`;
}
