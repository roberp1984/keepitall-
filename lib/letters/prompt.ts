import { formatDate, formatDistance, formatDuration, formatMoney, joinNames } from "./format";
import { articleFor, legalBasis, regulationName } from "./citations";
import config from "./config.json";
import type { ClaimFacts } from "./types";

/**
 * Values the model may only refer to by placeholder. It never sees them, so it
 * cannot change amounts, dates or references — and receives no personal data.
 */
export function placeholderValues(f: ClaimFacts): Record<string, string> {
  const d = f.disruption;
  const values: Record<string, string> = {
    PER_PASSENGER_AMOUNT: formatMoney(f.perPassenger),
    TOTAL_AMOUNT: formatMoney(f.total),
    FLIGHT_NUMBER: f.flightNumber,
    FLIGHT_DATE: formatDate(f.flightDate),
    BOOKING_REFERENCE: f.bookingReference,
    RESPONSE_DEADLINE: formatDate(f.responseDeadline),
    DISTANCE: formatDistance(f.distanceKm),
    PASSENGER_NAMES: joinNames(f.passengers),
    CLAIMANT_EMAIL: f.claimant.email,
  };
  if (d.kind === "delay") values.ARRIVAL_DELAY = formatDuration(d.arrivalDelayMinutes);
  if (d.kind !== "delay" && d.rerouting) values.ARRIVAL_DELAY = formatDuration(Math.max(0, d.rerouting.arrivalDelayMinutes));
  if (d.kind === "cancellation") {
    values.NOTICE = d.noticeDays === 0 ? "on the day of departure" : `${d.noticeDays} day${d.noticeDays === 1 ? "" : "s"} before departure`;
  }
  return values;
}

export const REQUIRED_PLACEHOLDERS = [
  "TOTAL_AMOUNT",
  "FLIGHT_NUMBER",
  "FLIGHT_DATE",
  "BOOKING_REFERENCE",
  "RESPONSE_DEADLINE",
] as const;

export const SYSTEM_PROMPT = `You draft compensation claim letters that air passengers send to airlines themselves.

Write the body of the letter: firm, polite and concise, in plain British English. Cite the regulation and articles you are given. State the amount owed, give the airline ${config.responseDays} days to respond, and ask for payment by bank transfer, explicitly declining travel vouchers.

The facts you receive are final and have already been checked. Do not add facts, do not speculate, and do not change any legal assessment.

Never write any amount of money, date, duration, distance, flight number, booking reference, name or email address yourself. Refer to each one only by its placeholder in double curly braces, exactly as listed, for example {{TOTAL_AMOUNT}}. These placeholders must each appear at least once: {{TOTAL_AMOUNT}}, {{FLIGHT_NUMBER}}, {{FLIGHT_DATE}}, {{BOOKING_REFERENCE}}, {{RESPONSE_DEADLINE}}.

Output only the body paragraphs as plain text separated by blank lines. No subject line, no greeting, no sign-off, no headings, no markdown.`;

const DISRUPTION_FACTS: Record<ClaimFacts["disruption"]["kind"], (f: ClaimFacts) => string> = {
  delay: () => "The flight arrived {{ARRIVAL_DELAY}} after its scheduled arrival time.",
  cancellation: (f) =>
    f.disruption.kind === "cancellation" && f.disruption.rerouting
      ? "The flight was cancelled; the passenger was told {{NOTICE}}. They were rerouted and arrived {{ARRIVAL_DELAY}} after the original scheduled arrival time."
      : "The flight was cancelled; the passenger was told {{NOTICE}}. They were not rerouted.",
  denied_boarding: (f) =>
    f.disruption.kind === "denied_boarding" && f.disruption.rerouting
      ? "The passenger was denied boarding against their will. They were rerouted and arrived {{ARRIVAL_DELAY}} after the original scheduled arrival time."
      : "The passenger was denied boarding against their will.",
};

const REASON_TEXT: Record<ClaimFacts["reason"], string> = {
  technical: "a technical problem",
  crew: "crew or staffing problems",
  strike_airline_staff: "a strike by the airline's own staff",
  none: "no reason",
  knock_on: "a delay to an earlier flight",
  strike_unknown: "a strike",
  other: "another reason",
  weather: "weather",
  atc: "air traffic control restrictions",
  security: "a security issue",
  strike_third_party: "a strike by third parties",
  bird_strike: "a bird strike",
  medical_emergency: "a medical emergency on board",
};

/** The user turn: facts with placeholders only — no personal data. */
export function buildPrompt(f: ClaimFacts): string {
  const lines = [
    `Regulation: ${regulationName(f.regime)}`,
    `Legal basis (cite this): ${legalBasis(f)}`,
    `Compensation article: Article ${articleFor(f)}${f.reduced ? ", reduced by 50% under Article 7(2)" : ""}`,
    `Airline: ${f.airline.name}`,
    `Flight: {{FLIGHT_NUMBER}} on {{FLIGHT_DATE}}, booking reference {{BOOKING_REFERENCE}}`,
    `Route: ${f.departure.name} (${f.departure.iata}) to ${f.arrival.name} (${f.arrival.iata}), great-circle distance {{DISTANCE}}`,
    `What happened: ${DISRUPTION_FACTS[f.disruption.kind](f)}`,
    `Reason given by the airline: ${REASON_TEXT[f.reason]}`,
    `Passengers claiming: {{PASSENGER_NAMES}}${f.passengers.length > 1 ? " (several passengers on one booking)" : ""}`,
    `Compensation per passenger: {{PER_PASSENGER_AMOUNT}}`,
    `Total compensation claimed: {{TOTAL_AMOUNT}}`,
    `Reply deadline: {{RESPONSE_DEADLINE}}`,
    `Reply to: {{CLAIMANT_EMAIL}}`,
  ];
  return `Draft the letter body from these facts.\n\n${lines.join("\n")}`;
}
