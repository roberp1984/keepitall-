import type { AirportLocation } from "./types";

export const EARTH_RADIUS_KM = 6371;

interface Point {
  lat: number;
  lon: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in km (haversine formula, mean Earth radius). */
export function haversineKm(a: Point, b: Point): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function flightDistanceKm(departure: AirportLocation, arrival: AirportLocation): number {
  return haversineKm(departure, arrival);
}
