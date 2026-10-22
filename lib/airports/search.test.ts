import { describe, expect, it } from "vitest";
import { searchAirports } from "@/lib/airports/search";

describe("searchAirports", () => {
  it("puts an exact IATA match first", () => {
    expect(searchAirports("lhr")[0]?.iata).toBe("LHR");
    expect(searchAirports("JFK")[0]?.iata).toBe("JFK");
  });

  it("finds all airports for a city", () => {
    const london = searchAirports("london").map((a) => a.iata);
    expect(london).toEqual(expect.arrayContaining(["LHR", "LGW", "STN", "LTN"]));
  });

  it("ignores accents and case", () => {
    expect(searchAirports("malaga").map((a) => a.iata)).toContain("AGP");
    expect(searchAirports("ZÜRICH").map((a) => a.iata)).toContain("ZRH");
  });

  it("requires two characters and respects the limit", () => {
    expect(searchAirports("l")).toEqual([]);
    expect(searchAirports("an", 5)).toHaveLength(5);
  });

  it("returns only the public fields", () => {
    expect(Object.keys(searchAirports("CDG")[0]!).sort()).toEqual(["city", "country", "iata", "name"]);
  });
});
