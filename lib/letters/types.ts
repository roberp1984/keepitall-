import type { Disruption } from "../rules/eligibility";
import type { ReasonCode } from "../rules/extraordinary";
import type { BandId, Currency, Regime } from "../rules/types";

export interface Money {
  amount: number;
  currency: Currency;
}

export interface PlaceFacts {
  iata: string;
  name: string;
  city: string;
  country: string;
}

/**
 * Everything a letter may state. Built only from a validated Assessment plus the
 * details collected after payment — letters never compute eligibility or amounts.
 */
export interface ClaimFacts {
  regime: Regime;
  regulation: string;
  rulesetVersion: string;
  airline: { name: string; slug: string | null };
  flightNumber: string;
  /** Scheduled departure date, YYYY-MM-DD. */
  flightDate: string;
  departure: PlaceFacts;
  arrival: PlaceFacts;
  disruption: Disruption;
  reason: ReasonCode;
  distanceKm: number;
  band: BandId;
  perPassenger: Money;
  total: Money;
  reduced: boolean;
  passengers: string[];
  bookingReference: string;
  claimant: { fullName: string; email: string; postalAddress: string };
  /** YYYY-MM-DD */
  letterDate: string;
  /** YYYY-MM-DD */
  responseDeadline: string;
}
