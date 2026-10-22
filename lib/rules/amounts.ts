import type { Band, Currency, Ruleset } from "./types";

export interface Compensation {
  currency: Currency;
  band: Band["id"];
  /** Art. 7(1) amount before any reduction. */
  fullAmount: number;
  /** Amount per passenger after any Art. 7(2) reduction. */
  amount: number;
  reduced: boolean;
}

/** Picks the Art. 7(1) distance band. Bounds are inclusive ("1500 km or less"). */
export function selectBand(ruleset: Ruleset, distanceKm: number, intraTerritory: boolean): Band {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError(`Invalid distance: ${distanceKm}`);
  }
  const override = ruleset.intraTerritoryOverride;
  if (intraTerritory && distanceKm > override.aboveKm) {
    return bandById(ruleset, override.band);
  }
  const band = ruleset.bands.find((b) => b.maxKm === null || distanceKm <= b.maxKm);
  if (!band) throw new Error(`No band covers ${distanceKm} km in ${ruleset.version}`);
  return band;
}

export function bandById(ruleset: Ruleset, id: Band["id"]): Band {
  const band = ruleset.bands.find((b) => b.id === id);
  if (!band) throw new Error(`Band ${id} missing from ${ruleset.version}`);
  return band;
}

/** Art. 7(2): arrival delay within the band's limit allows a 50% reduction. */
export function isWithinReductionLimit(band: Band, arrivalDelayMinutes: number): boolean {
  return arrivalDelayMinutes <= band.rerouteReductionLimitMinutes;
}

export function compensationFor(ruleset: Ruleset, band: Band, reduced: boolean): Compensation {
  const factor = reduced ? (100 - ruleset.reductionPercent) / 100 : 1;
  return {
    currency: ruleset.currency,
    band: band.id,
    fullAmount: band.amount,
    amount: Math.round(band.amount * factor * 100) / 100,
    reduced,
  };
}
