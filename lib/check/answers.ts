import { isIsoDate } from "../rules/dates";
import { isReasonCode, type ReasonCode } from "../rules/extraordinary";

export type DisruptionKind = "delay" | "cancellation" | "denied_boarding";
export type CarrierRegion = "eu" | "eea_ch" | "uk" | "other";

export type CarrierChoice = { kind: "airline"; slug: string } | { kind: "region"; region: CarrierRegion };

/** Everything the checker wizard collects. No personal data. */
export interface CheckAnswers {
  from: string;
  to: string;
  carrier: CarrierChoice;
  flightNumber: string;
  /** YYYY-MM-DD */
  date: string;
  what: DisruptionKind;
  delayMinutes?: number;
  noticeDays?: number;
  rerouted?: boolean;
  reroutedDelayMinutes?: number;
  reroutedEarlierMinutes?: number;
  volunteered?: boolean;
  reason: ReasonCode;
  passengers: number;
}

export type DraftAnswers = Partial<CheckAnswers>;

export const MAX_PASSENGERS = 9;
const IATA = /^[A-Z]{3}$/;
const FLIGHT_NUMBER = /^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/i;
const SLUG = /^[a-z0-9-]+$/;
const REGIONS: CarrierRegion[] = ["eu", "eea_ch", "uk", "other"];
const KINDS: DisruptionKind[] = ["delay", "cancellation", "denied_boarding"];

const isMinutes = (v: unknown, min = 0): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= 7 * 24 * 60;

export function isValidFlightNumber(value: string): boolean {
  return FLIGHT_NUMBER.test(value.trim());
}

function parseCarrier(value: unknown): CarrierChoice | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.kind === "airline" && typeof v.slug === "string" && SLUG.test(v.slug)) return { kind: "airline", slug: v.slug };
  if (v.kind === "region" && REGIONS.includes(v.region as CarrierRegion)) return { kind: "region", region: v.region as CarrierRegion };
  return null;
}

/** Strictly validates untrusted input (e.g. a decoded URL token) into complete answers. */
export function parseAnswers(value: unknown): CheckAnswers | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const carrier = parseCarrier(v.carrier);
  if (
    typeof v.from !== "string" || !IATA.test(v.from) ||
    typeof v.to !== "string" || !IATA.test(v.to) || v.from === v.to ||
    !carrier ||
    typeof v.flightNumber !== "string" || !isValidFlightNumber(v.flightNumber) ||
    typeof v.date !== "string" || !isIsoDate(v.date) ||
    !KINDS.includes(v.what as DisruptionKind) ||
    typeof v.reason !== "string" || !isReasonCode(v.reason) ||
    typeof v.passengers !== "number" || !Number.isInteger(v.passengers) || v.passengers < 1 || v.passengers > MAX_PASSENGERS
  ) {
    return null;
  }

  const answers: CheckAnswers = {
    from: v.from,
    to: v.to,
    carrier,
    flightNumber: v.flightNumber.trim().toUpperCase(),
    date: v.date,
    what: v.what as DisruptionKind,
    reason: v.reason,
    passengers: v.passengers,
  };

  if (answers.what === "delay") {
    if (!isMinutes(v.delayMinutes)) return null;
    answers.delayMinutes = v.delayMinutes;
    return answers;
  }

  if (answers.what === "cancellation") {
    if (typeof v.noticeDays !== "number" || !Number.isInteger(v.noticeDays) || v.noticeDays < 0 || v.noticeDays > 365) return null;
    answers.noticeDays = v.noticeDays;
  } else {
    if (typeof v.volunteered !== "boolean") return null;
    answers.volunteered = v.volunteered;
  }

  if (typeof v.rerouted !== "boolean") return null;
  answers.rerouted = v.rerouted;
  if (v.rerouted) {
    if (!isMinutes(v.reroutedDelayMinutes)) return null;
    answers.reroutedDelayMinutes = v.reroutedDelayMinutes;
    if (answers.what === "cancellation") {
      if (!isMinutes(v.reroutedEarlierMinutes ?? 0)) return null;
      answers.reroutedEarlierMinutes = (v.reroutedEarlierMinutes as number | undefined) ?? 0;
    }
  }
  return answers;
}
