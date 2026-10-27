import deadlinesJson from "./config/deadlines.json";
import jurisdictionsJson from "./config/jurisdictions.json";
import extraordinaryJson from "./config/extraordinary.json";
import regionsJson from "./config/regions.json";
import rulesetsJson from "./config/rulesets.json";
import type { CaseStrength, Regime, Ruleset } from "./types";

export interface RegionsConfig {
  groups: Record<string, string[]>;
  excludedAirports: Record<string, string>;
}

export interface ReasonConfig {
  strength: CaseStrength;
  rationale: string;
  refs: string[];
}

export interface DeadlineEntry {
  name: string;
  years: number;
  startsFrom: "flight_date" | "end_of_year";
  verified: boolean;
  source: string | null;
  /** Strength of the sources found (research aid only; display depends on `verified`). */
  confidence?: "high" | "medium" | "low";
  /** The passenger must also notify the airline within this many months of the flight. */
  noticeMonths?: number;
  notes: string;
}

export interface JurisdictionsConfig {
  gbDefault: string;
  gbAirports: Record<string, string[]>;
}

export interface DeadlinesConfig {
  warnWithinDays: number;
  jurisdictions: Record<string, DeadlineEntry>;
}

export const regions: RegionsConfig = regionsJson;
export const rulesets = rulesetsJson.rulesets as Ruleset[];
export const reasons = extraordinaryJson.reasons as Record<string, ReasonConfig>;
export const deadlines = deadlinesJson as DeadlinesConfig;
export const jurisdictions: JurisdictionsConfig = jurisdictionsJson;

export function countriesFor(groupNames: string[], config: RegionsConfig = regions): Set<string> {
  const countries = new Set<string>();
  for (const name of groupNames) {
    const group = config.groups[name];
    if (!group) throw new Error(`Unknown region group: ${name}`);
    for (const country of group) countries.add(country);
  }
  return countries;
}

/** The ruleset of a regime in force on a given flight date, or null if none. */
export function rulesetFor(
  regime: Regime,
  flightDate: string,
  all: Ruleset[] = rulesets,
): Ruleset | null {
  return (
    all.find(
      (r) =>
        r.regime === regime &&
        r.effectiveFrom <= flightDate &&
        (r.effectiveTo === null || flightDate <= r.effectiveTo),
    ) ?? null
  );
}
