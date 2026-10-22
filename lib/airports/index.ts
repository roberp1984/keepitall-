import airportsJson from "../../data/airports.json";
import type { Airport } from "../rules/types";

const airports = airportsJson as Airport[];
const byIata = new Map(airports.map((a) => [a.iata, a]));

export function getAirport(iata: string): Airport | undefined {
  return byIata.get(iata.trim().toUpperCase());
}

export function allAirports(): readonly Airport[] {
  return airports;
}
