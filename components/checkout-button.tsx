"use client";

import Link from "next/link";
import { REFUND_DAYS } from "@/lib/site";
import { ArrowRight, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { startCheckout, type CheckoutState } from "@/app/result/[id]/actions";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

export function CheckoutButton({ token, price, enabled }: { token: string; price: string; enabled: boolean }) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startCheckout, { error: null });

  return (
    <form action={action} className="flex flex-col gap-2" onSubmit={() => track("checkout_started")}>
      <input type="hidden" name="token" value={token} />
      <Button size="lg" className="w-full" disabled={!enabled || pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Get your claim pack — {price}
        {!pending && <ArrowRight />}
      </Button>
      {state.error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {state.error}
        </p>
      )}
      <p className="text-center text-xs text-muted-foreground">
        {enabled ? "Secure checkout by Lemon Squeezy. Guest checkout, no account needed." : "Checkout opens soon."}
      </p>
      <p className="text-center text-xs text-muted-foreground">
        {REFUND_DAYS}-day money-back guarantee.{" "}
        <Link href="/legal/refunds" className="underline">Refund policy</Link> ·{" "}
        <Link href="/legal/terms" className="underline">Terms</Link>
      </p>
    </form>
  );
}
