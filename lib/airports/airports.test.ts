import { describe, expect, it } from "vitest";
import { allAirports, getAirport } from "@/lib/airports";

describe("data/airports.json", () => {
  it("has thousands of unique, well-formed entries", () => {
    const all = allAirports();
    expect(all.length).toBeGreaterThan(5000);
    expect(new Set(all.map((a) => a.iata)).size).toBe(all.length);
    for (const a of all) {
      expect(a.iata).toMatch(/^[A-Z]{3}$/);
      expect(a.country).toMatch(/^[A-Z]{2}$/);
      expect(Math.abs(a.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(a.lon)).toBeLessThanOrEqual(180);
    }
  });

  it.each([
    ["LHR", "GB", false, true],
    ["EDI", "GB", false, true],
    ["CDG", "FR", true, false],
    ["ZRH", "CH", true, false],
    ["OSL", "NO", true, false],
    ["KEF", "IS", true, false],
    ["RUN", "RE", true, false],
    ["TFS", "ES", true, false],
    ["MHQ", "FI", true, false],
    ["LYR", "NO", false, false],
    ["ECN", "CY", false, false],
    ["FAE", "FO", false, false],
    ["JER", "JE", false, false],
    ["GIB", "GI", false, false],
    ["JFK", "US", false, false],
  ])("%s: country %s, isEU %s, isUK %s", (iata, country, isEU, isUK) => {
    expect(getAirport(iata)).toMatchObject({ country, isEU, isUK, scheduled: true });
  });

  it("looks up case-insensitively and trims", () => {
    expect(getAirport(" lhr ")?.iata).toBe("LHR");
    expect(getAirport("ZZZZ")).toBeUndefined();
  });
});
