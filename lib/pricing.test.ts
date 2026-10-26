import { describe, expect, it } from "vitest";
import { feeComparison } from "@/lib/marketing";
import { packPrice } from "@/lib/pricing";

describe("packPrice", () => {
  it("charges EU261 claims €19 and UK261 claims €18 (both prices are in EUR)", () => {
    expect(packPrice("EUR")).toEqual({ amount: 19, currency: "EUR" });
    expect(packPrice("GBP")).toEqual({ amount: 18, currency: "EUR" });
  });
});

describe("feeComparison", () => {
  it("compares in one currency", () => {
    expect(feeComparison(600, "EUR")).toMatchObject({ ourPrice: "€19", youKeep: "€581", claimCompanyKeeps: "€390" });
  });

  it("refuses to mix currencies", () => {
    expect(() => feeComparison(520, "GBP")).toThrow(/charged in EUR/);
  });
});
