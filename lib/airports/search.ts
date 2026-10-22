import type { Airport } from "../rules/types";
import { allAirports } from "./index";

export type AirportOption = Pick<Airport, "iata" | "name" | "city" | "country">;

const normalise = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const index = allAirports()
  .filter((a) => a.scheduled)
  .map((a) => ({ airport: a, iata: a.iata.toLowerCase(), city: normalise(a.city), name: normalise(a.name) }));

function score(entry: (typeof index)[number], q: string): number {
  if (entry.iata === q) return 100;
  if (entry.city === q) return 90;
  if (q.length <= 3 && entry.iata.startsWith(q)) return 70;
  if (entry.city.startsWith(q)) return 60;
  if (entry.name.startsWith(q)) return 50;
  if (entry.city.includes(q) || entry.name.includes(q)) return 30;
  return 0;
}

/** Autocomplete by IATA code, city or airport name; scheduled-service airports only. */
export function searchAirports(query: string, limit = 8): AirportOption[] {
  const q = normalise(query);
  if (q.length < 2) return [];
  return index
    .map((entry) => ({ entry, s: score(entry, q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.entry.city.localeCompare(b.entry.city) || a.entry.iata.localeCompare(b.entry.iata))
    .slice(0, limit)
    .map(({ entry: { airport } }) => ({ iata: airport.iata, name: airport.name, city: airport.city, country: airport.country }));
}
