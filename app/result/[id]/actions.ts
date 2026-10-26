"use server";

import { redirect } from "next/navigation";
import { toClaimInput } from "@/lib/check/claim-input";
import { decodeAnswers } from "@/lib/check/token";
import { CheckoutNotAllowedError, createClaimForCheckout, packUrl } from "@/lib/claims/service";
import { paymentsConfig, siteUrl } from "@/lib/env";
import { createCheckoutUrl } from "@/lib/payments/stripe";
import { serviceDeps } from "@/lib/server/deps";

export interface CheckoutState {
  error: string | null;
}

export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const payments = paymentsConfig();
  if (!payments) return { error: "Checkout isn't available yet." };

  const token = String(formData.get("token") ?? "");
  const answers = decodeAnswers(token);
  const input = answers && toClaimInput(answers, new Date().toISOString().slice(0, 10));
  if (!answers || !input) return { error: "Something is wrong with this result. Please run the check again." };

  let url: string;
  try {
    const claim = await createClaimForCheckout(serviceDeps().store, answers, input);
    url = await createCheckoutUrl(payments, {
      claimId: claim.id,
      currency: claim.currency,
      successUrl: packUrl(siteUrl(), claim.packToken),
      cancelUrl: `${siteUrl()}/result/${encodeURIComponent(token)}`,
    });
  } catch (err) {
    if (err instanceof CheckoutNotAllowedError) return { error: "This flight doesn't qualify for a claim pack." };
    console.error("[checkout] failed", err);
    return { error: "We couldn't start checkout. Please try again in a moment." };
  }
  redirect(url);
}
