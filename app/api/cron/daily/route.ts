import { runDailyJobs } from "@/lib/claims/lifecycle";
import { supabaseConfig } from "@/lib/env";
import { serviceDeps } from "@/lib/server/deps";

/** Called once a day by Vercel Cron (vercel.json) with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!supabaseConfig()) return new Response("Database not configured", { status: 503 });
  const result = await runDailyJobs(serviceDeps());
  console.info("[cron] daily jobs", result);
  return Response.json(result);
}
