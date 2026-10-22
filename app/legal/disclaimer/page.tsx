import type { Metadata } from "next";
import { DISCLAIMER } from "@/lib/legal";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Disclaimer</h1>
      <p className="text-lg font-medium">{DISCLAIMER}</p>
      <p>
        KeepItAll helps you understand your rights under Regulation (EC) No 261/2004 (EU261) and its UK equivalent
        (UK261), and gives you templates to claim yourself. We are not a law firm and we do not act for you.
      </p>
      <p>
        Our eligibility check is based on the information you give us and on the regulations as we understand them.
        Whether you are entitled to compensation depends on the full facts, which only the airline, an enforcement body,
        a dispute scheme or a court can decide. We never promise an outcome.
      </p>
      <p>We are not affiliated with any airline.</p>
    </article>
  );
}
