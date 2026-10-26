// TEMPORARY admin tool to inspect and fix the Paddle notification destination. Remove after setup.
import { timingSafeEqual } from "node:crypto";
import { paymentsConfig } from "@/lib/env";
import { paddleApi } from "@/lib/payments/paddle";

const EVENTS = ["transaction.completed", "adjustment.created", "adjustment.updated"];

function authorized(given: string | null): boolean {
  const expected = process.env.PADDLE_ADMIN_TOKEN?.trim();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface Destination {
  id: string;
  description: string;
  destination: string;
  active: boolean;
  traffic_source: string;
  subscribed_events: { name: string }[];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payments = paymentsConfig();
  if (!authorized(url.searchParams.get("token")) || !payments) return new Response("Not found", { status: 404 });
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const action = url.searchParams.get("action") ?? "status";
  const id = url.searchParams.get("id") ?? "";

  try {
    if (action === "fix" && /^ntfset_[a-z0-9]+$/.test(id)) {
      const updated = await paddleApi<Destination>(payments, `/notification-settings/${id}`, {
        method: "PATCH",
        body: { destination: `${site}/api/webhooks/paddle`, active: true, subscribed_events: EVENTS },
      });
      return Response.json({ fixed: summarize(updated) });
    }
    if (action === "replay" && /^ntf_[a-z0-9]+$/.test(id)) {
      return Response.json({ replayed: await paddleApi(payments, `/notifications/${id}/replay`, { method: "POST" }) });
    }

    const soft = <T,>(p: Promise<T>) => p.catch((err: Error) => ({ error: err.message }) as const);
    const destinations = await soft(paddleApi<Destination[]>(payments, "/notification-settings"));
    const transactions = await soft(
      paddleApi<{ id: string; status: string; created_at: string; custom_data: unknown }[]>(
        payments,
        "/transactions?order_by=created_at[DESC]&per_page=5",
      ),
    );
    const notifications = await soft(
      paddleApi<
        { id: string; type: string; status: string; times_attempted: number; last_attempt_at: string | null; notification_setting_id: string }[]
      >(payments, "/notifications?per_page=10"),
    );
    return Response.json({
      environment: payments.environment,
      destinations: "error" in destinations ? destinations : destinations.map(summarize),
      transactions:
        "error" in transactions
          ? transactions
          : transactions.map((t) => ({ id: t.id, status: t.status, created_at: t.created_at, custom_data: t.custom_data })),
      notifications: "error" in notifications ? notifications : notifications.map((n) => ({
        id: n.id,
        type: n.type,
        status: n.status,
        attempts: n.times_attempted,
        last: n.last_attempt_at,
        setting: n.notification_setting_id,
      })),
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}

function summarize(d: Destination) {
  return {
    id: d.id,
    description: d.description,
    destination: d.destination,
    active: d.active,
    traffic_source: d.traffic_source,
    events: d.subscribed_events.map((e) => e.name),
  };
}
