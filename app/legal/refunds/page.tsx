import type { Metadata } from "next";
import { LegalPage, LegalSection, SupportLink } from "@/components/legal-page";
import lifecycle from "@/lib/claims/lifecycle.json";
import { REFUND_DAYS, SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Refund policy" };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund policy">
      <p className="text-lg font-medium">
        Not happy with your claim pack? Ask for a full refund within {REFUND_DAYS} days of purchase. No questions asked.
      </p>
      <LegalSection title="How to get a refund">
        <p>
          Email <SupportLink /> within {REFUND_DAYS} days of your purchase, from the email address you paid with, or
          include your order number (it is in your receipt from {SITE.paymentProvider}).
        </p>
        <p>
          We refund the full price to your original payment method through {SITE.paymentProvider}, our payment provider. Refunds
          are usually processed within 5 working days; your bank may take a few more days to show it.
        </p>
      </LegalSection>
      <LegalSection title="What happens after a refund">
        <p>
          Your claim pack link stops working, and we delete the claim and any personal details you entered for it
          within {lifecycle.retention.refundedClaimDays} days. You can still use the
          free eligibility check at any time.
        </p>
      </LegalSection>
      <LegalSection title="Your result from the airline does not affect this">
        <p>
          The refund is about the claim pack itself. We cannot refund on the basis of the airline’s decision, because we
          never promise an outcome, but within {REFUND_DAYS} days you do not need to give any reason at all.
        </p>
      </LegalSection>
      <LegalSection title="Your statutory rights">
        <p>
          This policy is in addition to, not instead of, your rights as a consumer under the law of your country.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
