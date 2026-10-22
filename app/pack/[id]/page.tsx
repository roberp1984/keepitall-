import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AwaitingPayment } from "@/components/pack/awaiting-payment";
import { DetailsForm } from "@/components/pack/details-form";
import { PackView } from "@/components/pack/pack-view";
import { isPackToken } from "@/lib/claims/token";
import { supabaseConfig } from "@/lib/env";
import { serviceDeps } from "@/lib/server/deps";

export const metadata: Metadata = {
  title: "Your claim pack",
  robots: { index: false, follow: false },
};

export default function PackPage({ params }: PageProps<"/pack/[id]">) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
      <Suspense fallback={<p className="text-muted-foreground">Loading your claim pack…</p>}>
        {params.then(({ id }) => (
          <Pack token={id} />
        ))}
      </Suspense>
    </div>
  );
}

async function Pack({ token }: { token: string }) {
  if (!isPackToken(token) || !supabaseConfig()) notFound();
  const claim = await serviceDeps().store.getByPackToken(token);
  if (!claim) notFound();

  switch (claim.status) {
    case "checkout_started":
      return <AwaitingPayment />;
    case "refunded":
      return (
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold">This order was refunded</h1>
          <p className="text-muted-foreground">The claim pack for this order is no longer available.</p>
        </div>
      );
    case "paid":
      return (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Payment confirmed. Last step.</h1>
            <p className="text-muted-foreground">
              We need a few details to put in your letters. It takes about a minute.
            </p>
          </div>
          <DetailsForm token={token} passengers={claim.assessment.passengers} defaultEmail={claim.orderEmail ?? ""} />
        </div>
      );
    case "expired":
      return (
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold">This claim pack has expired</h1>
          <p className="text-muted-foreground">
            We delete personal details after a while to protect your privacy. Please use the PDF we emailed you.
          </p>
        </div>
      );
    case "pack_ready":
      if (!claim.pack) notFound();
      return <PackView token={token} facts={claim.pack.facts} pack={claim.pack.pack} />;
  }
}
