import { ArrowRight, Check, FileText, Plane, Send } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { compensationTable, feeComparison, maxCompensation } from "@/lib/marketing";
import { cn } from "@/lib/utils";

// Marketing copy is evaluated at build time; amounts come from the rules config.
const TODAY = new Date().toISOString().slice(0, 10);

const STEPS = [
  { icon: Plane, title: "Check your flight", text: "Answer a few questions. It's free and takes about a minute." },
  { icon: FileText, title: "Get your claim pack", text: "A ready-to-send letter citing the regulation, plus step-by-step instructions." },
  { icon: Send, title: "Send it, keep it all", text: "The airline pays you directly. No commission, ever." },
];

const FAQ = [
  {
    q: "Which flights are covered?",
    a: "Flights leaving the EU, Iceland, Norway, Switzerland or the UK on any airline, and flights into them on an airline based there. You may be owed compensation if you arrived 3 hours or more late, your flight was cancelled at short notice, or you were denied boarding.",
  },
  {
    q: "Do you send the claim for me?",
    a: "No. You send the letter yourself, so the airline pays you directly and you keep the full amount. We give you everything you need to do it.",
  },
  {
    q: "What if the airline says no?",
    a: "Your pack includes replies to the most common refusals, such as 'extraordinary circumstances' or voucher offers, and an escalation letter for the national enforcement body or dispute scheme.",
  },
  {
    q: "Is this legal advice?",
    a: "No. We provide templates and information based on the regulations. We can't guarantee what an airline will do.",
  },
];

export default function Home() {
  const max = maxCompensation(TODAY);
  const fees = feeComparison(600, "EUR");
  const table = compensationTable(TODAY);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-4 py-10 sm:py-16">
      <section className="flex flex-col gap-6">
        <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
          Your airline may owe you up to <span className="text-primary">{max}</span>.
        </h1>
        <p className="text-xl text-muted-foreground">Claim companies take a third. Keep it all.</p>
        <p className="text-base">
          Check your delayed, cancelled or overbooked flight for free. If you may be owed money, get a ready-to-send
          claim pack for a one-off {fees.ourPrice} and keep 100% of your compensation.
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/check" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}>
            Check my flight (free, 60 seconds)
            <ArrowRight />
          </Link>
          <p className="text-sm text-muted-foreground">No sign-up. No personal details needed for the check.</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">On a {fees.compensation} claim</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="gap-2 py-5">
            <CardContent className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Claim company (up to {fees.feePercent})</p>
              <p className="text-3xl font-bold">{fees.claimCompanyKeeps}</p>
              <p className="text-sm text-muted-foreground">to you, after {fees.claimCompanyFee} commission</p>
            </CardContent>
          </Card>
          <Card className="gap-2 border-primary py-5 ring-1 ring-primary">
            <CardContent className="flex flex-col gap-1">
              <p className="text-sm font-medium text-primary">KeepItAll</p>
              <p className="text-3xl font-bold">{fees.youKeep}</p>
              <p className="text-sm text-muted-foreground">to you, after a one-off {fees.ourPrice}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="flex flex-col gap-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <s.icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">
                  {i + 1}. {s.title}
                </p>
                <p className="text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">What you may be owed</h2>
        <p className="text-muted-foreground">Per passenger, depending on flight distance.</p>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Distance</th>
                <th className="px-4 py-3 font-medium">EU261</th>
                <th className="px-4 py-3 font-medium">UK261</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.distance} className="border-t">
                  <td className="px-4 py-3">
                    {row.distance}
                    <span className="block text-xs text-muted-foreground">{row.example}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{row.eu}</td>
                  <td className="px-4 py-3 font-semibold">{row.uk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Amounts can be halved if you were rerouted and arrived close to your original time.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Questions</h2>
        <div className="flex flex-col divide-y rounded-xl border">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-start gap-3 rounded-xl bg-accent p-6">
        <p className="flex items-center gap-2 font-semibold">
          <Check className="text-primary" aria-hidden /> Free check. Pay only if you want the claim pack.
        </p>
        <Link href="/check" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}>
          Check my flight
          <ArrowRight />
        </Link>
      </section>
    </div>
  );
}
