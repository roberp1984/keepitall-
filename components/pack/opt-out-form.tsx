"use client";

import { useActionState } from "react";
import { optOutAction } from "@/app/pack/[id]/emails/actions";
import { Button } from "@/components/ui/button";

export function OptOutForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(optOutAction, { done: false, error: null });
  if (state.done) return <p className="font-medium">Done. We won’t send you any more reminders about this claim.</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Button size="lg" variant="outline" disabled={pending}>
        Stop reminder emails
      </Button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
