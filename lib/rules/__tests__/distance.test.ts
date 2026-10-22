import { describe, expect, it } from "vitest";
import { EARTH_RADIUS_KM, flightDistanceKm, haversineKm } from "@/lib/rules";
import { airport } from "./helpers";

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm({ lat: 51.47, lon: -0.45 }, { lat: 51.47, lon: -0.45 })).toBe(0);
  });

  it("gives ~111.19 km per degree along the equator", () => {
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.195, 2);
  });

  it("gives half the circumference for antipodal points", () => {
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(Math.PI * EARTH_RADIUS_KM, 6);
    expect(haversineKm({ lat: 90, lon: 0 }, { lat: -90, lon: 0 })).toBeCloseTo(Math.PI * EARTH_RADIUS_KM, 6);
  });

  it("is symmetric", () => {
    const a = { lat: 40.64, lon: -73.78 };
    const b = { lat: 51.47, lon: -0.45 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });

  it("handles the antimeridian", () => {
    expect(haversineKm({ lat: 0, lon: 179.5 }, { lat: 0, lon: -179.5 })).toBeCloseTo(111.195, 2);
  });
});

describe("flightDistanceKm with OurAirports data", () => {
  it.each([
    ["LHR", "CDG", 348],
    ["LHR", "JFK", 5540],
    ["FRA", "DXB", 4845],
    ["CDG", "RUN", 9370],
  ])("%s–%s is about %i km", (from, to, km) => {
    expect(flightDistanceKm(airport(from), airport(to))).toBeGreaterThan(km - 5);
    expect(flightDistanceKm(airport(from), airport(to))).toBeLessThan(km + 5);
  });
});
