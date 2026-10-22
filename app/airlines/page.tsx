import type { Metadata } from "next";
import Link from "next/link";
import { allAirlines } from "@/lib/airlines";

export const metadata: Metadata = {
  title: "Airline compensation guides",
  description: "How to claim flight delay and cancellation compensation yourself, airline by airline.",
};

export default function AirlinesPage() {
  const airlines = [...allAirlines()].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Claim from your airline yourself</h1>
      <p className="mb-8 text-muted-foreground">Guides for delays, cancellations and denied boarding.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {airlines.map((a) => (
          <li key={a.slug}>
            <Link href={`/airlines/${a.slug}`} className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted">
              <span className="font-medium">{a.name}</span>
              <span className="font-mono text-sm text-muted-foreground">{a.iata}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
