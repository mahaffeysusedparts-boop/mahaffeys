import { describe, expect, it } from "vitest";
import { findCustomerByPlate, normalizePlate, type LprCustomer } from "./lpr";

const customer: LprCustomer = {
  id: "cust-1",
  fullName: "Jordan Smith",
  phone: "555-0100",
  idNumber: "DL123",
  address: "1 Main Street",
  vehicleLicensePlate: "ABC-1234",
  capturedPlates: ["OLD 987"],
};

describe("LPR customer matching", () => {
  it("normalizes spacing, punctuation, and case", () => {
    expect(normalizePlate(" ab-c 123 ")).toBe("ABC123");
  });

  it("matches primary and previously captured plates", () => {
    expect(findCustomerByPlate([customer], "abc1234")?.id).toBe("cust-1");
    expect(findCustomerByPlate([customer], "old-987")?.id).toBe("cust-1");
  });

  it("returns null when no customer matches", () => {
    expect(findCustomerByPlate([customer], "NEW555")).toBeNull();
  });
});
