"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { submitDetailsAction, type DetailsState } from "@/app/pack/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DetailsForm({ token, passengers, defaultEmail }: { token: string; passengers: number; defaultEmail: string }) {
  const [state, action, pending] = useActionState<DetailsState, FormData>(submitDetailsAction, { error: null });

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="claimantName">Your full name</Label>
        <Input id="claimantName" name="claimantName" autoComplete="name" required />
        <p className="text-sm text-muted-foreground">As it appears on the booking. You must be one of the passengers.</p>
      </div>
      {Array.from({ length: passengers - 1 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Label htmlFor={`passenger-${i}`}>Passenger {i + 2} full name</Label>
          <Input id={`passenger-${i}`} name="passenger" autoComplete="off" required />
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <Label htmlFor="bookingReference">Booking reference</Label>
        <Input
          id="bookingReference"
          name="bookingReference"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="e.g. ABC123"
          required
          minLength={5}
          maxLength={8}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email for the airline’s reply</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="postalAddress">Postal address</Label>
        <textarea
          id="postalAddress"
          name="postalAddress"
          rows={4}
          autoComplete="street-address"
          required
          className="rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <p className="text-sm text-muted-foreground">Airlines expect a postal address on formal claims.</p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {pending ? "Preparing your letters…" : "Create my claim pack"}
      </Button>
      <p className="text-xs text-muted-foreground">
        We only use these details to write your letters. They are never sold or shared, and our AI letter writer never sees them.
      </p>
    </form>
  );
}
