import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Privacy", robots: { index: false } };

export default function PrivacyPage() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Privacy</h1>
      <Alert>
        <AlertTitle>Draft</AlertTitle>
        <AlertDescription>This notice is a placeholder and must be reviewed before launch (GDPR / UK GDPR).</AlertDescription>
      </Alert>
      <p>The free check asks only about your flight. We don’t ask for your name, email or booking reference until you buy a claim pack.</p>
      <p>When you buy a pack, we collect only what the letter needs: passenger names, booking reference, email and postal address.</p>
      <p>We never sell your data. Letter drafting does not send your personal details to our AI provider.</p>
    </article>
  );
}
