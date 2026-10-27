import { describe, expect, it, vi } from "vitest";
import { emailDomain, runSetupChecks, type EnvSnapshot, type SetupClients } from "@/lib/setup/checks";

const env: EnvSnapshot = {
  siteUrl: "https://keepitall.example",
  supabase: true,
  paddle: { environment: "production", priceIds: { EUR: "pri_eur", GBP: "pri_gbp" }, webhookSecret: true, clientToken: "live_abc" },
  emailFrom: "KeepItAll <claims@keepitall.example>",
  resend: true,
  anthropicModel: "claude-sonnet-5-5",
  analyticsWebsiteId: "774a7126-36f2-4c88-908d-de459c5ad057",
  cronSecretLength: 64,
};

function clients(overrides: Partial<SetupClients> = {}): SetupClients {
  return {
    probeClaims: vi.fn().mockResolvedValue(null),
    paddlePrice: vi.fn(async (id: string) =>
      id === "pri_eur"
        ? { name: "EU261 claim", amountCents: 1900, currency: "EUR", status: "active", recurring: false }
        : { name: "UK261 claim", amountCents: 1800, currency: "EUR", status: "active", recurring: false },
    ),
    paddleWebhooks: vi.fn().mockResolvedValue([
      { url: "https://keepitall.example/api/webhooks/paddle", events: ["transaction.completed", "adjustment.created", "adjustment.updated"], active: true },
    ]),
    resendDomains: vi.fn().mockResolvedValue([{ name: "keepitall.example", status: "verified" }]),
    anthropicModel: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const byService = async (e: EnvSnapshot, c: SetupClients, origin: string | null = "https://keepitall.example") =>
  Object.fromEntries((await runSetupChecks(e, c, origin)).map((r) => [r.service, r]));

describe("runSetupChecks", () => {
  it("passes a fully configured setup where both prices match the advertised prices", async () => {
    const r = await byService(env, clients());
    expect(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.status]))).toEqual({
      "Site URL": "ok",
      Supabase: "ok",
      Paddle: "ok",
      "Paddle · EUR price": "ok",
      "Paddle · GBP price": "ok",
      "Paddle · webhook": "ok",
      Resend: "ok",
      Anthropic: "ok",
      Umami: "ok",
      Cron: "ok",
    });
    expect(r["Paddle · GBP price"]!.detail).toBe("Price “UK261 claim” charges 18.00 EUR, matching the site.");
  });

  it("points to the right migration when tables or columns are missing", async () => {
    const missingTable = await byService(env, clients({ probeClaims: vi.fn().mockResolvedValue("relation does not exist") }));
    expect(missingTable.Supabase).toMatchObject({ status: "fail" });
    expect(missingTable.Supabase!.detail).toContain("20261022000000_init.sql");

    const probe = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("column claims.followups does not exist");
    const missingColumns = await byService(env, clients({ probeClaims: probe }));
    expect(missingColumns.Supabase!.detail).toContain("20261022010000_lifecycle.sql");
  });

  it("flags wrong prices, inactive or recurring prices and webhook problems", async () => {
    const r = await byService(
      env,
      clients({
        paddlePrice: vi.fn(async (id: string) =>
          id === "pri_eur"
            ? { name: "EU261 claim", amountCents: 2500, currency: "EUR", status: "active", recurring: false }
            : { name: "UK261 claim", amountCents: 1800, currency: "EUR", status: "archived", recurring: false },
        ),
        paddleWebhooks: vi.fn().mockResolvedValue([{ url: "https://keepitall.example/api/webhooks/paddle", events: ["transaction.completed"], active: true }]),
      }),
    );
    expect(r["Paddle · EUR price"]).toMatchObject({ status: "fail" });
    expect(r["Paddle · EUR price"]!.detail).toContain("the site shows 19.00 EUR");
    expect(r["Paddle · GBP price"]).toMatchObject({ status: "fail", detail: "Price “UK261 claim” is archived; activate it." });
    expect(r["Paddle · webhook"]).toMatchObject({ status: "fail", detail: "Destination is missing events: adjustment.created, adjustment.updated." });

    const recurring = await byService(env, clients({ paddlePrice: vi.fn().mockResolvedValue({ name: "Sub", amountCents: 1900, currency: "EUR", status: "active", recurring: true }) }));
    expect(recurring["Paddle · EUR price"]!.detail).toContain("must be one-time");

    const none = await byService(env, clients({ paddleWebhooks: vi.fn().mockResolvedValue([]) }));
    expect(none["Paddle · webhook"]!.detail).toBe("No notification destination points to https://keepitall.example/api/webhooks/paddle.");
  });

  it("checks the client token matches the API key's environment", async () => {
    const sandbox = { ...env.paddle!, environment: "sandbox" as const };
    expect((await byService({ ...env, paddle: sandbox }, clients())).Paddle).toMatchObject({ status: "fail" });
    expect((await byService({ ...env, paddle: { ...sandbox, clientToken: "test_abc" } }, clients())).Paddle).toMatchObject({ status: "warn" });
    expect((await byService({ ...env, paddle: { ...env.paddle!, clientToken: null } }, clients())).Paddle).toMatchObject({ status: "fail" });
  });

  it("checks the Resend domain", async () => {
    const pending = await byService(env, clients({ resendDomains: vi.fn().mockResolvedValue([{ name: "keepitall.example", status: "pending" }]) }));
    expect(pending.Resend!.detail).toBe("Domain keepitall.example is pending; finish DNS verification.");
    const absent = await byService(env, clients({ resendDomains: vi.fn().mockResolvedValue([]) }));
    expect(absent.Resend).toMatchObject({ status: "fail" });
  });

  it("treats optional services as skipped and required ones as failed when unset", async () => {
    const bare: EnvSnapshot = { siteUrl: null, supabase: false, paddle: null, emailFrom: null, resend: false, anthropicModel: null, analyticsWebsiteId: null, cronSecretLength: 0 };
    const c = clients();
    const r = await byService(bare, c, null);
    expect(r["Site URL"]!.status).toBe("fail");
    expect(r.Supabase!.status).toBe("fail");
    expect(r.Paddle!.status).toBe("fail");
    expect(r.Resend!.status).toBe("warn");
    expect(r.Anthropic!.status).toBe("skip");
    expect(r.Umami!.status).toBe("skip");
    expect(r.Cron!.status).toBe("fail");
    expect(c.probeClaims).not.toHaveBeenCalled();
  });

  it("warns about a site URL that differs from where it's deployed, and short secrets", async () => {
    const r = await byService({ ...env, cronSecretLength: 8 }, clients(), "https://keepitall-git-main.vercel.app");
    expect(r["Site URL"]!.status).toBe("warn");
    expect(r.Cron!.status).toBe("warn");
    expect((await byService({ ...env, siteUrl: "http://keepitall.example" }, clients()))["Site URL"]!.status).toBe("fail");
  });

  it("reports API failures without leaking secrets", async () => {
    const r = await byService(env, clients({ anthropicModel: vi.fn().mockRejectedValue(new Error("404 model not found")) }));
    expect(r.Anthropic).toMatchObject({ status: "fail", detail: "Model claude-sonnet-5-5: 404 model not found" });
    expect(JSON.stringify(await runSetupChecks(env, clients()))).not.toMatch(/sk_|whsec_/);
  });
});

describe("emailDomain", () => {
  it.each([
    ["claims@keepitall.example", "keepitall.example"],
    ["KeepItAll <claims@Mail.KeepItAll.example>", "mail.keepitall.example"],
    ["not an email", null],
  ])("%s → %s", (from, domain) => {
    expect(emailDomain(from)).toBe(domain);
  });
});
