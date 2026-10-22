import { DISCLAIMER } from "../legal";
import { formatDate, formatDistance, formatMoney } from "../letters/format";
import pricing from "../pricing.json";
import { rulesets } from "../rules/config";
import { isDisplayable } from "../rules/deadlines";
import type { Assessment, OutcomeCode } from "../rules/eligibility";
import { strengthLabel, type StrengthLabel } from "../rules/extraordinary";
import type { Currency, Regime, Ruleset } from "../rules/types";

export interface ResultContext {
  airlineName: string;
  fromLabel: string;
  toLabel: string;
  /** YYYY-MM-DD */
  flightDate: string;
}

export interface ResultView {
  status: Assessment["outcome"];
  headline: string;
  summary: string;
  regime: Regime | null;
  coverage: string | null;
  perPassenger: string | null;
  total: string | null;
  passengers: number;
  distance: string | null;
  strength: { label: StrengthLabel; title: string; rationale: string } | null;
  notes: string[];
  deadline: { text: string; warn: boolean } | null;
  pack: { price: string; currency: Currency } | null;
  alternatives: { title: string; text: string }[];
  disclaimer: string;
}

const STRENGTH_TITLES: Record<StrengthLabel, string> = {
  strong: "Strong case",
  possible: "Possible case",
  unlikely: "Hard to win",
};

const REGION_NAME: Record<Regime, string> = { EU261: "the EU, Iceland, Norway or Switzerland", UK261: "the UK" };

function hours(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} hours` : `${(minutes / 60).toFixed(1)} hours`;
}

function noteFor(code: OutcomeCode, a: Assessment, ruleset: Ruleset | undefined): string | null {
  switch (code) {
    case "DELAY_BELOW_THRESHOLD":
      return `Compensation for delays starts when you reach your final destination ${hours(ruleset?.delay.minArrivalDelayMinutes ?? 180)} or more late.`;
    case "CANCELLATION_NOTICE_SUFFICIENT":
      return `Airlines don't owe compensation if they tell you about a cancellation ${ruleset?.cancellation.noCompensationIfNoticeDaysAtLeast ?? 14} days or more before departure. You are still entitled to a refund or a replacement flight.`;
    case "CANCELLATION_REROUTING_EXEMPT":
      return "Your replacement flight left and arrived close enough to your original times that the airline doesn't owe compensation. You are still entitled to a refund or rerouting.";
    case "DENIED_BOARDING_VOLUNTARY":
      return "If you volunteered to give up your seat, you get whatever you agreed with the airline in exchange, not fixed compensation.";
    case "REDUCED_ART_7_2":
      return "The amount is halved because you still arrived close to your original arrival time (Article 7(2)).";
    case "ALSO_COVERED_BY_OTHER_REGIME":
      return a.regime && a.alsoCoveredBy.length > 0
        ? `This flight is also covered by ${a.alsoCoveredBy.join(" and ")}. You can only claim once, so we've used ${a.regime}.`
        : null;
    case "REROUTED_DEPARTURE_TIME_ASSUMED":
      return "We assumed your replacement flight didn't leave earlier than your original flight. If it left much earlier, you may be owed more.";
    case "NOT_COVERED":
      return null;
  }
}

const ALTERNATIVES = {
  MONTREAL_CONVENTION: {
    title: "Montreal Convention",
    text: "Most international flights are covered by the Montreal Convention. It doesn't give fixed compensation, but you may be able to claim back proven costs caused by the delay, such as meals, hotels or missed connections.",
  },
  REFUND_RIGHTS: {
    title: "Refunds and the airline's own terms",
    text: "If your flight was cancelled, you may still be entitled to a refund under the airline's conditions of carriage or local consumer law. Check the airline's website.",
  },
} as const;

/** Turns a deterministic assessment into result-screen copy. Never promises an outcome. */
export function presentAssessment(a: Assessment, ctx: ResultContext): ResultView {
  const ruleset = rulesets.find((r) => r.version === a.rulesetVersion);
  const route = `${ctx.fromLabel} to ${ctx.toLabel} with ${ctx.airlineName} on ${formatDate(ctx.flightDate)}`;
  const base: ResultView = {
    status: a.outcome,
    headline: "",
    summary: route,
    regime: a.regime,
    coverage: null,
    perPassenger: null,
    total: null,
    passengers: a.passengers,
    distance: a.distanceKm === null ? null : formatDistance(a.distanceKm),
    strength: null,
    notes: a.codes.map((c) => noteFor(c, a, ruleset)).filter((n): n is string => n !== null),
    deadline: isDisplayable(a.deadline)
      ? {
          text: a.deadline.expired
            ? `The time limit to claim in ${a.deadline.name} may have passed (${formatDate(a.deadline.deadline)}).`
            : `You have until ${formatDate(a.deadline.deadline)} to bring a claim in ${a.deadline.name}.`,
          warn: a.deadline.warn || a.deadline.expired,
        }
      : null,
    pack: null,
    alternatives: a.alternatives.map((k) => ALTERNATIVES[k]),
    disclaimer: DISCLAIMER,
  };

  if (a.outcome === "not_covered") {
    return {
      ...base,
      headline: "This flight isn't covered by EU261 or UK261",
      summary: `${route}. These rules cover flights leaving the EU or UK, and flights into them on an EU or UK airline.`,
    };
  }

  const coverage =
    a.regime && a.scopeBasis === "departure"
      ? `Covered by ${a.regime} because your flight left from ${REGION_NAME[a.regime]}.`
      : a.regime
        ? `Covered by ${a.regime} because you flew into ${REGION_NAME[a.regime]} on an airline based there.`
        : null;

  if (a.outcome === "not_eligible" || !a.perPassenger || a.total === null) {
    return { ...base, coverage, headline: "Based on your answers, compensation is unlikely to be due" };
  }

  const per = formatMoney(a.perPassenger);
  const label = a.strength ? strengthLabel(a.strength) : null;
  return {
    ...base,
    coverage,
    headline: `You may be entitled to ${per} per passenger`,
    perPassenger: per,
    total: formatMoney({ amount: a.total, currency: a.perPassenger.currency }),
    strength: label && a.strengthRationale ? { label, title: STRENGTH_TITLES[label], rationale: a.strengthRationale } : null,
    pack: { price: formatMoney({ amount: pricing[a.perPassenger.currency], currency: a.perPassenger.currency }), currency: a.perPassenger.currency },
  };
}
