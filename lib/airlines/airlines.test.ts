import { describe, expect, it } from "vitest";
import { airlinesByIata, allAirlines, getAirline } from "@/lib/airlines";
import { countriesFor } from "@/lib/rules/config";

const euEeaCh = countriesFor(["EU27", "EU_OUTERMOST", "EEA_EFTA", "CH"]);

describe("data/airlines.json", () => {
  const airlines = allAirlines();

  it("has 30 airlines with unique slugs", () => {
    expect(airlines).toHaveLength(30);
    expect(new Set(airlines.map((a) => a.slug)).size).toBe(30);
  });

  it("has well-formed fields and flags consistent with the licensing country", () => {
    for (const a of airlines) {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
      expect(a.iata).toMatch(/^[A-Z0-9]{2}$/);
      expect(a.country).toMatch(/^[A-Z]{2}$/);
      expect(a.isEU, a.slug).toBe(euEeaCh.has(a.country));
      expect(a.isUK, a.slug).toBe(a.country === "GB");
      expect(a.website).toMatch(/^https:\/\//);
    }
  });

  it("never marks contact details verified without a URL or email", () => {
    for (const a of airlines) {
      if (a.verified) expect(a.claimFormUrl ?? a.claimsEmail, a.slug).toBeTruthy();
      if (a.claimFormUrl) expect(a.claimFormUrl).toMatch(/^https:\/\//);
    }
  });

  it("looks up by slug and by shared IATA code", () => {
    expect(getAirline("swiss")?.country).toBe("CH");
    expect(airlinesByIata("u2").map((a) => a.slug)).toEqual(["easyjet"]);
    expect(getAirline("nope")).toBeUndefined();
  });
});
