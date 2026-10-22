import type { BandId, Regime } from "../rules/types";
import type { ClaimFacts } from "./types";

const ARTICLE_7_1: Record<BandId, string> = { short: "7(1)(a)", medium: "7(1)(b)", long: "7(1)(c)" };

export function articleFor(facts: Pick<ClaimFacts, "band">): string {
  return ARTICLE_7_1[facts.band];
}

export function regulationName(regime: Regime): string {
  return regime === "UK261"
    ? "Regulation (EC) No 261/2004 as retained in UK law (UK261)"
    : "Regulation (EC) No 261/2004 (EU261)";
}

/** The legal basis paragraph — deterministic, never model-written. */
export function legalBasis(facts: ClaimFacts): string {
  const article = articleFor(facts);
  switch (facts.disruption.kind) {
    case "delay":
      return `Under Articles 6 and 7 of ${regulationName(facts.regime)}, as interpreted by the Court of Justice of the European Union in Sturgeon (C-402/07 and C-432/07) and Nelson (C-581/10 and C-629/10), passengers whose flight arrives three hours or more late are entitled to compensation under Article ${article}.`;
    case "cancellation":
      return `Under Articles 5(1)(c) and 7 of ${regulationName(facts.regime)}, passengers whose flight is cancelled with less than 14 days' notice, and who are not rerouted within the times set out in Article 5(1)(c), are entitled to compensation under Article ${article}.`;
    case "denied_boarding":
      return `Under Articles 4(3) and 7 of ${regulationName(facts.regime)}, passengers denied boarding against their will are entitled to compensation under Article ${article}.`;
  }
}

export const EXTRAORDINARY_PARAGRAPH =
  "Under Article 5(3), the airline is only exempt if it proves that the disruption was caused by extraordinary circumstances which could not have been avoided even if all reasonable measures had been taken. Technical problems and staffing issues are generally not such circumstances (Wallentin-Hermann, C-549/07). If you consider that extraordinary circumstances apply, please provide full details and evidence.";

export const PAYMENT_PARAGRAPH_SUFFIX =
  "Under Article 7(3), compensation must be paid in cash, by electronic bank transfer, bank order or cheque. I do not agree to payment in travel vouchers.";
