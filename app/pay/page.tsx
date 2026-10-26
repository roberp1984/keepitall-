import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PayLink } from "@/components/pay-link";
import { paymentsConfig } from "@/lib/env";

export const metadata: Metadata = { title: "Complete your payment", robots: { index: false, follow: false } };

/** Paddle's "default payment link": Paddle sends customers here with ?_ptxn=<transaction id>. */
export default function PayPage({ searchParams }: PageProps<"/pay">) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-10">
      <h1 className="text-2xl font-bold">Complete your payment</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        {searchParams.then(({ _ptxn }) => (
          <Pay transactionId={typeof _ptxn === "string" ? _ptxn : null} />
        ))}
      </Suspense>
    </div>
  );
}

async function Pay({ transactionId }: { transactionId: string | null }) {
  await connection();
  const payments = paymentsConfig();
  if (!payments || !transactionId || !/^txn_[a-z0-9]+$/.test(transactionId)) {
    return <p className="text-muted-foreground">This payment link isn’t valid. Start again from your flight check.</p>;
  }
  return <PayLink transactionId={transactionId} clientToken={payments.clientToken} environment={payments.environment} />;
}
