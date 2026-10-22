import { getAirport } from "@/lib/airports";
import type { ClaimInput, Disruption } from "@/lib/rules";
import type { Airport } from "@/lib/rules/types";

export function airport(iata: string): Airport {
  const found = getAirport(iata);
  if (!found) throw new Error(`Test fixture airport missing from data/airports.json: ${iata}`);
  return found;
}

/** Operating-carrier licence countries used across tests. */
export const CARRIER = {
  britishAirways: "GB",
  easyJetUK: "GB",
  airFrance: "FR",
  lufthansa: "DE",
  tapPortugal: "PT",
  aerLingus: "IE",
  swiss: "CH",
  norwegian: "NO",
  icelandair: "IS",
  emirates: "AE",
  americanAirlines: "US",
  turkishAirlines: "TR",
  elAl: "IL",
  atlanticAirways: "FO",
  blueIslands: "JE",
} as const;

export function claim(
  from: string,
  to: string,
  carrierCountry: string,
  disruption: Disruption,
  overrides: Partial<ClaimInput> = {},
): ClaimInput {
  return {
    departure: airport(from),
    arrival: airport(to),
    operatingCarrierCountry: carrierCountry,
    flightDate: "2026-06-15",
    disruption,
    reason: "technical",
    passengers: 1,
    ...overrides,
  };
}

export const delay = (hours: number, minutes = 0): Disruption => ({
  kind: "delay",
  arrivalDelayMinutes: hours * 60 + minutes,
});
