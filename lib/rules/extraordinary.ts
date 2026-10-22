import { reasons as defaultReasons, type ReasonConfig } from "./config";
import type { CaseStrength } from "./types";

export const REASON_CODES = [
  "technical",
  "crew",
  "strike_airline_staff",
  "none",
  "knock_on",
  "strike_unknown",
  "other",
  "weather",
  "atc",
  "security",
  "strike_third_party",
  "bird_strike",
  "medical_emergency",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export interface ReasonAssessment extends ReasonConfig {
  reason: ReasonCode;
}

export function isReasonCode(value: string): value is ReasonCode {
  return (REASON_CODES as readonly string[]).includes(value);
}

/** Classifies the airline's stated reason into a case strength. */
export function classifyReason(
  reason: ReasonCode,
  table: Record<string, ReasonConfig> = defaultReasons,
): ReasonAssessment {
  const entry = table[reason];
  if (!entry) throw new Error(`No extraordinary-circumstances entry for reason: ${reason}`);
  return { reason, ...entry };
}

/** UI-facing label for the result screen (strong / possible / unlikely). */
export type StrengthLabel = "strong" | "possible" | "unlikely";

const STRENGTH_LABELS: Record<CaseStrength, StrengthLabel> = {
  strong: "strong",
  disputed: "possible",
  weak: "unlikely",
};

export function strengthLabel(strength: CaseStrength): StrengthLabel {
  return STRENGTH_LABELS[strength];
}
