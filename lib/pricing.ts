import pricing from "./pricing.json";
import type { Currency } from "./rules/types";

export interface Price {
  amount: number;
  currency: Currency;
}

/** The claim pack price for a claim in `claimCurrency`, in the currency it is charged in. */
export function packPrice(claimCurrency: Currency): Price {
  const p = pricing[claimCurrency];
  return { amount: p.amount, currency: p.currency as Currency };
}
