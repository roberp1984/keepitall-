import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OptOutForm } from "@/components/pack/opt-out-form";
import { isPackToken } from "@/lib/claims/token";

export const metadata: Metadata = { title: "Email reminders", robots: { index: false, follow: false } };

export default function EmailsPage({ params }: PageProps<"/pack/[id]/emails">) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Reminder emails</h1>
      <p className="text-muted-foreground">
        We send at most two reminders about your claim: one to check whether the airline replied, and one when it may be time to escalate.
      </p>
      <Suspense>
        {params.then(({ id }) => {
          if (!isPackToken(id)) notFound();
          return <OptOutForm token={id} />;
        })}
      </Suspense>
    </div>
  );
}
