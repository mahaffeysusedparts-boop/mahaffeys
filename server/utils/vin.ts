export interface VinValidation {
  normalized: string;
  valid: boolean;
  warnings: string[];
}

const transliteration: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const checkCharacters = "0123456789X";

export function validateVin(value: string): VinValidation {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const warnings: string[] = [];
  if (/[IOQ]/.test(normalized)) warnings.push("Contains I, O, or Q; OCR ambiguity requires operator review.");
  if (normalized.length !== 17) warnings.push("VIN must contain exactly 17 characters.");
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) warnings.push("VIN contains characters that are not permitted by ISO 3779.");
  if (warnings.length) return { normalized, valid: false, warnings };

  const total = normalized.split("").reduce((sum, character, index) => {
    const valueForCharacter = Number.isFinite(Number(character)) ? Number(character) : transliteration[character];
    return sum + valueForCharacter * weights[index];
  }, 0);
  const expected = checkCharacters[total % 11];
  if (normalized[8] !== expected) warnings.push(`Check digit does not match (expected ${expected}).`);
  return { normalized, valid: warnings.length === 0, warnings };
}

export function findVinCandidates(rawText: string) {
  const compact = rawText.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const exact = rawText.toUpperCase().match(/[A-Z0-9]{17}/g) || [];
  return [...new Set([...exact, compact.match(/[A-Z0-9]{17}/g)?.[0]].filter(Boolean) as string[])];
}
