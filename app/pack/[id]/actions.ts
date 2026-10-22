"use server";

import { redirect } from "next/navigation";
import { isPackToken } from "@/lib/claims/token";
import { submitDetails } from "@/lib/claims/service";
import { serviceDeps } from "@/lib/server/deps";

export interface DetailsState {
  error: string | null;
}

export async function submitDetailsAction(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const token = String(formData.get("token") ?? "");
  if (!isPackToken(token)) return { error: "This link is not valid." };
  const field = (name: string) => String(formData.get(name) ?? "");

  const result = await submitDetails(serviceDeps(), token, {
    claimantName: field("claimantName"),
    email: field("email"),
    postalAddress: field("postalAddress"),
    bookingReference: field("bookingReference"),
    passengers: formData.getAll("passenger").map(String),
  });
  if (!result.ok && result.error !== "already_complete") return { error: result.message };
  redirect(`/pack/${token}`);
}
