import { describe, expect, it } from "vitest";
import { countriesFor, regions, rulesetFor, rulesets } from "@/lib/rules/config";
import type { Regime } from "@/lib/rules/types";

describe("rulesets.json integrity", () => {
  it.each(["EU261", "UK261"] as Regime[])("%s versions do not overlap", (regime) => {
    const versions = rulesets.filter((r) => r.regime === regime).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    for (let i = 1; i < versions.length; i++) {
      const prev = versions[i - 1]!;
      expect(prev.effectiveTo, `${prev.version} must be closed`).not.toBeNull();
      expect(prev.effectiveTo! < versions[i]!.effectiveFrom).toBe(true);
    }
  });

  it.each(["EU261", "UK261"] as Regime[])("%s has a version in force today", (regime) => {
    expect(rulesetFor(regime, new Date().toISOString().slice(0, 10))).not.toBeNull();
  });

  it("has ascending bands ending in an open band, and valid references", () => {
    for (const r of rulesets) {
      const ids = r.bands.map((b) => b.id);
      expect(ids).toEqual(["short", "medium", "long"]);
      expect(r.bands.at(-1)!.maxKm).toBeNull();
      for (let i = 1; i < r.bands.length - 1; i++) {
        expect(r.bands[i]!.maxKm!).toBeGreaterThan(r.bands[i - 1]!.maxKm!);
        expect(r.bands[i]!.amount).toBeGreaterThan(r.bands[i - 1]!.amount);
      }
      expect(ids).toContain(r.intraTerritoryOverride.band);
      expect(() => countriesFor(r.territory)).not.toThrow();
      expect(() => countriesFor(r.inboundCarrierGroups)).not.toThrow();
      expect(r.reductionPercent).toBe(50);
      for (const id of r.delay.reductionBands) expect(ids).toContain(id);
    }
  });

  it("throws on an unknown region group", () => {
    expect(() => countriesFor(["NOPE"])).toThrow(/NOPE/);
  });
});

describe("regions.json integrity", () => {
  it("uses ISO alpha-2 codes and no country is in two groups", () => {
    const seen = new Map<string, string>();
    for (const [group, countries] of Object.entries(regions.groups)) {
      for (const c of countries) {
        expect(c).toMatch(/^[A-Z]{2}$/);
        expect(seen.get(c), `${c} in ${group} and ${seen.get(c)}`).toBeUndefined();
        seen.set(c, group);
      }
    }
    expect(regions.groups.EU27).toHaveLength(27);
  });
});
