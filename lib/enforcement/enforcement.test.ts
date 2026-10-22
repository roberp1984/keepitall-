import { describe, expect, it } from "vitest";
import { enforcementBodyFor, escalationAfterDays } from "@/lib/enforcement";

describe("enforcementBodyFor", () => {
  it.each([
    ["EU261 departure from Germany → LBA", "EU261", "departure", "DE", "AE", "DE"],
    ["EU261 inbound to France → French body", "EU261", "arrival_on_qualifying_carrier", "US", "FR", "FR"],
    ["EU261 from Réunion → French body", "EU261", "departure", "RE", "FR", "FR"],
    ["UK261 departure → CAA", "UK261", "departure", "GB", "US", "GB"],
    ["UK261 inbound → CAA", "UK261", "arrival_on_qualifying_carrier", "US", "GB", "GB"],
    ["EU261 from the UK on an EU carrier → arrival state", "EU261", "arrival_on_qualifying_carrier", "GB", "ES", "ES"],
  ] as const)("%s", (_label, regime, scopeBasis, departureCountry, arrivalCountry, expected) => {
    expect(enforcementBodyFor({ regime, scopeBasis, departureCountry, arrivalCountry })?.country).toBe(expected);
  });

  it("returns null when we have no entry", () => {
    expect(enforcementBodyFor({ regime: "EU261", scopeBasis: "departure", departureCountry: "HU", arrivalCountry: "GB" })).toBeNull();
  });

  it("marks every entry unverified until checked", () => {
    expect(enforcementBodyFor({ regime: "UK261", scopeBasis: "departure", departureCountry: "GB", arrivalCountry: "US" })?.verified).toBe(false);
  });
});

describe("escalationAfterDays", () => {
  it("is 30 days for EU261 and 8 weeks for UK261", () => {
    expect(escalationAfterDays("EU261")).toBe(30);
    expect(escalationAfterDays("UK261")).toBe(56);
  });
});
