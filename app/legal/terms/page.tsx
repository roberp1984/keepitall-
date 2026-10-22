import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Terms", robots: { index: false } };

export default function TermsPage() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Terms of use</h1>
      <Alert>
        <AlertTitle>Draft</AlertTitle>
        <AlertDescription>These terms are a placeholder and must be reviewed by a lawyer before launch.</AlertDescription>
      </Alert>
      <p>The eligibility check is free. The claim pack is a one-off digital purchase per claim.</p>
      <p>You send your claim to the airline yourself. Any compensation is paid by the airline directly to you.</p>
      <p>Payments are processed by our merchant of record, Lemon Squeezy, which handles VAT.</p>
    </article>
  );
}
