import type { Metadata } from "next";
import { CheckWizard } from "@/components/check/wizard";
import { allAirlines } from "@/lib/airlines";

export const metadata: Metadata = {
  title: "Check my flight",
  description: "Free 60-second check: find out if your delayed, cancelled or overbooked flight is owed compensation.",
};

export default function CheckPage() {
  const airlines = allAirlines()
    .map(({ slug, name, iata }) => ({ slug, name, iata }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
      <CheckWizard airlines={airlines} />
    </div>
  );
}
