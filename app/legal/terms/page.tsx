import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, SupportLink } from "@/components/legal-page";
import { DISCLAIMER } from "@/lib/legal";
import { REFUND_DAYS, SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>
        These terms apply when you use {SITE.name} ({`“we”`}, {`“us”`}), operated by {SITE.operatorName},{" "}
        {SITE.operatorAddress ?? SITE.operatorCountry}. Contact: <SupportLink />. By using the site or buying a claim
        pack you agree to them.
      </p>

      <LegalSection title="1. What we provide">
        <p>
          A free eligibility check that estimates whether you may be entitled to compensation under Regulation (EC) No
          261/2004 (EU261) or its UK equivalent (UK261), and how much.
        </p>
        <p>
          A paid claim pack: a claim letter, instructions for sending it to your airline, an escalation letter and reply
          templates, shown on screen, emailed to you and available as a PDF.
        </p>
        <p>
          You send the claim to the airline yourself. We do not contact the airline, act on your behalf or receive any
          compensation. Any compensation is paid by the airline directly to you, and you keep all of it.
        </p>
      </LegalSection>

      <LegalSection title="2. Not legal advice, no guaranteed outcome">
        <p className="font-medium">{DISCLAIMER}</p>
        <p>
          We are not a law firm. Our check relies on the information you give us and on the rules as we understand them.
          Only the airline, an enforcement body, a dispute scheme or a court can decide your claim. We never promise that
          you will receive compensation. See our <Link href="/legal/disclaimer" className="underline">disclaimer</Link>.
        </p>
      </LegalSection>

      <LegalSection title="3. Price and payment">
        <p>
          The price of a claim pack is shown before you pay and covers one claim (one flight, all passengers on the same
          booking). Payment is processed by {SITE.paymentProvider}, which acts as merchant of record (reseller): it sells the claim pack to
          you, handles VAT and issues your receipt, and its own buyer terms also apply to the payment.
        </p>
      </LegalSection>

      <LegalSection title="4. Delivery">
        <p>
          The claim pack is digital content delivered immediately after payment. By paying, you ask us to provide it
          straight away.
        </p>
      </LegalSection>

      <LegalSection title="5. Refunds">
        <p>
          You can ask for a full refund within {REFUND_DAYS} days of purchase, for any reason. See our{" "}
          <Link href="/legal/refunds" className="underline">refund policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="6. Your responsibilities">
        <ul className="list-disc space-y-1 pl-5">
          <li>Give accurate, truthful information about your flight and passengers.</li>
          <li>Only claim for yourself or for passengers who have authorised you to claim for them.</li>
          <li>Read the letters before you send them and correct anything that is wrong.</li>
          <li>Send your claim in time. Limitation periods vary by country.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Use of the claim pack">
        <p>
          The claim pack is for your own, personal, non-commercial use for the claim you bought it for. You may not resell
          it or use our templates to offer claim services to others.
        </p>
      </LegalSection>

      <LegalSection title="8. Liability">
        <p>
          We take reasonable care to keep our information accurate and up to date, but airlines, regulators and courts
          change their positions. To the extent the law allows, our total liability to you is limited to the price you
          paid for the claim pack, and we are not liable for compensation an airline does not pay.
        </p>
        <p>
          Nothing in these terms limits liability that cannot be limited by law, such as for fraud or gross negligence,
          or your mandatory rights as a consumer.
        </p>
      </LegalSection>

      <LegalSection title="9. Your data">
        <p>
          How we handle personal data is explained in our <Link href="/legal/privacy" className="underline">privacy
          policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p>
          We may update these terms. The version in force when you bought your claim pack applies to that purchase.
        </p>
      </LegalSection>

      <LegalSection title="11. Law and disputes">
        <p>
          These terms are governed by the law of {SITE.operatorCountry}. If you are a consumer, you also keep the
          protection of the mandatory laws of the country where you live, and you may bring proceedings in the courts
          there. Please contact us first at <SupportLink />: most problems can be solved quickly.
        </p>
        <p>
          EU consumers can also use the European Commission’s online dispute resolution information at{" "}
          <a href="https://consumer-redress.ec.europa.eu" className="underline">consumer-redress.ec.europa.eu</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
