import { describe, expect, it, vi } from "vitest";
import { emailDomain, runSetupChecks, type EnvSnapshot, type SetupClients } from "@/lib/setup/checks";

const env: EnvSnapshot = {
  siteUrl: "https://keepitall.example",
  supabase: true,
  lemon: { storeId: "1", variantIds: { EUR: "10", GBP: "20" }, webhookSecret: true },
  emailFrom: "KeepItAll <claims@keepitall.example>",
  resend: true,
  anthropicModel: "claude-sonnet-5-5",
  posthogKey: "phc_abc",
  cronSecretLength: 64,
};

function clients(overrides: Partial<SetupClients> = {}): SetupClients {
  return {
    probeClaims: vi.fn().mockResolvedValue(null),
    lemonStore: vi.fn().mockResolvedValue({ name: "KeepItAll", currency: "EUR" }),
    lemonVariant: vi.fn(async (id: string) =>
      id === "10" ? { name: "EUR pack", price: 1900, status: "published" } : { name: "GBP pack", price: 2000, status: "published" },
    ),
    lemonWebhooks: vi.fn().mockResolvedValue([
      { url: "https://keepitall.example/api/webhooks/lemonsqueezy", events: ["order_created", "order_refunded"], testMode: true },
    ]),
    resendDomains: vi.fn().mockResolvedValue([{ name: "keepitall.example", status: "verified" }]),
    anthropicModel: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const byService = async (e: EnvSnapshot, c: SetupClients, origin: string | null = "https://keepitall.example") =>
  Object.fromEntries((await runSetupChecks(e, c, origin)).map((r) => [r.service, r]));

describe("runSetupChecks", () => {
  it("passes a fully configured setup, and warns that a EUR store can't charge exactly £17", async () => {
    const r = await byService(env, clients());
    expect(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.status]))).toEqual({
      "Site URL": "ok",
      Supabase: "ok",
      "Lemon Squeezy": "ok",
      "Lemon Squeezy · EUR price": "ok",
      "Lemon Squeezy · GBP price": "warn",
      "Lemon Squeezy · webhook": "ok",
      Resend: "ok",
      Anthropic: "ok",
      PostHog: "ok",
      Cron: "ok",
    });
    expect(r["Lemon Squeezy · GBP price"]!.detail).toContain("charges 20.00 EUR");
    expect(r["Lemon Squeezy · webhook"]!.detail).toContain("(test mode)");
  });

  it("points to the right migration when tables or columns are missing", async () => {
    const missingTable = await byService(env, clients({ probeClaims: vi.fn().mockResolvedValue("relation does not exist") }));
    expect(missingTable.Supabase).toMatchObject({ status: "fail" });
    expect(missingTable.Supabase!.detail).toContain("20261022000000_init.sql");

    const probe = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("column claims.followups does not exist");
    const missingColumns = await byService(env, clients({ probeClaims: probe }));
    expect(missingColumns.Supabase!.detail).toContain("20261022010000_lifecycle.sql");
  });

  it("flags wrong prices, unpublished variants and webhook problems", async () => {
    const r = await byService(
      env,
      clients({
        lemonVariant: vi.fn(async (id: string) =>
          id === "10" ? { name: "EUR pack", price: 2500, status: "published" } : { name: "GBP pack", price: 2000, status: "draft" },
        ),
        lemonWebhooks: vi.fn().mockResolvedValue([{ url: "https://keepitall.example/api/webhooks/lemonsqueezy", events: ["order_created"], testMode: false }]),
      }),
    );
    expect(r["Lemon Squeezy · EUR price"]).toMatchObject({ status: "warn" });
    expect(r["Lemon Squeezy · EUR price"]!.detail).toContain("advertises 19 EUR");
    expect(r["Lemon Squeezy · GBP price"]).toMatchObject({ status: "fail" });
    expect(r["Lemon Squeezy · webhook"]).toMatchObject({ status: "fail", detail: "Webhook is missing events: order_refunded." });

    const none = await byService(env, clients({ lemonWebhooks: vi.fn().mockResolvedValue([]) }));
    expect(none["Lemon Squeezy · webhook"]!.detail).toBe("No webhook points to https://keepitall.example/api/webhooks/lemonsqueezy.");
  });

  it("stops Lemon checks if the store can't be loaded", async () => {
    const r = await runSetupChecks(env, clients({ lemonStore: vi.fn().mockRejectedValue(new Error("401 Unauthenticated")) }));
    const lemon = r.filter((x) => x.service.startsWith("Lemon"));
    expect(lemon).toEqual([{ service: "Lemon Squeezy", status: "fail", detail: "Can't load store 1: 401 Unauthenticated" }]);
  });

  it("checks the Resend domain", async () => {
    const pending = await byService(env, clients({ resendDomains: vi.fn().mockResolvedValue([{ name: "keepitall.example", status: "pending" }]) }));
    expect(pending.Resend!.detail).toBe("Domain keepitall.example is pending; finish DNS verification.");
    const absent = await byService(env, clients({ resendDomains: vi.fn().mockResolvedValue([]) }));
    expect(absent.Resend).toMatchObject({ status: "fail" });
  });

  it("treats optional services as skipped and required ones as failed when unset", async () => {
    const bare: EnvSnapshot = { siteUrl: null, supabase: false, lemon: null, emailFrom: null, resend: false, anthropicModel: null, posthogKey: null, cronSecretLength: 0 };
    const c = clients();
    const r = await byService(bare, c, null);
    expect(r["Site URL"]!.status).toBe("fail");
    expect(r.Supabase!.status).toBe("fail");
    expect(r["Lemon Squeezy"]!.status).toBe("fail");
    expect(r.Resend!.status).toBe("warn");
    expect(r.Anthropic!.status).toBe("skip");
    expect(r.PostHog!.status).toBe("skip");
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
    expect(JSON.stringify(await runSetupChecks(env, clients()))).not.toMatch(/phc_abc/);
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
