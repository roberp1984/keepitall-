import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRecords } from "./csv.mts";
import { buildAirports, type TerritoryConfig } from "./transform.mts";

describe("parseCsv", () => {
  it("parses quoted fields, escaped quotes, commas and newlines", () => {
    expect(parseCsv('a,"b,c","say ""hi""","line\nbreak",\r\n1,2,3,4,5\n')).toEqual([
      ["a", "b,c", 'say "hi"', "line\nbreak", ""],
      ["1", "2", "3", "4", "5"],
    ]);
  });

  it("handles a BOM and a missing trailing newline", () => {
    expect(parseCsv("﻿x,y\n1,2")).toEqual([
      ["x", "y"],
      ["1", "2"],
    ]);
  });

  it("throws on an unterminated quote", () => {
    expect(() => parseCsv('a,"oops')).toThrow(/Unterminated/);
  });

  it("maps records by header and skips blank lines", () => {
    expect(parseCsvRecords("iata_code,name\nLHR,Heathrow\n\nCDG,\"Paris, CDG\"\n")).toEqual([
      { iata_code: "LHR", name: "Heathrow" },
      { iata_code: "CDG", name: "Paris, CDG" },
    ]);
  });
});

describe("buildAirports", () => {
  const territory: TerritoryConfig = {
    euCountries: new Set(["FR", "NO"]),
    ukCountries: new Set(["GB"]),
    euExcludedAirports: new Set(["LYR"]),
    ukExcludedAirports: new Set(),
  };
  const row = (o: Record<string, string>) => ({
    type: "large_airport",
    name: "X",
    latitude_deg: "1",
    longitude_deg: "2",
    iso_country: "FR",
    municipality: "Town",
    scheduled_service: "yes",
    iata_code: "",
    ...o,
  });

  it("keeps valid IATA airports, drops heliports/closed/invalid codes, sorts by IATA", () => {
    const out = buildAirports(
      [
        row({ iata_code: "ORY" }),
        row({ iata_code: "CDG", latitude_deg: "49.0097", longitude_deg: "2.5479123" }),
        row({ iata_code: "HHH", type: "heliport" }),
        row({ iata_code: "OLD", type: "closed" }),
        row({ iata_code: "0AB" }),
        row({ iata_code: "" }),
        row({ iata_code: "BAD", latitude_deg: "" , longitude_deg: "x" }),
      ],
      territory,
    );
    expect(out.map((a) => a.iata)).toEqual(["CDG", "ORY"]);
    expect(out[0]).toEqual({
      iata: "CDG",
      name: "X",
      city: "Town",
      country: "FR",
      lat: 49.0097,
      lon: 2.54791,
      isEU: true,
      isUK: false,
      scheduled: true,
    });
  });

  it("deduplicates IATA codes, preferring scheduled service then airport size", () => {
    const out = buildAirports(
      [
        row({ iata_code: "DUP", name: "small unscheduled", type: "small_airport", scheduled_service: "no" }),
        row({ iata_code: "DUP", name: "medium scheduled", type: "medium_airport" }),
        row({ iata_code: "DUP", name: "large unscheduled", type: "large_airport", scheduled_service: "no" }),
      ],
      territory,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe("medium scheduled");
  });

  it("sets isEU / isUK from territory and exclusions", () => {
    const out = buildAirports(
      [
        row({ iata_code: "OSL", iso_country: "NO" }),
        row({ iata_code: "LYR", iso_country: "NO" }),
        row({ iata_code: "LHR", iso_country: "GB" }),
        row({ iata_code: "JFK", iso_country: "US" }),
      ],
      territory,
    );
    const flags = Object.fromEntries(out.map((a) => [a.iata, [a.isEU, a.isUK]]));
    expect(flags).toEqual({ JFK: [false, false], LHR: [false, true], LYR: [false, false], OSL: [true, false] });
  });
});
