import type { Metadata } from "next";
import { LegalPage, LegalSection, SupportLink } from "@/components/legal-page";
import lifecycle from "@/lib/claims/lifecycle.json";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy policy" };

const PROCESSORS = [
  ["Lemon Squeezy", "Payments, receipts and VAT (as merchant of record, it is also a controller for payment data)", "USA"],
  ["Supabase", "Database for claims and orders", "London, UK"],
  ["Vercel", "Website hosting", "London, UK (global network)"],
  ["Resend", "Sending your emails", "EU (Ireland)"],
  ["PostHog", "Cookieless, anonymous usage analytics", "EU"],
  ["Anthropic", "Drafting letter text. It never receives names, emails, addresses or booking references", "USA"],
] as const;

export default function PrivacyPage() {
  const { retention } = lifecycle;
  return (
    <LegalPage title="Privacy policy">
      <p>
        We collect as little personal data as we can, and we never sell it. This policy explains what we collect, why,
        and your rights under the GDPR and UK GDPR.
      </p>

      <LegalSection title="Who is responsible">
        <p>
          The controller is {SITE.operatorName}, {SITE.operatorAddress ?? SITE.operatorCountry}. Contact for any privacy
          question: <SupportLink />.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <p>
          <strong>Free check:</strong> only details about your flight (airports, airline, flight number, date, what
          happened, the reason given). No name, email or booking reference.
        </p>
        <p>
          <strong>When you buy a claim pack:</strong> Lemon Squeezy collects your email and payment details to process the
          payment; we receive your email and order number, not your card details. After payment we ask for what the
          letters need: passenger names, booking reference, email and postal address.
        </p>
        <p>
          <strong>Technical data:</strong> our hosting provider processes IP addresses and request logs to run and protect
          the site. Our analytics are cookieless and anonymous: no cookies, no profiles, no session recording.
        </p>
      </LegalSection>

      <LegalSection title="Why we use it (legal basis)">
        <ul className="list-disc space-y-1 pl-5">
          <li>To create, show and email your claim pack and its follow-up reminders: performance of our contract with you.</li>
          <li>To keep payment and tax records: legal obligation.</li>
          <li>To understand how the site is used and to keep it secure: our legitimate interests, using anonymous data.</li>
        </ul>
        <p>We do not use your data for advertising or automated decisions about you, and we never sell it.</p>
      </LegalSection>

      <LegalSection title="Who processes it for us">
        <ul className="list-disc space-y-1 pl-5">
          {PROCESSORS.map(([name, purpose, location]) => (
            <li key={name}>
              <strong>{name}</strong>: {purpose}. Location: {location}.
            </li>
          ))}
        </ul>
        <p>
          Where data is transferred outside the UK/EEA, it is protected by adequacy decisions (such as the EU–US Data
          Privacy Framework) or Standard Contractual Clauses.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <ul className="list-disc space-y-1 pl-5">
          <li>Unfinished checkouts: deleted after {retention.unpaidClaimDays} days.</li>
          <li>Refunded claims: deleted after {retention.refundedClaimDays} days.</li>
          <li>
            Claim pack details (names, booking reference, address): deleted {Math.round(retention.packDetailsDays / 365)}{" "}
            years after the pack is created, so you can come back to it while your claim runs.
          </li>
          <li>Payment records: kept by Lemon Squeezy as tax law requires.</li>
        </ul>
        <p>You can ask us to delete your claim earlier at any time.</p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You can ask to access, correct, delete or receive a copy of your data, and object to or restrict how we use it.
          Email <SupportLink />; we reply within one month.
        </p>
        <p>
          You can also complain to a data protection authority: in Spain, the AEPD (aepd.es); in the UK, the ICO
          (ico.org.uk); or the authority where you live.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>We do not use cookies for tracking or advertising, so there is no cookie banner.</p>
      </LegalSection>
    </LegalPage>
  );
}
