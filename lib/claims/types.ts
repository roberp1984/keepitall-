import type { CheckAnswers } from "../check/answers";
import type { ClaimPack } from "../letters/pack";
import type { ClaimFacts } from "../letters/types";
import type { Assessment, ClaimInput } from "../rules/eligibility";
import type { Currency, Regime } from "../rules/types";

export type ClaimStatus = "checkout_started" | "paid" | "pack_ready" | "refunded" | "expired";

export type FollowUpId = "reply_check" | "escalate";

export interface StoredPack {
  facts: ClaimFacts;
  pack: ClaimPack;
}

/** What the customer typed after payment (personal data). */
export interface DetailsForm {
  claimantName: string;
  email: string;
  postalAddress: string;
  passengers: string[];
  bookingReference: string;
}

export interface ClaimRecord {
  id: string;
  packToken: string;
  status: ClaimStatus;
  answers: CheckAnswers;
  input: ClaimInput;
  assessment: Assessment;
  regime: Regime;
  rulesetVersion: string;
  currency: Currency;
  totalAmount: number;
  /** Email from the paid order, if any. */
  orderEmail: string | null;
  details: DetailsForm | null;
  pack: StoredPack | null;
  createdAt: string;
  packReadyAt: string | null;
  /** Follow-up id → ISO time it was sent. */
  followUps: Partial<Record<FollowUpId, string>>;
  followUpsOptOut: boolean;
}

export interface PurgeCutoffs {
  /** ISO timestamps: rows older than these are removed. */
  unpaidBefore: string;
  refundedBefore: string;
  packDetailsBefore: string;
}

export interface PurgeResult {
  unpaidDeleted: number;
  refundedDeleted: number;
  packsExpired: number;
}

export interface NewClaim {
  packToken: string;
  answers: CheckAnswers;
  input: ClaimInput;
  assessment: Assessment;
  regime: Regime;
  rulesetVersion: string;
  currency: Currency;
  totalAmount: number;
}

export interface PaidOrder {
  claimId: string;
  providerOrderId: string;
  email: string;
  amountCents: number;
  currency: string;
  testMode: boolean;
}

export interface ClaimStore {
  createClaim(claim: NewClaim): Promise<ClaimRecord>;
  getById(id: string): Promise<ClaimRecord | null>;
  getByPackToken(token: string): Promise<ClaimRecord | null>;
  /** Records the order and marks the claim paid. Returns "duplicate" if the order was already recorded. */
  recordPaidOrder(order: PaidOrder): Promise<"recorded" | "duplicate">;
  /** Marks the order and its claim refunded. Returns false if the order is unknown. */
  recordRefund(providerOrderId: string): Promise<boolean>;
  saveDetailsAndPack(claimId: string, details: DetailsForm, pack: StoredPack): Promise<void>;
  /** Claims with a ready pack, not opted out, ready since before `readyBefore`. */
  listFollowUpCandidates(readyBefore: string): Promise<ClaimRecord[]>;
  markFollowUpSent(claimId: string, id: FollowUpId, at: string): Promise<void>;
  setFollowUpOptOut(packToken: string): Promise<boolean>;
  purge(cutoffs: PurgeCutoffs): Promise<PurgeResult>;
}
