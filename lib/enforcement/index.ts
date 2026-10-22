import bodiesJson from "../../data/enforcement-bodies.json";
import type { ScopeBasis } from "../rules/scope";
import type { Regime } from "../rules/types";

export interface AdrScheme {
  name: string;
  url: string;
}

export interface EnforcementBody {
  country: string;
  name: string;
  url: string | null;
  adr: AdrScheme[];
  verified: boolean;
}

interface BodiesConfig {
  escalation: Record<Regime, { afterDays: number; note: string }>;
  aliases: Record<string, string>;
  bodies: Record<string, Omit<EnforcementBody, "country">>;
}

const config = bodiesJson as BodiesConfig;

export interface EnforcementInput {
  regime: Regime;
  scopeBasis: ScopeBasis;
  departureCountry: string;
  arrivalCountry: string;
}

/**
 * EU261 Art. 16(1): the body of the state of departure, or of arrival for
 * inbound flights from a third country. UK261: always the UK body.
 * Returns null if we have no entry (the caller shows generic guidance).
 */
export function enforcementBodyFor(input: EnforcementInput, cfg: BodiesConfig = config): EnforcementBody | null {
  const raw =
    input.regime === "UK261"
      ? "GB"
      : input.scopeBasis === "departure"
        ? input.departureCountry
        : input.arrivalCountry;
  const country = cfg.aliases[raw.toUpperCase()] ?? raw.toUpperCase();
  const body = cfg.bodies[country];
  return body ? { country, ...body } : null;
}

export function escalationAfterDays(regime: Regime, cfg: BodiesConfig = config): number {
  return cfg.escalation[regime].afterDays;
}
