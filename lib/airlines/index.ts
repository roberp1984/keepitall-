import airlinesJson from "../../data/airlines.json";

export interface Airline {
  slug: string;
  iata: string;
  name: string;
  /** ISO alpha-2 of the licensing state; this is what the rules engine uses. */
  country: string;
  isEU: boolean;
  isUK: boolean;
  website: string;
  claimFormUrl: string | null;
  claimsEmail: string | null;
  /** A human has checked claimFormUrl / claimsEmail. Unverified contact details are never shown. */
  verified: boolean;
  /** How to use this airline's claim route. Like the link, only shown once verified. */
  claimNotes: string;
  notes: string;
}

const airlines: Airline[] = airlinesJson.airlines;
const bySlug = new Map(airlines.map((a) => [a.slug, a]));

export function allAirlines(): readonly Airline[] {
  return airlines;
}

export function getAirline(slug: string): Airline | undefined {
  return bySlug.get(slug);
}

/** IATA codes are shared between group airlines (e.g. easyJet), so this can return several. */
export function airlinesByIata(iata: string): Airline[] {
  const code = iata.trim().toUpperCase();
  return airlines.filter((a) => a.iata === code);
}
