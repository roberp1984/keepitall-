// Server-only: pulls in the full airport dataset.
import { getAirport } from "../airports";
import { getAirline } from "../airlines";
import { regions } from "../rules/config";
import { pickJurisdiction } from "../rules/deadlines";
import type { ClaimInput, Disruption } from "../rules/eligibility";
import type { CarrierChoice, CarrierRegion, CheckAnswers } from "./answers";

/**
 * When the airline isn't in our list, the user tells us where it is based. The
 * rules engine only needs a licensing country in the right group, so we use a
 * representative member of that group.
 */
const REGION_GROUP: Record<Exclude<CarrierRegion, "other">, string> = { eu: "EU27", eea_ch: "EEA_EFTA", uk: "UK" };
export const OTHER_CARRIER_COUNTRY = "XX";

export function carrierCountry(carrier: CarrierChoice): string | null {
  if (carrier.kind === "airline") return getAirline(carrier.slug)?.country ?? null;
  if (carrier.region === "other") return OTHER_CARRIER_COUNTRY;
  return regions.groups[REGION_GROUP[carrier.region]]?.[0] ?? null;
}

export function carrierName(carrier: CarrierChoice): string {
  if (carrier.kind === "airline") return getAirline(carrier.slug)?.name ?? "your airline";
  return "your airline";
}

export function toDisruption(a: CheckAnswers): Disruption {
  if (a.what === "delay") return { kind: "delay", arrivalDelayMinutes: a.delayMinutes ?? 0 };
  const rerouting = a.rerouted
    ? {
        arrivalDelayMinutes: a.reroutedDelayMinutes ?? 0,
        ...(a.what === "cancellation" ? { departureEarlierMinutes: a.reroutedEarlierMinutes ?? 0 } : {}),
      }
    : null;
  if (a.what === "cancellation") return { kind: "cancellation", noticeDays: a.noticeDays ?? 0, rerouting };
  return { kind: "denied_boarding", voluntary: a.volunteered ?? false, rerouting };
}

/** Resolves airports and carrier; null if any reference is unknown. */
export function toClaimInput(a: CheckAnswers, today: string): ClaimInput | null {
  const departure = getAirport(a.from);
  const arrival = getAirport(a.to);
  const country = carrierCountry(a.carrier);
  if (!departure || !arrival || !country) return null;
  return {
    departure,
    arrival,
    operatingCarrierCountry: country,
    flightDate: a.date,
    disruption: toDisruption(a),
    reason: a.reason,
    passengers: a.passengers,
    jurisdiction: pickJurisdiction([departure, arrival]),
    today,
  };
}
