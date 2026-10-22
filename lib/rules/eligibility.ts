import { compensationFor, isWithinReductionLimit, selectBand, type Compensation } from "./amounts";
import { isIsoDate } from "./dates";
import { getDeadline, type DeadlineInfo } from "./deadlines";
import { flightDistanceKm } from "./distance";
import { classifyReason, isReasonCode, type ReasonCode } from "./extraordinary";
import { determineScope, isInTerritory, type RegimeMatch } from "./scope";
import type { AirportLocation, Band, CaseStrength, Regime, Ruleset } from "./types";

export interface Rerouting {
  /** Minutes after the ORIGINAL scheduled arrival that the passenger arrived (may be negative). */
  arrivalDelayMinutes: number;
  /** Minutes before the original scheduled departure that the rerouted flight left. Unknown → assumed 0. */
  departureEarlierMinutes?: number;
}

export type Disruption =
  | { kind: "delay"; arrivalDelayMinutes: number }
  | { kind: "cancellation"; noticeDays: number; rerouting: Rerouting | null }
  | { kind: "denied_boarding"; voluntary: boolean; rerouting: Rerouting | null };

export interface ClaimInput {
  /** First departure airport of the booking. */
  departure: AirportLocation;
  /** Final destination of the booking. */
  arrival: AirportLocation;
  operatingCarrierCountry: string;
  /** Scheduled departure date, YYYY-MM-DD. */
  flightDate: string;
  disruption: Disruption;
  reason: ReasonCode;
  passengers: number;
  receivedBenefitsInThirdCountry?: boolean;
  /** Jurisdiction key from deadlines.json, if known. */
  jurisdiction?: string;
  /** Today's date, YYYY-MM-DD (injected to keep this pure). */
  today?: string;
}

export type Outcome = "eligible" | "not_eligible" | "not_covered";

export type OutcomeCode =
  | "NOT_COVERED"
  | "DELAY_BELOW_THRESHOLD"
  | "CANCELLATION_NOTICE_SUFFICIENT"
  | "CANCELLATION_REROUTING_EXEMPT"
  | "DENIED_BOARDING_VOLUNTARY"
  | "REDUCED_ART_7_2"
  | "ALSO_COVERED_BY_OTHER_REGIME"
  | "REROUTED_DEPARTURE_TIME_ASSUMED";

export interface Assessment {
  outcome: Outcome;
  codes: OutcomeCode[];
  regime: Regime | null;
  regulation: string | null;
  rulesetVersion: string | null;
  scopeBasis: RegimeMatch["basis"] | null;
  alsoCoveredBy: Regime[];
  distanceKm: number | null;
  band: Band["id"] | null;
  perPassenger: Compensation | null;
  passengers: number;
  total: number | null;
  strength: CaseStrength | null;
  strengthRationale: string | null;
  /** Suggested alternatives when not covered. */
  alternatives: ("MONTREAL_CONVENTION" | "REFUND_RIGHTS")[];
  deadline: DeadlineInfo | null;
}

export class RulesInputError extends Error {
  override name = "RulesInputError";
}

function assertValidInput(input: ClaimInput): void {
  const fail = (msg: string): never => {
    throw new RulesInputError(msg);
  };
  if (!Number.isInteger(input.passengers) || input.passengers < 1) fail("passengers must be an integer >= 1");
  if (!isIsoDate(input.flightDate)) fail("flightDate must be YYYY-MM-DD");
  if (input.today !== undefined && !isIsoDate(input.today)) fail("today must be YYYY-MM-DD");
  if (!isReasonCode(input.reason)) fail(`unknown reason: ${String(input.reason)}`);
  for (const airport of [input.departure, input.arrival]) {
    if (!Number.isFinite(airport.lat) || !Number.isFinite(airport.lon)) fail(`invalid coordinates for ${airport.iata}`);
  }
  if (input.departure.iata.toUpperCase() === input.arrival.iata.toUpperCase()) fail("departure and arrival must differ");

  const d = input.disruption;
  if (d.kind === "delay" && !(Number.isFinite(d.arrivalDelayMinutes) && d.arrivalDelayMinutes >= 0)) {
    fail("arrivalDelayMinutes must be >= 0");
  }
  if (d.kind === "cancellation" && !(Number.isFinite(d.noticeDays) && d.noticeDays >= 0)) {
    fail("noticeDays must be >= 0");
  }
  if (d.kind !== "delay" && d.rerouting) {
    if (!Number.isFinite(d.rerouting.arrivalDelayMinutes)) fail("rerouting.arrivalDelayMinutes must be a number");
    const early = d.rerouting.departureEarlierMinutes;
    if (early !== undefined && !(Number.isFinite(early) && early >= 0)) {
      fail("rerouting.departureEarlierMinutes must be >= 0");
    }
  }
}

type Entitlement =
  | { entitled: false; code: OutcomeCode }
  | { entitled: true; reductionDelayMinutes: number | null; codes: OutcomeCode[] };

