import { getAirline } from "@/lib/airlines";
import { assessClaim, type ClaimInput, type Disruption } from "@/lib/rules";
import { buildClaimFacts, type CollectedDetails } from "@/lib/letters";
import { airport } from "@/lib/rules/__tests__/helpers";

export function claimInput(from: string, to: string, carrierCountry: string, disruption: Disruption, passengers = 1): ClaimInput {
  return {
    departure: airport(from),
    arrival: airport(to),
    operatingCarrierCountry: carrierCountry,
    flightDate: "2026-06-15",
    disruption,
    reason: "technical",
    passengers,
  };
}

export function details(overrides: Partial<CollectedDetails> = {}): CollectedDetails {
  return {
    airline: getAirline("british-airways")!,
    flightNumber: "BA 117",
    bookingReference: "abc123",
    passengers: ["Alex Morgan"],
    claimant: { fullName: "Alex Morgan", email: "alex@example.com", postalAddress: "1 High Street\nLondon\nSW1A 1AA" },
    today: "2026-10-22",
    ...overrides,
  };
}

/** LHR→JFK on BA, 5h delay → UK261 £520. */
export function ukLongHaulFacts(passengers = ["Alex Morgan"]) {
  const input = claimInput("LHR", "JFK", "GB", { kind: "delay", arrivalDelayMinutes: 300 }, passengers.length);
  return buildClaimFacts(input, assessClaim(input), details({ passengers }));
}

/** A model body that follows every rule. */
export const GOOD_BODY = `I am writing to claim compensation under Regulation (EC) No 261/2004 as retained in UK law for flight {{FLIGHT_NUMBER}} on {{FLIGHT_DATE}}, booking reference {{BOOKING_REFERENCE}}.

The flight arrived {{ARRIVAL_DELAY}} after its scheduled arrival time. Under Articles 6 and 7, as interpreted in Sturgeon (C-402/07), passengers whose flight arrives three hours or more late are entitled to compensation. The distance is {{DISTANCE}}, so {{PER_PASSENGER_AMOUNT}} per passenger is due under Article 7(1)(c).

A technical problem is not an extraordinary circumstance under Article 5(3) (Wallentin-Hermann, C-549/07).

Please pay {{TOTAL_AMOUNT}} by bank transfer by {{RESPONSE_DEADLINE}}. I do not accept vouchers. Please reply to {{CLAIMANT_EMAIL}}.`;
