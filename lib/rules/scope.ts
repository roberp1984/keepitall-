import { countriesFor, regions as defaultRegions, rulesetFor, type RegionsConfig } from "./config";
import type { AirportLocation, Regime, Ruleset } from "./types";

export type ScopeBasis = "departure" | "arrival_on_qualifying_carrier";

export interface RegimeMatch {
  regime: Regime;
  ruleset: Ruleset;
  basis: ScopeBasis;
}

export interface ScopeInput {
  departure: AirportLocation;
  arrival: AirportLocation;
  /** Country (ISO alpha-2) that licensed the OPERATING carrier. */
  operatingCarrierCountry: string;
  /** Scheduled departure date, YYYY-MM-DD. */
  flightDate: string;
  /**
   * Art. 3(1)(b): inbound cover does not apply if the passenger already received
   * benefits/compensation and assistance under the third country's law.
   */
  receivedBenefitsInThirdCountry?: boolean;
}

export interface ScopeResult {
  covered: boolean;
  /** The regime to claim under. Departure-based cover takes precedence. */
  primary: RegimeMatch | null;
  /** All regimes that apply (a flight can be covered by both EU261 and UK261). */
  matches: RegimeMatch[];
}

const REGIMES: Regime[] = ["EU261", "UK261"];

export function isInTerritory(
  airport: AirportLocation,
  ruleset: Ruleset,
  config: RegionsConfig = defaultRegions,
): boolean {
  if (airport.iata.toUpperCase() in config.excludedAirports) return false;
  return countriesFor(ruleset.territory, config).has(airport.country.toUpperCase());
}

export function isQualifyingCarrier(
  carrierCountry: string,
  ruleset: Ruleset,
  config: RegionsConfig = defaultRegions,
): boolean {
  return countriesFor(ruleset.inboundCarrierGroups, config).has(carrierCountry.toUpperCase());
}

export function matchRegime(
  input: ScopeInput,
  ruleset: Ruleset,
  config: RegionsConfig = defaultRegions,
): RegimeMatch | null {
  if (isInTerritory(input.departure, ruleset, config)) {
    return { regime: ruleset.regime, ruleset, basis: "departure" };
  }
  if (
    isInTerritory(input.arrival, ruleset, config) &&
    isQualifyingCarrier(input.operatingCarrierCountry, ruleset, config) &&
    !input.receivedBenefitsInThirdCountry
  ) {
    return { regime: ruleset.regime, ruleset, basis: "arrival_on_qualifying_carrier" };
  }
  return null;
}

export function determineScope(
  input: ScopeInput,
  all?: Ruleset[],
  config: RegionsConfig = defaultRegions,
): ScopeResult {
  const matches: RegimeMatch[] = [];
  for (const regime of REGIMES) {
    const ruleset = rulesetFor(regime, input.flightDate, all);
    if (!ruleset) continue;
    const match = matchRegime(input, ruleset, config);
    if (match) matches.push(match);
  }
  const primary = matches.find((m) => m.basis === "departure") ?? matches[0] ?? null;
  return { covered: matches.length > 0, primary, matches };
}
