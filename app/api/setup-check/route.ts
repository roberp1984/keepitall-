import { runSetupChecks } from "@/lib/setup/checks";
import { envSnapshot, realSetupClients } from "@/lib/setup/clients";

/** Read-only integration checks. Protected by CRON_SECRET; returns no secrets. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const results = await runSetupChecks(envSnapshot(), realSetupClients(), new URL(request.url).origin);
  return Response.json({ ok: results.every((r) => r.status !== "fail"), results });
}
