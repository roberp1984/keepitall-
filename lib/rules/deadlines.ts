import { deadlines as defaultDeadlines, jurisdictions as defaultJurisdictions, type DeadlinesConfig, type JurisdictionsConfig } from "./config";
import { addMonths, addYears, daysBetween, parseIsoDate } from "./dates";

export type DeadlineInfo =
  | { status: "unknown_jurisdiction"; jurisdiction: string }
  /** Exists in the table but not yet checked by a human: must NOT be shown. */
  | { status: "unverified"; jurisdiction: string }
  | {
      status: "verified";
      jurisdiction: string;
      name: string;
      /** Last day a claim can be brought, YYYY-MM-DD. */
      deadline: string;
      daysRemaining: number;
      expired: boolean;
      /** Deadline is close enough that the UI should warn. */
      warn: boolean;
      /** The airline must also be notified by this date (YYYY-MM-DD), e.g. Sweden. */
      notice?: { by: string; months: number; passed: boolean };
    };

export function getDeadline(
  jurisdiction: string,
  flightDate: string,
  today: string,
  config: DeadlinesConfig = defaultDeadlines,
): DeadlineInfo {
  const entry = config.jurisdictions[jurisdiction];
  if (!entry) return { status: "unknown_jurisdiction", jurisdiction };
  if (!entry.verified) return { status: "unverified", jurisdiction };

  const start =
    entry.startsFrom === "end_of_year"
      ? `${parseIsoDate(flightDate).getUTCFullYear()}-12-31`
      : flightDate;
  const deadline = addYears(start, entry.years);
  const daysRemaining = daysBetween(today, deadline);
  return {
    status: "verified",
    jurisdiction,
    name: entry.name,
    deadline,
    daysRemaining,
    expired: daysRemaining < 0,
    warn: daysRemaining <= config.warnWithinDays,
    ...(entry.noticeMonths
      ? (() => {
          const by = addMonths(flightDate, entry.noticeMonths);
          return { notice: { by, months: entry.noticeMonths, passed: daysBetween(today, by) < 0 } };
        })()
      : {}),
  };
}

/** The deadlines.json key for an airport: its country, or the UK nation for UK airports. */
export function jurisdictionForAirport(
  airport: { iata: string; country: string },
  table: JurisdictionsConfig = defaultJurisdictions,
): string {
  if (airport.country !== "GB") return airport.country;
  for (const [key, codes] of Object.entries(table.gbAirports)) if (codes.includes(airport.iata)) return key;
  return table.gbDefault;
}

/**
 * Claims can be brought where the flight departed or arrived. Prefer the first of those
 * with a verified limitation period (departure first), then the first one we know at all.
 */
export function pickJurisdiction(
  airports: { iata: string; country: string }[],
  config: DeadlinesConfig = defaultDeadlines,
  table: JurisdictionsConfig = defaultJurisdictions,
): string | undefined {
  const keys = airports.map((a) => jurisdictionForAirport(a, table));
  return keys.find((k) => config.jurisdictions[k]?.verified) ?? keys.find((k) => k in config.jurisdictions);
}

/** Only verified deadlines may ever be displayed. */
export function isDisplayable(
  info: DeadlineInfo | null,
): info is Extract<DeadlineInfo, { status: "verified" }> {
  return info?.status === "verified";
}
