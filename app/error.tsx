"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">
        Please try again. If you have already paid, your claim pack is safe: use the link in your confirmation email.
      </p>
      <Button size="lg" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
