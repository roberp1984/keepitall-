"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const INTERVAL_MS = 3000;
const MAX_TRIES = 20;

/** Polls until the webhook marks the claim paid. */
export function AwaitingPayment() {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries >= MAX_TRIES) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="flex items-center gap-3 text-2xl font-bold">
        {!gaveUp && <Loader2 className="size-6 animate-spin text-primary" aria-hidden />}
        Confirming your payment
      </h1>
      <p className="text-muted-foreground">
        {gaveUp
          ? "This is taking longer than usual. We'll email you a link to your claim pack as soon as your payment is confirmed."
          : "This usually takes a few seconds. Please keep this page open."}
      </p>
    </div>
  );
}
