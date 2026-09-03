/**
 * Pure VIN intelligence: ISO 3779 check-digit math, OCR candidate harvesting,
 * and confusion repair. No DOM or OCR dependencies so it stays unit-testable.
 */

/** Characters legal in a VIN (ISO 3779 excludes I, O, and Q). */
export const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

export interface VinFormatCheck {
  normalized: string;
  lengthOk: boolean;
  charsetOk: boolean;
  checkDigitOk: boolean;
  expectedCheckDigit: string | null;
  /** Hard rules only (17 chars + legal alphabet). Check digit is a warning. */
  valid: boolean;
  warnings: string[];
}

export interface VinCandidate {
  vin: string;
  checkDigitValid: boolean;
  ocrConfidence: number;
  /** Higher is better. Check-digit-valid candidates always outrank the rest. */
  score: number;
  /** Human-readable fixes applied by the repair pass, e.g. "Check digit corrected to 7". */
  repairs: string[];
  source: string;
}

const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const CHECK_CHARACTERS = "0123456789X";

/** Position 9 carries weight 0, so the expected digit is computable from any 17-char string. */
export function computeCheckDigit(vin: string): string | null {
  if (vin.length !== 17) return null;
  let total = 0;
  for (let i = 0; i < 17; i++) {
    const character = vin[i];
    const numeric = Number(character);
    const value = character >= "0" && character <= "9" ? numeric : TRANSLITERATION[character];
    if (value === undefined) return null;
    total += value * WEIGHTS[i];
  }
  return CHECK_CHARACTERS[total % 11];
}

export function checkVinFormat(value: string): VinFormatCheck {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const lengthOk = normalized.length === 17;
  const charsetOk = /^[A-HJ-NPR-Z0-9]{17}$/.test(normalized);
  const expectedCheckDigit = computeCheckDigit(normalized);
  const checkDigitOk = charsetOk && normalized[8] === expectedCheckDigit;
  const warnings: string[] = [];
  if (!lengthOk && normalized.length > 0) warnings.push(`VIN is ${normalized.length} of 17 characters.`);
  if (lengthOk && !charsetOk) warnings.push("Contains characters not allowed in a VIN (no I, O, or Q).");
  if (lengthOk && charsetOk && !checkDigitOk) {
    warnings.push(`Check digit mismatch (position 9 should be ${expectedCheckDigit}). Common on European-built vehicles — verify against the sticker.`);
  }
  return { normalized, lengthOk, charsetOk, checkDigitOk, expectedCheckDigit, valid: lengthOk && charsetOk, warnings };
}

/** Visual confusions OCR commonly makes between legal VIN characters. */
const CONFUSIONS: Array<[string, string]> = [
  ["0", "D"], ["D", "0"],
  ["8", "B"], ["B", "8"],
  ["5", "S"], ["S", "5"],
  ["2", "Z"], ["Z", "2"],
  ["6", "G"], ["G", "6"], ["G", "C"], ["C", "G"],
  ["4", "A"], ["A", "4"],
  ["V", "U"], ["U", "V"],
  ["1", "T"], ["T", "7"], ["7", "T"], ["1", "7"], ["7", "1"],
  ["E", "F"], ["F", "E"],
  ["K", "X"], ["X", "K"],
];

/** Extract plausible 17-character VIN strings from raw OCR text. */
export function harvestVinCandidates(rawText: string): string[] {
  const upper = rawText.toUpperCase();
  const found: string[] = [];

  // 1. Exact 17-char tokens with word boundaries.
  for (const match of upper.matchAll(/\b[A-HJ-NPR-Z0-9]{17}\b/g)) found.push(match[0]);

  // 2. Lines that hold a VIN with separators (dashes/spaces from sticker print).
  for (const line of upper.split(/\r?\n/)) {
    const segmented = line.match(/[A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9\-\s]{16,40}/g) || [];
    for (const chunk of segmented) {
      const stripped = chunk.replace(/[^A-HJ-NPR-Z0-9]/g, "");
      if (stripped.length === 17) found.push(stripped);
    }
  }

  // 3. Sliding window over the fully compacted text — catches VINs that ran
  //    together with neighboring sticker text (dates, tire pressures, weights).
  const compact = upper.replace(/[^A-Z0-9]/g, "");
  if (compact.length >= 17 && compact.length <= 240) {
    for (let i = 0; i + 17 <= compact.length; i++) {
      const window = compact.slice(i, i + 17);
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(window)) continue;
      const letters = (window.match(/[A-Z]/g) || []).length;
      const digits = 17 - letters;
      // Real VINs mix letters and digits heavily; tire-pressure gibberish rarely does.
      if (letters >= 2 && letters <= 13 && digits >= 3) found.push(window);
    }
  }

  return [...new Set(found)];
}

export interface RepairedVinCandidate { text: string; repaired: boolean; repairs: string[]; bonus: number }

/**
 * Turns a raw 17-char read into scored candidates. A misread character is 16x
 * more likely at one of the data positions than at the check digit itself, so
 * confusion repairs that validate outrank a check-digit rewrite. All rankings
 * stay below an unrepaired, already-valid read.
 */
export function repairVinCandidate(vin: string): RepairedVinCandidate[] {
  const validAsRead = computeCheckDigit(vin) === vin[8];
  if (validAsRead) return [{ text: vin, repaired: false, repairs: [], bonus: 60 }];

  const results: RepairedVinCandidate[] = [];

  // Confusion swaps at data positions that make the check digit validate.
  let confusionFixes = 0;
  for (let i = 0; i < 17 && confusionFixes < 2; i++) {
    if (i === 8) continue;
    for (const [from, to] of CONFUSIONS) {
      if (vin[i] !== from) continue;
      const fixed = vin.slice(0, i) + to + vin.slice(i + 1);
      if (computeCheckDigit(fixed) === fixed[8]) {
        results.push({
          text: fixed,
          repaired: true,
          repairs: [`Position ${i + 1}: "${from}" read as "${to}"`],
          bonus: 40,
        });
        confusionFixes++;
        break;
      }
    }
  }

  // The check digit is mathematically determined by the other 16 characters —
  // trust the math, but rank it below confusion repairs.
  const expected = computeCheckDigit(vin); // position 9 has weight 0, so this is the required digit
  if (expected) {
    results.push({
      text: vin.slice(0, 8) + expected + vin.slice(9),
      repaired: true,
      repairs: [`Check digit auto-corrected to "${expected}"`],
      bonus: 10,
    });
  }

  return results;
}

/** Ranks harvested + repaired OCR reads into a deduplicated candidate list. */
export function buildCandidates(rawText: string, ocrConfidence: number, source: string): VinCandidate[] {
  const byVin = new Map<string, VinCandidate>();

  for (const raw of harvestVinCandidates(rawText)) {
    for (const repaired of repairVinCandidate(raw)) {
      const checkDigitValid = computeCheckDigit(repaired.text) === repaired.text[8];
      const score = (checkDigitValid ? 1000 : 0) + ocrConfidence + repaired.bonus;
      const existing = byVin.get(repaired.text);
      if (!existing || existing.score < score) {
        byVin.set(repaired.text, {
          vin: repaired.text,
          checkDigitValid,
          ocrConfidence,
          score,
          repairs: repaired.repairs,
          source,
        });
      }
    }
  }

  return [...byVin.values()].sort((a, b) => b.score - a.score);
}
