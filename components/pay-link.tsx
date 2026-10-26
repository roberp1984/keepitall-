"use client";

import { useEffect, useState } from "react";
import type { PaddleEnvironment } from "@/lib/env";
import { openPaddleCheckout } from "@/lib/payments/paddle-client";

export function PayLink(props: { transactionId: string; clientToken: string; environment: PaddleEnvironment }) {
  const [failed, setFailed] = useState(false);
  const { transactionId, clientToken, environment } = props;

  useEffect(() => {
    openPaddleCheckout({ transactionId, clientToken, environment }).then((opened) => setFailed(!opened));
  }, [transactionId, clientToken, environment]);

  return (
    <p className="text-muted-foreground">
      {failed
        ? "We couldn’t open the payment window. Please disable any blocker and reload this page."
        : "The secure payment window opens on top of this page. After paying, we email you the link to your claim pack."}
    </p>
  );
}
