import { getAirline } from "../airlines";
import type { CheckAnswers } from "../check/answers";
import { packReadyEmail, paymentConfirmedEmail, type EmailSender } from "../email";
import type { TextGenerator } from "../letters/draft";
import { buildClaimFacts, ClaimFactsError } from "../letters/facts";
import { buildClaimPack } from "../letters/pack";
import type { ClaimFacts } from "../letters/types";
import type { ClaimPack } from "../letters/pack";
import { assessClaim, type ClaimInput } from "../rules/eligibility";
import { generatePackToken } from "./token";
import type { ClaimRecord, ClaimStore, DetailsForm } from "./types";

export interface ServiceDeps {
  store: ClaimStore;
  email: EmailSender;
  siteUrl: string;
  generate?: TextGenerator;
  renderPdf?: (facts: ClaimFacts, pack: ClaimPack) => Promise<Buffer>;
  /** Server-side analytics; never pass personal data. */
  track?: (event: "payment_succeeded", properties: Record<string, string | number | boolean>) => Promise<void>;
  /** YYYY-MM-DD; injected for tests. */
  today?: () => string;
  log?: (message: string, extra?: Record<string, unknown>) => void;
}

export const packUrl = (siteUrl: string, token: string) => `${siteUrl}/pack/${token}`;
const isoToday = () => new Date().toISOString().slice(0, 10);

export class CheckoutNotAllowedError extends Error {
  override name = "CheckoutNotAllowedError";
}

/**
 * Re-assesses the answers server-side and stores the claim before checkout.
 * Only eligible claims can be paid for — the client's result is never trusted.
 */
export async function createClaimForCheckout(store: ClaimStore, answers: CheckAnswers, input: ClaimInput): Promise<ClaimRecord> {
  const assessment = assessClaim(input);
  if (assessment.outcome !== "eligible" || !assessment.regime || !assessment.rulesetVersion || !assessment.perPassenger || assessment.total === null) {
    throw new CheckoutNotAllowedError("Only eligible claims can be purchased");
  }
  return store.createClaim({
    packToken: generatePackToken(),
    answers,
    input,
    assessment,
    regime: assessment.regime,
    rulesetVersion: assessment.rulesetVersion,
    currency: assessment.perPassenger.currency,
    totalAmount: assessment.total,
  });
}

export type PaymentResult = "recorded" | "duplicate" | "unknown_claim";

/** Webhook: the single source of truth for "paid". Idempotent per provider order id. */
export async function handleOrderPaid(
  deps: ServiceDeps,
  order: { claimId: string; orderId: string; email: string; amountCents: number; currency: string; testMode: boolean },
): Promise<PaymentResult> {
  const claim = await deps.store.getById(order.claimId);
  if (!claim) return "unknown_claim";
  if (order.currency && order.currency !== claim.currency) {
    deps.log?.("order currency differs from claim currency", { claimId: claim.id, order: order.currency, claim: claim.currency });
  }
  const result = await deps.store.recordPaidOrder({
    claimId: claim.id,
    providerOrderId: order.orderId,
    email: order.email,
    amountCents: order.amountCents,
    currency: order.currency,
    testMode: order.testMode,
  });
  if (result === "recorded") {
    await deps.track?.("payment_succeeded", { regime: claim.regime, currency: claim.currency, test_mode: order.testMode });
    try {
      await deps.email.send(paymentConfirmedEmail(order.email, packUrl(deps.siteUrl, claim.packToken)));
    } catch (err) {
      // Payment is recorded; the customer also lands on the pack page after checkout.
      deps.log?.("payment confirmation email failed", { claimId: claim.id, error: (err as Error).message });
    }
  }
  return result;
}

export async function handleOrderRefunded(deps: ServiceDeps, orderId: string): Promise<boolean> {
  return deps.store.recordRefund(orderId);
}

export type DetailsResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "not_paid" | "already_complete" | "invalid"; message: string };

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

/** After payment: validates details, builds the pack once, stores it and emails it. */
export async function submitDetails(deps: ServiceDeps, packToken: string, form: DetailsForm): Promise<DetailsResult> {
  const claim = await deps.store.getByPackToken(packToken);
  if (!claim) return { ok: false, error: "not_found", message: "We couldn't find this claim." };
  if (claim.status === "pack_ready") return { ok: false, error: "already_complete", message: "Your claim pack is already ready." };
  if (claim.status !== "paid") return { ok: false, error: "not_paid", message: "We haven't received your payment confirmation yet." };

  const details: DetailsForm = {
    claimantName: clean(form.claimantName),
    email: form.email.trim(),
    postalAddress: form.postalAddress.trim().replace(/\r\n/g, "\n"),
    passengers: form.passengers.map(clean),
    bookingReference: form.bookingReference.trim().toUpperCase(),
  };
  // The form asks for the claimant (passenger 1) and the other passengers separately.
  const passengers = [details.claimantName, ...details.passengers.filter(Boolean)];

  const airline = claim.answers.carrier.kind === "airline" ? getAirline(claim.answers.carrier.slug) : undefined;
  let facts: ClaimFacts;
  try {
    facts = buildClaimFacts(claim.input, claim.assessment, {
      airline: airline ?? { name: "Customer Relations" },
      flightNumber: claim.answers.flightNumber,
      bookingReference: details.bookingReference,
      passengers,
      claimant: { fullName: details.claimantName, email: details.email, postalAddress: details.postalAddress },
      today: (deps.today ?? isoToday)(),
    });
  } catch (err) {
    if (err instanceof ClaimFactsError) return { ok: false, error: "invalid", message: err.message };
    throw err;
  }

  const pack = await buildClaimPack(facts, {
    scopeBasis: claim.assessment.scopeBasis ?? "departure",
    airline,
    generate: deps.generate,
  });
  if (pack.claimLetter.source === "template" && pack.claimLetter.fallbackReason) {
    deps.log?.("claim letter used template", { claimId: claim.id, reason: pack.claimLetter.fallbackReason });
  }
  await deps.store.saveDetailsAndPack(claim.id, { ...details, passengers }, { facts, pack });

  try {
    const pdf = deps.renderPdf ? await deps.renderPdf(facts, pack) : undefined;
    await deps.email.send(packReadyEmail(details.email, packUrl(deps.siteUrl, claim.packToken), facts.flightNumber, pdf));
  } catch (err) {
    deps.log?.("pack email failed", { claimId: claim.id, error: (err as Error).message });
  }
  return { ok: true };
}
