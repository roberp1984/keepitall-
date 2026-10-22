"use server";

import { redirect } from "next/navigation";
import { toClaimInput } from "@/lib/check/claim-input";
import { decodeAnswers } from "@/lib/check/token";
import { CheckoutNotAllowedError, createClaimForCheckout, packUrl } from "@/lib/claims/service";
import { paymentsConfig, siteUrl } from "@/lib/env";
import { createCheckoutUrl } from "@/lib/payments/lemonsqueezy";
import { serviceDeps } from "@/lib/server/deps";

export interface CheckoutState {
  error: string | null;
}

export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const payments = paymentsConfig();
  if (!payments) return { error: "Checkout isn't available yet." };

  const answers = decodeAnswers(String(formData.get("token") ?? ""));
  const input = answers && toClaimInput(answers, new Date().toISOString().slice(0, 10));
  if (!answers || !input) return { error: "Something is wrong with this result. Please run the check again." };

  let url: string;
  try {
    const claim = await createClaimForCheckout(serviceDeps().store, answers, input);
    url = await createCheckoutUrl(payments, {
      claimId: claim.id,
      currency: claim.currency,
      redirectUrl: packUrl(siteUrl(), claim.packToken),
    });
  } catch (err) {
    if (err instanceof CheckoutNotAllowedError) return { error: "This flight doesn't qualify for a claim pack." };
    console.error("[checkout] failed", err);
    return { error: "We couldn't start checkout. Please try again in a moment." };
  }
  redirect(url);
}
