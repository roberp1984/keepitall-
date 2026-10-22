import { afterEach, describe, expect, it, vi } from "vitest";
import { testDeps } from "@/lib/claims/fixtures";

const ctx = testDeps();
vi.mock("@/lib/server/deps", () => ({ serviceDeps: () => ctx.deps }));
const { GET } = await import("./route");

const req = (auth?: string) => new Request("https://k.test/api/cron/daily", { headers: auth ? { authorization: auth } : {} });

describe("GET /api/cron/daily", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
  });

  it("refuses to run with no secret configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(401);
  });

  it("runs the daily jobs", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ followUpsSent: 0, followUpsFailed: 0, purge: { unpaidDeleted: 0, refundedDeleted: 0, packsExpired: 0 } });
  });
});
