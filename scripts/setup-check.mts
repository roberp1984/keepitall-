/**
 * Checks a deployed site's integrations (read-only):
 *
 *   CRON_SECRET=... npm run setup:check -- https://your-site.example
 *
 * Calls /api/setup-check, which runs on the server with the real environment.
 */
const ICON = { ok: "✔", warn: "!", fail: "✖", skip: "–" } as const;

interface Result {
  service: string;
  status: keyof typeof ICON;
  detail: string;
}

async function main() {
  const site = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const secret = process.env.CRON_SECRET?.trim();
  if (!site) throw new Error("Usage: CRON_SECRET=... npm run setup:check -- https://your-site.example");
  if (!secret) throw new Error("Set CRON_SECRET (the same value as in Vercel) in your shell.");

  const res = await fetch(`${site}/api/setup-check`, { headers: { authorization: `Bearer ${secret}` } });
  if (res.status === 401) throw new Error("Unauthorized: CRON_SECRET doesn't match the deployment.");
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${site}/api/setup-check`);
  const { ok, results } = (await res.json()) as { ok: boolean; results: Result[] };

  const width = Math.max(...results.map((r) => r.service.length));
  for (const r of results) console.log(`${ICON[r.status]} ${r.service.padEnd(width)}  ${r.detail}`);
  console.log(ok ? "\nAll required checks passed." : "\nSome checks failed (✖). Fix them before taking payments.");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(2);
});
