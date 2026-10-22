import type { Airport } from "../../lib/rules/types.ts";

export interface TerritoryConfig {
  euCountries: Set<string>;
  ukCountries: Set<string>;
  euExcludedAirports: Set<string>;
  ukExcludedAirports: Set<string>;
}

const EXCLUDED_TYPES = new Set(["closed", "heliport", "balloonport"]);
const TYPE_RANK: Record<string, number> = {
  large_airport: 4,
  medium_airport: 3,
  small_airport: 2,
  seaplane_base: 1,
};
const IATA = /^[A-Z]{3}$/;

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

type CsvRow = Record<string, string | undefined>;

function rank(row: CsvRow): number {
  return (row.scheduled_service === "yes" ? 10 : 0) + (TYPE_RANK[row.type ?? ""] ?? 0);
}

/** OurAirports `airports.csv` records → deduplicated, sorted airports.json entries. */
export function buildAirports(rows: CsvRow[], territory: TerritoryConfig): Airport[] {
  const best = new Map<string, CsvRow>();
  for (const row of rows) {
    const iata = row.iata_code?.trim().toUpperCase();
    if (!iata || !IATA.test(iata) || EXCLUDED_TYPES.has(row.type ?? "")) continue;
    const lat = Number(row.latitude_deg);
    const lon = Number(row.longitude_deg);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const current = best.get(iata);
    if (!current || rank(row) > rank(current)) best.set(iata, row);
  }

  return [...best.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iata, row]) => {
      const country = (row.iso_country ?? "").toUpperCase();
      return {
        iata,
        name: row.name ?? "",
        city: row.municipality ?? "",
        country,
        lat: round(Number(row.latitude_deg), 5),
        lon: round(Number(row.longitude_deg), 5),
        isEU: territory.euCountries.has(country) && !territory.euExcludedAirports.has(iata),
        isUK: territory.ukCountries.has(country) && !territory.ukExcludedAirports.has(iata),
        scheduled: row.scheduled_service === "yes",
      };
    });
}
