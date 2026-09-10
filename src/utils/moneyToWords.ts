/**
 * Converts a USD amount into the legal "amount in words" line used on checks.
 *
 * Supported range: 0 … 999,999,999.99 (the practical limit for a hand-filled
 * voucher check). Anything outside that range returns an empty string so the
 * caller can fall back to a numeric-only layout instead of printing garbage.
 */

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];

const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];

const SCALES = ["", " thousand", " million"];

function threeDigitToWords(value: number): string {
  let words = "";
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds > 0) {
    words += `${ONES[hundreds]} hundred`;
  }
  if (remainder > 0) {
    if (hundreds > 0) words += " ";
    if (remainder < 20) {
      words += ONES[remainder];
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      words += TENS[tens];
      if (ones > 0) words += `-${ONES[ones]}`;
    }
  }
  return words.trim();
}

export const MAX_CHECK_AMOUNT = 999_999_999.99;

/**
 * "One million two hundred thirty-four and 56/100 dollars"
 */
export function moneyToWords(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  if (amount < 0 || amount > MAX_CHECK_AMOUNT) return "";

  // Round to the cent — half-cent values come from percentage math upstream.
  const rounded = Math.round(amount * 100);
  const dollars = Math.floor(rounded / 100);
  const cents = rounded % 100;

  const centsPart = `${String(cents).padStart(2, "0")}/100`;
  if (dollars === 0) {
    return `Zero and ${centsPart} dollars`;
  }

  const groups: string[] = [];
  let remaining = dollars;
  let scaleIndex = 0;
  while (remaining > 0 && scaleIndex < SCALES.length) {
    const group = remaining % 1000;
    if (group > 0) {
      groups.unshift(`${threeDigitToWords(group)}${SCALES[scaleIndex]}`);
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }

  // Scales beyond millions are out of range by construction; guard anyway.
  if (remaining > 0) return "";

  return `${groups.join(" ")} and ${centsPart} dollars`;
}

/** Title-cased variant for the printed line ("Zero and 00/100 dollars" → "Zero And 00/100 Dollars"). */
export function moneyToWordsTitleCase(amount: number): string {
  const words = moneyToWords(amount);
  if (!words) return "";
  return words.replace(/\b[a-z]/g, (character) => character.toUpperCase());
}
