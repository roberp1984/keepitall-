import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { allAirlines, getAirline } from "@/lib/airlines";
import { compensationTable, feeComparison } from "@/lib/marketing";
import { airlineCoverage } from "@/lib/seo/airline";
import { cn } from "@/lib/utils";

const TODAY = new Date().toISOString().slice(0, 10);

export function generateStaticParams() {
  return allAirlines().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/airlines/[slug]">): Promise<Metadata> {
  const airline = getAirline((await params).slug);
  if (!airline) return {};
  return {
    title: `${airline.name} delay compensation: how to claim yourself`,
    description: `Delayed or cancelled ${airline.name} flight? You may be owed up to €600 under EU261 or £520 under UK261. Check for free and claim it yourself.`,
  };
}

export default async function AirlinePage({ params }: PageProps<"/airlines/[slug]">) {
  const airline = getAirline((await params).slug);
  if (!airline) notFound();
  const table = compensationTable(TODAY);
  const fees = feeComparison(600, "EUR");

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{airline.name} delay compensation: how to claim yourself</h1>
        <p className="text-lg text-muted-foreground">
          If your {airline.name} flight arrived 3 hours or more late, was cancelled at short notice, or you were denied
          boarding, you may be entitled to compensation. You don’t need a claim company: you can claim it yourself and keep
          the full amount.
        </p>
        <Link href="/check" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}>
          Check my {airline.name} flight
          <ArrowRight />
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Which {airline.name} flights are covered?</h2>
        {airlineCoverage(airline).map((line) => (
          <p key={line}>{line}</p>
        ))}
        {airline.notes && <p className="text-sm text-muted-foreground">{airline.notes}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">How much you may be owed</h2>
        <ul className="flex flex-col gap-1">
          {table.map((row) => (
            <li key={row.distance} className="flex justify-between border-b py-2">
              <span>{row.distance}</span>
              <span className="font-semibold">
                {row.eu} / {row.uk}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Per passenger, under EU261 / UK261.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">How to claim from {airline.name}</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>Check your flight for free to see if you may be entitled and how much.</li>
          <li>Get your claim pack: a letter to {airline.name} citing the regulation, and instructions for sending it.</li>
          <li>Send it to {airline.name} and give them 14 days to reply.</li>
          <li>If they refuse or don’t reply, use the reply templates or escalate to the enforcement body.</li>
        </ol>
        <p>
          A claim company would typically keep up to {fees.claimCompanyFee} of a {fees.compensation} payout. With a{" "}
          {fees.ourPrice} claim pack, you keep {fees.youKeep}.
        </p>
      </section>

    </article>
  );
}
