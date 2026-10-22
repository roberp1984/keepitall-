import { formatMoney } from "./letters/format";
import pricing from "./pricing.json";
import { rulesetFor } from "./rules/config";
import type { Currency } from "./rules/types";

/** Typical claim-company commission range (CLAUDE.md positioning). */
export const CLAIM_COMPANY_FEE = { min: 0.25, max: 0.35 };

export function feeComparison(amount: number, currency: Currency) {
  const fee = Math.round(amount * CLAIM_COMPANY_FEE.max);
  return {
    compensation: formatMoney({ amount, currency }),
    claimCompanyFee: formatMoney({ amount: fee, currency }),
    claimCompanyKeeps: formatMoney({ amount: amount - fee, currency }),
    ourPrice: formatMoney({ amount: pricing[currency], currency }),
    youKeep: formatMoney({ amount: amount - pricing[currency], currency }),
    feePercent: `${Math.round(CLAIM_COMPANY_FEE.max * 100)}%`,
  };
}

const BAND_LABELS = { short: "Up to 1,500 km", medium: "1,500 – 3,500 km", long: "Over 3,500 km" } as const;

/** Compensation table for marketing pages, read from the rulesets in force on `date`. */
export function compensationTable(date: string) {
  const eu = rulesetFor("EU261", date);
  const uk = rulesetFor("UK261", date);
  if (!eu || !uk) return [];
  return eu.bands.map((band, i) => ({
    distance: BAND_LABELS[band.id],
    example: { short: "e.g. London – Paris", medium: "e.g. London – Athens", long: "e.g. London – New York" }[band.id],
    eu: formatMoney({ amount: band.amount, currency: eu.currency }),
    uk: formatMoney({ amount: uk.bands[i]!.amount, currency: uk.currency }),
  }));
}

export function maxCompensation(date: string): string {
  const eu = rulesetFor("EU261", date);
  return eu ? formatMoney({ amount: Math.max(...eu.bands.map((b) => b.amount)), currency: eu.currency }) : "";
}
