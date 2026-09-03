import { describe, expect, it } from "vitest";
import {
  buildCandidates,
  checkVinFormat,
  computeCheckDigit,
  harvestVinCandidates,
  repairVinCandidate,
} from "./vinCheck";

describe("computeCheckDigit", () => {
  it("validates the canonical ISO 3779 example (check digit X)", () => {
    expect(computeCheckDigit("1M8GDM9AXKP042788")).toBe("X");
  });

  it("validates the all-ones VIN (check digit 1)", () => {
    expect(computeCheckDigit("11111111111111111")).toBe("1");
  });

  it("returns null for non-17-character input", () => {
    expect(computeCheckDigit("1M8GDM9AXKP04278")).toBeNull();
  });
});

describe("checkVinFormat", () => {
  it("accepts a valid VIN with mixed case, spaces, and separators", () => {
    const check = checkVinFormat(" 1m8gdm9axkp042788 ");
    expect(check.normalized).toBe("1M8GDM9AXKP042788");
    expect(check.valid).toBe(true);
    expect(check.checkDigitOk).toBe(true);
    expect(check.warnings).toHaveLength(0);
  });

  it("rejects VINs shorter than 17 characters", () => {
    const check = checkVinFormat("1M8GDM9AXKP04278");
    expect(check.valid).toBe(false);
    expect(check.lengthOk).toBe(false);
  });

  it("rejects illegal characters (I, O, Q are never legal)", () => {
    const check = checkVinFormat("1M8GDM9AXKP042O88");
    expect(check.valid).toBe(false);
    expect(check.charsetOk).toBe(false);
  });

  it("permits but warns on a check-digit mismatch (European imports)", () => {
    const check = checkVinFormat("1M8GDM9AXKP042789");
    expect(check.valid).toBe(true);
    expect(check.checkDigitOk).toBe(false);
    expect(check.warnings.join(" ")).toContain("Check digit mismatch");
  });
});

describe("harvestVinCandidates", () => {
  it("finds a clean 17-character token", () => {
    expect(harvestVinCandidates("1M8GDM9AXKP042788")).toContain("1M8GDM9AXKP042788");
  });

  it("finds a VIN surrounded by door-jamb sticker noise", () => {
    const raw = [
      "MFD BY FORD MOTOR CO.",
      "DATE OF MFR: 07/2019",
      "VIN: 1M8GDM9AXKP042788",
      "TIRE P245/70R17 110S · 35 PSI COLD",
    ].join("\n");
    expect(harvestVinCandidates(raw)).toContain("1M8GDM9AXKP042788");
  });

  it("recovers a VIN that ran together with neighboring text", () => {
    const raw = "GWR3400LBS1M8GDM9AXKP042788VINTIRE";
    expect(harvestVinCandidates(raw)).toContain("1M8GDM9AXKP042788");
  });

  it("reads VINs printed with separators", () => {
    expect(harvestVinCandidates("1M8GDM9A-XKP04-2788")).toContain("1M8GDM9AXKP042788");
  });
});

describe("repairVinCandidate", () => {
  it("keeps an already-valid read unrepaired with the top bonus", () => {
    const results = repairVinCandidate("1M8GDM9AXKP042788");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ text: "1M8GDM9AXKP042788", repaired: false, bonus: 60 });
  });

  it("recovers a single OCR confusion at a data position", () => {
    // The D at position 5 was misread as 0 by OCR.
    const results = repairVinCandidate("1M8G0M9AXKP042788");
    const confusionFix = results.find((candidate) => candidate.text === "1M8GDM9AXKP042788");
    expect(confusionFix).toBeDefined();
    expect(confusionFix?.bonus).toBeGreaterThan(results[results.length - 1].bonus);
    expect(confusionFix?.repairs[0]).toContain('Position 5: "0" read as "D"');
  });

  it("falls back to recomputing the check digit when the error is at position 9", () => {
    // The valid VIN's X check digit was misread as 5; no confusion swap can
    // repair that (only position 9 changed), so the math fix must take over.
    const valid = "1M8GDM9AXKP042788";
    const misread = valid.slice(0, 8) + "5" + valid.slice(9);
    const results = repairVinCandidate(misread);
    const mathFix = results.find((candidate) => candidate.repairs[0]?.startsWith("Check digit"));
    expect(mathFix?.text).toBe(valid);
    expect(mathFix?.text[8]).toBe(computeCheckDigit(misread));
  });
});

describe("buildCandidates", () => {
  it("ranks an unrepaired valid read above repaired noise", () => {
    const raw = ["1M8GDM9AXKP042788", "P24570R17110S35PSI2200LB"].join("\n");
    const candidates = buildCandidates(raw, 80, "test");
    expect(candidates[0].vin).toBe("1M8GDM9AXKP042788");
    expect(candidates[0].checkDigitValid).toBe(true);
    expect(candidates[0].repairs).toHaveLength(0);
    expect(candidates[0].score).toBeGreaterThanOrEqual(candidates[1]?.score ?? 0);
  });

  it("carries OCR confidence into the score", () => {
    const high = buildCandidates("1M8GDM9AXKP042788", 90, "high")[0];
    const low = buildCandidates("1M8GDM9AXKP042788", 40, "low")[0];
    expect(high.score).toBeGreaterThan(low.score);
  });
});
