import { deadlines as defaultDeadlines, type DeadlinesConfig } from "./config";
import { addYears, daysBetween, parseIsoDate } from "./dates";

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
  };
}

/** Only verified deadlines may ever be displayed. */
export function isDisplayable(
  info: DeadlineInfo | null,
): info is Extract<DeadlineInfo, { status: "verified" }> {
  return info?.status === "verified";
}
