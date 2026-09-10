import { describe, expect, it } from "vitest";
import { moneyToWords, moneyToWordsTitleCase } from "./moneyToWords";

describe("moneyToWords", () => {
  it("renders zero", () => {
    expect(moneyToWords(0)).toBe("Zero and 00/100 dollars");
  });

  it("renders cents-only amounts", () => {
    expect(moneyToWords(0.05)).toBe("Zero and 05/100 dollars");
    expect(moneyToWords(0.99)).toBe("Zero and 99/100 dollars");
  });

  it("renders simple dollar amounts", () => {
    expect(moneyToWords(1)).toBe("one and 00/100 dollars");
    expect(moneyToWords(25)).toBe("twenty-five and 00/100 dollars");
    expect(moneyToWords(100)).toBe("one hundred and 00/100 dollars");
  });

  it("renders teens and hyphenated tens", () => {
    expect(moneyToWords(13)).toBe("thirteen and 00/100 dollars");
    expect(moneyToWords(42.5)).toBe("forty-two and 50/100 dollars");
  });

  it("renders compound hundreds", () => {
    expect(moneyToWords(342.07)).toBe("three hundred forty-two and 07/100 dollars");
  });

  it("renders thousands with empty groups", () => {
    expect(moneyToWords(1000)).toBe("one thousand and 00/100 dollars");
    expect(moneyToWords(2005.1)).toBe("two thousand five and 10/100 dollars");
  });

  it("renders one million and one cent", () => {
    expect(moneyToWords(1_000_000.01)).toBe("one million and 01/100 dollars");
  });

  it("renders the maximum supported amount", () => {
    expect(moneyToWords(999_999_999.99)).toBe(
      "nine hundred ninety-nine million nine hundred ninety-nine thousand nine hundred ninety-nine and 99/100 dollars",
    );
  });

  it("rounds half-cent inputs to the nearest cent", () => {
    expect(moneyToWords(10.555)).toBe("ten and 56/100 dollars");
    expect(moneyToWords(10.554)).toBe("ten and 55/100 dollars");
  });

  it("returns empty for out-of-range or invalid amounts", () => {
    expect(moneyToWords(-1)).toBe("");
    expect(moneyToWords(1_000_000_000)).toBe("");
    expect(moneyToWords(Number.NaN)).toBe("");
    expect(moneyToWords(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("title-cases for the printed line", () => {
    expect(moneyToWordsTitleCase(1250.3)).toBe("One Thousand Two Hundred Fifty And 30/100 Dollars");
    expect(moneyToWordsTitleCase(Number.NaN)).toBe("");
  });
});
