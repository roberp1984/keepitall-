"use server";

import { toClaimInput } from "@/lib/check/claim-input";
import { decodeAnswers } from "@/lib/check/token";
import { CheckoutNotAllowedError, createClaimForCheckout, packUrl } from "@/lib/claims/service";
import { paymentsConfig, siteUrl, type PaddleEnvironment } from "@/lib/env";
import { createTransaction } from "@/lib/payments/paddle";
import { serviceDeps } from "@/lib/server/deps";

/** What the browser needs to open Paddle's checkout overlay. */
export interface PaddleCheckout {
  transactionId: string;
  successUrl: string;
  clientToken: string;
  environment: PaddleEnvironment;
}

export interface CheckoutState {
  error: string | null;
  checkout?: PaddleCheckout;
}

export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const payments = paymentsConfig();
  if (!payments) return { error: "Checkout isn't available yet." };

  const answers = decodeAnswers(String(formData.get("token") ?? ""));
  const input = answers && toClaimInput(answers, new Date().toISOString().slice(0, 10));
  if (!answers || !input) return { error: "Something is wrong with this result. Please run the check again." };

  try {
    const claim = await createClaimForCheckout(serviceDeps().store, answers, input);
    const transactionId = await createTransaction(payments, { claimId: claim.id, currency: claim.currency });
    return {
      error: null,
      checkout: {
        transactionId,
        successUrl: packUrl(siteUrl(), claim.packToken),
        clientToken: payments.clientToken,
        environment: payments.environment,
      },
    };
  } catch (err) {
    if (err instanceof CheckoutNotAllowedError) return { error: "This flight doesn't qualify for a claim pack." };
    console.error("[checkout] failed", err);
    return { error: "We couldn't start checkout. Please try again in a moment." };
  }
}
