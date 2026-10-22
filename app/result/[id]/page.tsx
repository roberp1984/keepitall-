import { AlertTriangle, CheckCircle2, CircleSlash, FileText, Info, RotateCcw, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TrackOnMount } from "@/components/track";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CheckoutButton } from "@/components/checkout-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAirport } from "@/lib/airports";
import { carrierName, toClaimInput } from "@/lib/check/claim-input";
import { decodeAnswers } from "@/lib/check/token";
import { checkoutEnabled } from "@/lib/env";
import { presentAssessment, type ResultView } from "@/lib/result/view";
import { assessClaim } from "@/lib/rules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your result",
  robots: { index: false },
};

export default function ResultPage({ params }: PageProps<"/result/[id]">) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
      <Suspense fallback={<p className="text-muted-foreground">Checking your flight…</p>}>
        {params.then(({ id }) => (
          <Result id={id} />
        ))}
      </Suspense>
    </div>
  );
}

function label(iata: string): string {
  const airport = getAirport(iata);
  return airport ? `${airport.city || airport.name} (${iata})` : iata;
}

async function Result({ id }: { id: string }) {
  const answers = decodeAnswers(id);
  const today = new Date().toISOString().slice(0, 10);
  const input = answers && toClaimInput(answers, today);
  if (!answers || !input) notFound();

  const view = presentAssessment(assessClaim(input), {
    airlineName: carrierName(answers.carrier),
    fromLabel: label(answers.from),
    toLabel: label(answers.to),
    flightDate: answers.date,
  });

  return (
    <div className="flex flex-col gap-6">
      <TrackOnMount
        event={view.status === "eligible" ? "result_eligible" : "result_not_eligible"}
        properties={{ status: view.status, regime: view.regime ?? "none" }}
      />
      <Headline view={view} flightNumber={answers.flightNumber} />
      {view.status === "eligible" && <Amounts view={view} />}
      {view.strength && <Strength view={view} />}
      {view.deadline && (
        <Alert variant={view.deadline.warn ? "destructive" : "default"}>
          <AlertTriangle />
          <AlertTitle>Time limit</AlertTitle>
          <AlertDescription>{view.deadline.text}</AlertDescription>
        </Alert>
      )}
      {view.notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {view.notes.map((note) => (
            <li key={note} className="flex gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              {note}
            </li>
          ))}
        </ul>
      )}
      {view.pack && <Paywall view={view} token={id} />}
      {view.alternatives.length > 0 && <Alternatives view={view} />}
      <Link href="/check" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
        <RotateCcw />
        Check another flight
      </Link>
    </div>
  );
}

function Headline({ view, flightNumber }: { view: ResultView; flightNumber: string }) {
  const Icon = view.status === "eligible" ? CheckCircle2 : view.status === "not_eligible" ? XCircle : CircleSlash;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {view.regime ? <Badge>{view.regime}</Badge> : <Badge variant="secondary">Not covered</Badge>}
        <Badge variant="outline">{flightNumber}</Badge>
      </div>
      <h1 className="flex items-start gap-3 text-2xl leading-snug font-bold tracking-tight">
        <Icon className={cn("mt-1 size-6 shrink-0", view.status === "eligible" ? "text-primary" : "text-muted-foreground")} aria-hidden />
        {view.headline}
      </h1>
      <p className="text-muted-foreground">{view.summary}</p>
      {view.coverage && <p className="text-sm text-muted-foreground">{view.coverage}</p>}
    </div>
  );
}

function Amounts({ view }: { view: ResultView }) {
  return (
    <Card className="gap-4 py-5">
      <CardContent className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Per passenger</p>
          <p className="text-3xl font-bold">{view.perPassenger}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            Total for {view.passengers} passenger{view.passengers === 1 ? "" : "s"}
          </p>
          <p className="text-3xl font-bold text-primary">{view.total}</p>
        </div>
        {view.distance && <p className="col-span-2 text-sm text-muted-foreground">Flight distance: {view.distance}</p>}
      </CardContent>
    </Card>
  );
}

const STRENGTH_STYLE = {
  strong: "default",
  possible: "warning",
  unlikely: "secondary",
} as const;

function Strength({ view }: { view: ResultView }) {
  const s = view.strength!;
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <Badge variant={STRENGTH_STYLE[s.label]}>{s.title}</Badge>
      <p className="text-sm">{s.rationale}</p>
    </div>
  );
}

const PACK_CONTENTS = [
  "A claim letter to the airline, citing the regulation and the exact amount",
  "Step-by-step instructions for sending it",
  "Replies to common refusals (“extraordinary circumstances”, vouchers)",
  "An escalation letter if the airline doesn't pay",
];

function Paywall({ view, token }: { view: ResultView; token: string }) {
  return (
    <Card className="border-primary ring-1 ring-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="size-5 text-primary" aria-hidden />
          Claim it yourself and keep 100%
        </CardTitle>
        <CardDescription>One-off {view.pack!.price} per claim. No commission.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2 text-sm">
          {PACK_CONTENTS.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <CheckoutButton token={token} price={view.pack!.price} enabled={checkoutEnabled()} />
      </CardContent>
    </Card>
  );
}

function Alternatives({ view }: { view: ResultView }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold">You may still have other rights</h2>
      {view.alternatives.map((a) => (
        <div key={a.title} className="rounded-lg border p-4">
          <p className="font-medium">{a.title}</p>
          <p className="text-sm text-muted-foreground">{a.text}</p>
        </div>
      ))}
    </div>
  );
}
