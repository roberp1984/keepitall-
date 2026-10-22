export type Regime = "EU261" | "UK261";
export type Currency = "EUR" | "GBP";
export type BandId = "short" | "medium" | "long";
export type CaseStrength = "strong" | "disputed" | "weak";

/** Minimal airport data the rules engine needs. */
export interface AirportLocation {
  iata: string;
  /** ISO 3166-1 alpha-2, as in OurAirports `iso_country`. */
  country: string;
  lat: number;
  lon: number;
}

/** Shape of each entry in /data/airports.json. */
export interface Airport extends AirportLocation {
  name: string;
  city: string;
  /** Departure from here is covered by EU261 (EU/EEA/CH territory). */
  isEU: boolean;
  /** Departure from here is covered by UK261. */
  isUK: boolean;
  /** Airport has scheduled passenger service (useful for autocomplete ranking). */
  scheduled: boolean;
}

export interface Band {
  id: BandId;
  /** Inclusive upper bound in km; null = no upper bound. */
  maxKm: number | null;
  amount: number;
  /** Art. 7(2): compensation is reduced if arrival delay does not exceed this. */
  rerouteReductionLimitMinutes: number;
}

export interface ReroutingExemption {
  noticeDaysFrom: number;
  noticeDaysBelow: number;
  maxDepartureEarlierMinutes: number;
  arrivalLaterBelowMinutes: number;
}

export interface Ruleset {
  regime: Regime;
  version: string;
  regulation: string;
  /** Inclusive, YYYY-MM-DD. */
  effectiveFrom: string;
  /** Inclusive, YYYY-MM-DD; null = still in force. */
  effectiveTo: string | null;
  currency: Currency;
  /** Region group names from regions.json. */
  territory: string[];
  /** Carriers licensed in these groups are covered on inbound flights into the territory. */
  inboundCarrierGroups: string[];
  bands: Band[];
  /** Art. 7(1)(b): flights within the territory over this distance use this band. */
  intraTerritoryOverride: { aboveKm: number; band: BandId };
  reductionPercent: number;
  delay: {
    minArrivalDelayMinutes: number;
    /** Bands where Art. 7(2) also reduces delay compensation (Sturgeon: long-haul delays of 3–4h). */
    reductionBands: BandId[];
  };
  cancellation: {
    noCompensationIfNoticeDaysAtLeast: number;
    reroutingExemptions: ReroutingExemption[];
  };
}
