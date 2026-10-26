import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/letters/format";
import { packPrice } from "@/lib/pricing";
import { REFUND_DAYS, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free eligibility check. One-off claim pack per claim. No commission on your compensation.",
};

const INCLUDED = [
  "Claim letter to the airline, citing the regulation and the amount",
  "Step-by-step instructions to send it to your airline",
  "Escalation letter for the enforcement body or dispute scheme",
  "Replies to the most common refusals (“extraordinary circumstances”, vouchers)",
  "PDF download, plus a copy by email",
  "All passengers on the same booking included",
];

const PLANS = [
  { name: "EU261 claim", currency: "EUR" as const, who: "Flights covered by EU law (Regulation 261/2004)" },
  { name: "UK261 claim", currency: "GBP" as const, who: "Flights covered by UK law (UK261)" },
];

export default function PricingPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="text-lg text-muted-foreground">
          The check is free. Pay once per claim only if you want the claim pack. No subscription, no commission: the
          airline pays you directly and you keep 100%.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eligibility check</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-3xl font-bold">Free</p>
          <p className="text-muted-foreground">See whether you may be entitled to compensation, and how much.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <Card key={plan.name}>
            <CardHeader>
              <CardTitle>Claim pack · {plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-3xl font-bold">{formatMoney(packPrice(plan.currency))}</p>
              <p className="text-sm text-muted-foreground">One-off payment per claim. {plan.who}.</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Every claim pack includes</h2>
        <ul className="flex flex-col gap-2">
          {INCLUDED.map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Payments are processed by {SITE.paymentProvider}, our merchant of record, which also handles VAT.
          You get your claim pack instantly after paying.
        </p>
        <p>
          {REFUND_DAYS}-day money-back guarantee: ask for a full refund within {REFUND_DAYS} days, no questions asked.
          See our <Link href="/legal/refunds" className="underline">refund policy</Link> and{" "}
          <Link href="/legal/terms" className="underline">terms</Link>.
        </p>
      </section>

      <Link href="/check" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}>
        Check my flight (free, 60 seconds)
        <ArrowRight />
      </Link>
    </div>
  );
}
