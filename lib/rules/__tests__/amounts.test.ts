import { describe, expect, it } from "vitest";
import { compensationFor, isWithinReductionLimit, rulesetFor, selectBand } from "@/lib/rules";
import type { Ruleset } from "@/lib/rules/types";

const eu = rulesetFor("EU261", "2026-06-15")!;
const uk = rulesetFor("UK261", "2026-06-15")!;
const euPreBrexit = rulesetFor("EU261", "2020-06-15")!;

describe("selectBand — Art. 7(1) distance bands", () => {
  it.each([
    [0, "short"],
    [1, "short"],
    [1499.99, "short"],
    [1500, "short"],
    [1500.01, "medium"],
    [2500, "medium"],
    [3500, "medium"],
    [3500.01, "long"],
    [9000, "long"],
  ] as const)("non-intra flight of %d km → %s", (km, band) => {
    for (const ruleset of [eu, uk, euPreBrexit]) {
      expect(selectBand(ruleset, km, false).id).toBe(band);
    }
  });

  it.each([
    [1500, "short"],
    [1500.01, "medium"],
    [3500, "medium"],
    [3500.01, "medium"],
    [9370, "medium"],
  ] as const)("intra-territory flight of %d km → %s (never long)", (km, band) => {
    for (const ruleset of [eu, uk]) {
      expect(selectBand(ruleset, km, true).id).toBe(band);
    }
  });

  it("rejects invalid distances", () => {
    expect(() => selectBand(eu, -1, false)).toThrow(RangeError);
    expect(() => selectBand(eu, Number.NaN, false)).toThrow(RangeError);
    expect(() => selectBand(eu, Number.POSITIVE_INFINITY, false)).toThrow(RangeError);
  });
});

describe("compensationFor — amounts per band", () => {
  const cases: [Ruleset, string, number, number, string][] = [
    [eu, "short", 250, 125, "EUR"],
    [eu, "medium", 400, 200, "EUR"],
    [eu, "long", 600, 300, "EUR"],
    [uk, "short", 220, 110, "GBP"],
    [uk, "medium", 350, 175, "GBP"],
    [uk, "long", 520, 260, "GBP"],
    [euPreBrexit, "short", 250, 125, "EUR"],
    [euPreBrexit, "medium", 400, 200, "EUR"],
    [euPreBrexit, "long", 600, 300, "EUR"],
  ];

  it.each(cases)("%s %s: full %d, reduced %d %s", (ruleset, bandId, full, half, currency) => {
    const band = ruleset.bands.find((b) => b.id === bandId)!;
    expect(compensationFor(ruleset, band, false)).toEqual({
      currency,
      band: bandId,
      fullAmount: full,
      amount: full,
      reduced: false,
    });
    expect(compensationFor(ruleset, band, true)).toEqual({
      currency,
      band: bandId,
      fullAmount: full,
      amount: half,
      reduced: true,
    });
  });
});

describe("isWithinReductionLimit — Art. 7(2) limits 2h / 3h / 4h", () => {
  it.each([
    ["short", 120, true],
    ["short", 121, false],
    ["medium", 180, true],
    ["medium", 181, false],
    ["long", 240, true],
    ["long", 241, false],
    ["long", 0, true],
    ["long", -30, true],
  ] as const)("%s band, %d min late → %s", (bandId, minutes, expected) => {
    for (const ruleset of [eu, uk]) {
      const band = ruleset.bands.find((b) => b.id === bandId)!;
      expect(isWithinReductionLimit(band, minutes)).toBe(expected);
    }
  });
});
