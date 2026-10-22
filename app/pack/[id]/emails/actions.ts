"use server";

import { isPackToken } from "@/lib/claims/token";
import { serviceDeps } from "@/lib/server/deps";

export async function optOutAction(_prev: { done: boolean; error: string | null }, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!isPackToken(token)) return { done: false, error: "This link is not valid." };
  const ok = await serviceDeps().store.setFollowUpOptOut(token);
  return ok ? { done: true, error: null } : { done: false, error: "We couldn't find this claim." };
}
