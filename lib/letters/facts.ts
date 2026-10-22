import { getAirport } from "../airports";
import type { Airline } from "../airlines";
import { addDays } from "../rules/dates";
import type { Assessment, ClaimInput } from "../rules/eligibility";
import type { AirportLocation } from "../rules/types";
import config from "./config.json";
import type { ClaimFacts, PlaceFacts } from "./types";

export class ClaimFactsError extends Error {
  override name = "ClaimFactsError";
}

export interface CollectedDetails {
  airline: Airline | { name: string };
  flightNumber: string;
  bookingReference: string;
  /** Full names of every passenger claiming, in booking order. */
  passengers: string[];
  claimant: { fullName: string; email: string; postalAddress: string };
  /** YYYY-MM-DD */
  today: string;
}

const FLIGHT_NUMBER = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;
const BOOKING_REFERENCE = /^[A-Z0-9]{5,8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function place(location: AirportLocation): PlaceFacts {
  const airport = getAirport(location.iata);
  return {
    iata: location.iata.toUpperCase(),
    name: airport?.name ?? location.iata.toUpperCase(),
    city: airport?.city ?? "",
    country: location.country.toUpperCase(),
  };
}

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

/** Combines a validated, eligible assessment with post-payment details. Throws on anything inconsistent. */
export function buildClaimFacts(input: ClaimInput, assessment: Assessment, details: CollectedDetails): ClaimFacts {
  if (assessment.outcome !== "eligible" || !assessment.perPassenger || assessment.total === null) {
    throw new ClaimFactsError("Claim letters can only be built for eligible assessments");
  }
  const { regime, regulation, rulesetVersion, distanceKm, band } = assessment;
  if (!regime || !regulation || !rulesetVersion || distanceKm === null || !band) {
    throw new ClaimFactsError("Assessment is missing regime details");
  }

  const passengers = details.passengers.map(clean).filter(Boolean);
  if (passengers.length !== assessment.passengers) {
    throw new ClaimFactsError(`Expected ${assessment.passengers} passenger name(s), got ${passengers.length}`);
  }
  const flightNumber = details.flightNumber.replace(/\s+/g, "").toUpperCase();
  if (!FLIGHT_NUMBER.test(flightNumber)) throw new ClaimFactsError(`Invalid flight number: ${details.flightNumber}`);
  const bookingReference = details.bookingReference.replace(/\s+/g, "").toUpperCase();
  if (!BOOKING_REFERENCE.test(bookingReference)) throw new ClaimFactsError("Invalid booking reference");
  const claimant = {
    fullName: clean(details.claimant.fullName),
    email: details.claimant.email.trim(),
    postalAddress: details.claimant.postalAddress.trim(),
  };
  if (!claimant.fullName || !claimant.postalAddress) throw new ClaimFactsError("Claimant name and address are required");
  if (!EMAIL.test(claimant.email)) throw new ClaimFactsError("Invalid email address");

  const { currency } = assessment.perPassenger;
  return {
    regime,
    regulation,
    rulesetVersion,
    airline: { name: details.airline.name, slug: "slug" in details.airline ? details.airline.slug : null },
    flightNumber,
    flightDate: input.flightDate,
    departure: place(input.departure),
    arrival: place(input.arrival),
    disruption: input.disruption,
    reason: input.reason,
    distanceKm,
    band,
    perPassenger: { amount: assessment.perPassenger.amount, currency },
    total: { amount: assessment.total, currency },
    reduced: assessment.perPassenger.reduced,
    passengers,
    bookingReference,
    claimant,
    letterDate: details.today,
    responseDeadline: addDays(details.today, config.responseDays),
  };
}