/** Art. 4, 5, 6 (as read by Sturgeon) — is compensation due, and what delay counts for Art. 7(2)? */
function entitlement(ruleset: Ruleset, band: Band, d: Disruption): Entitlement {
  switch (d.kind) {
    case "delay":
      if (d.arrivalDelayMinutes < ruleset.delay.minArrivalDelayMinutes) {
        return { entitled: false, code: "DELAY_BELOW_THRESHOLD" };
      }
      return {
        entitled: true,
        reductionDelayMinutes: ruleset.delay.reductionBands.includes(band.id) ? d.arrivalDelayMinutes : null,
        codes: [],
      };

    case "cancellation": {
      const rules = ruleset.cancellation;
      if (d.noticeDays >= rules.noCompensationIfNoticeDaysAtLeast) {
        return { entitled: false, code: "CANCELLATION_NOTICE_SUFFICIENT" };
      }
      if (!d.rerouting) return { entitled: true, reductionDelayMinutes: null, codes: [] };

      const codes: OutcomeCode[] = [];
      if (d.rerouting.departureEarlierMinutes === undefined) codes.push("REROUTED_DEPARTURE_TIME_ASSUMED");
      const early = d.rerouting.departureEarlierMinutes ?? 0;
      const exempt = rules.reroutingExemptions.some(
        (e) =>
          d.noticeDays >= e.noticeDaysFrom &&
          d.noticeDays < e.noticeDaysBelow &&
          early <= e.maxDepartureEarlierMinutes &&
          d.rerouting!.arrivalDelayMinutes < e.arrivalLaterBelowMinutes,
      );
      if (exempt) return { entitled: false, code: "CANCELLATION_REROUTING_EXEMPT" };
      return { entitled: true, reductionDelayMinutes: d.rerouting.arrivalDelayMinutes, codes };
    }

    case "denied_boarding":
      if (d.voluntary) return { entitled: false, code: "DENIED_BOARDING_VOLUNTARY" };
      return { entitled: true, reductionDelayMinutes: d.rerouting?.arrivalDelayMinutes ?? null, codes: [] };
  }
}

const DENIED_BOARDING_RATIONALE =
  "Involuntary denied boarding (for example overbooking) is compensated unless there were reasonable grounds such as health, safety, security or inadequate travel documents.";

/**
 * Deterministic eligibility and amount assessment. The single entry point the UI
 * and letter generator should use; no other code decides eligibility or amounts.
 */
export function assessClaim(input: ClaimInput): Assessment {
  assertValidInput(input);

  const scope = determineScope(input);
  const deadline =
    input.jurisdiction && input.today ? getDeadline(input.jurisdiction, input.flightDate, input.today) : null;

  const base: Assessment = {
    outcome: "not_covered",
    codes: [],
    regime: null,
    regulation: null,
    rulesetVersion: null,
    scopeBasis: null,
    alsoCoveredBy: [],
    distanceKm: null,
    band: null,
    perPassenger: null,
    passengers: input.passengers,
    total: null,
    strength: null,
    strengthRationale: null,
    alternatives: [],
    deadline,
  };

  if (!scope.primary) {
    return { ...base, codes: ["NOT_COVERED"], alternatives: ["MONTREAL_CONVENTION", "REFUND_RIGHTS"] };
  }

  const { ruleset } = scope.primary;
  const distanceKm = flightDistanceKm(input.departure, input.arrival);
  const intraTerritory = isInTerritory(input.departure, ruleset) && isInTerritory(input.arrival, ruleset);
  const band = selectBand(ruleset, distanceKm, intraTerritory);
  const alsoCoveredBy = scope.matches.filter((m) => m !== scope.primary).map((m) => m.regime);

  const covered: Assessment = {
    ...base,
    codes: alsoCoveredBy.length > 0 ? ["ALSO_COVERED_BY_OTHER_REGIME"] : [],
    regime: ruleset.regime,
    regulation: ruleset.regulation,
    rulesetVersion: ruleset.version,
    scopeBasis: scope.primary.basis,
    alsoCoveredBy,
    distanceKm,
    band: band.id,
  };

  const result = entitlement(ruleset, band, input.disruption);
  if (!result.entitled) {
    return { ...covered, outcome: "not_eligible", codes: [result.code, ...covered.codes] };
  }

  const reduced =
    result.reductionDelayMinutes !== null && isWithinReductionLimit(band, result.reductionDelayMinutes);
  const perPassenger = compensationFor(ruleset, band, reduced);

  const strength =
    input.disruption.kind === "denied_boarding"
      ? { strength: "strong" as const, rationale: DENIED_BOARDING_RATIONALE }
      : classifyReason(input.reason);

  return {
    ...covered,
    outcome: "eligible",
    codes: [...result.codes, ...(reduced ? (["REDUCED_ART_7_2"] as const) : []), ...covered.codes],
    perPassenger,
    total: Math.round(perPassenger.amount * input.passengers * 100) / 100,
    strength: strength.strength,
    strengthRationale: strength.rationale,
  };
}
