import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/setup/clients", () => ({
  envSnapshot: () => ({ siteUrl: null, supabase: false, paddle: null, emailFrom: null, resend: false, anthropicModel: null, analyticsWebsiteId: null, cronSecretLength: 40 }),
  realSetupClients: () => ({}),
}));
const { GET } = await import("./route");

describe("GET /api/setup-check", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "x".repeat(40));
    expect((await GET(new Request("https://k.test/api/setup-check"))).status).toBe(401);
  });

  it("returns check results and overall ok=false when required services are missing", async () => {
    vi.stubEnv("CRON_SECRET", "x".repeat(40));
    const res = await GET(new Request("https://k.test/api/setup-check", { headers: { authorization: `Bearer ${"x".repeat(40)}` } }));
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.results.map((r: { service: string }) => r.service)).toContain("Supabase");
  });
});
