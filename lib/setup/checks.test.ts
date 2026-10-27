import { describe, expect, it, vi } from "vitest";
import { emailDomain, runSetupChecks, type EnvSnapshot, type SetupClients } from "@/lib/setup/checks";

const env: EnvSnapshot = {
  siteUrl: "https://keepitall.example",
  supabase: true,
  stripe: { mode: "live", priceIds: { EUR: "price_eur", GBP: "price_gbp" }, webhookSecret: true, automaticTax: false },
  emailFrom: "KeepItAll <claims@keepitall.example>",
  resend: true,
  anthropicModel: "claude-sonnet-5-5",
  analyticsWebsiteId: "774a7126-36f2-4c88-908d-de459c5ad057",
  cronSecretLength: 64,
};

function clients(overrides: Partial<SetupClients> = {}): SetupClients {
  return {
    probeClaims: vi.fn().mockResolvedValue(null),
    stripePrice: vi.fn(async (id: string) =>
      id === "price_eur"
        ? { name: "EU261 claim", amountCents: 1900, currency: "EUR", active: true, recurring: false, taxBehavior: "inclusive" }
        : { name: "UK261 claim", amountCents: 1800, currency: "EUR", active: true, recurring: false, taxBehavior: "inclusive" },
    ),
    stripeWebhooks: vi.fn().mockResolvedValue([
      {
        url: "https://keepitall.example/api/webhooks/stripe",
        events: ["checkout.session.completed", "checkout.session.async_payment_succeeded", "charge.refunded"],
        enabled: true,
      },
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
      Stripe: "ok",
      "Stripe · EUR price": "ok",
      "Stripe · GBP price": "ok",
      "Stripe · webhook": "ok",
      Resend: "ok",
      Anthropic: "ok",
      Umami: "ok",
      Cron: "ok",
    });
    expect(r["Stripe · GBP price"]!.detail).toBe("Price “UK261 claim” charges 18.00 EUR, matching the site.");
  });

  it("points to the right migration when tables or columns are missing", async () => {
    const missingTable = await byService(env, clients({ probeClaims: vi.fn().mockResolvedValue("relation does not exist") }));
    expect(missingTable.Supabase).toMatchObject({ status: "fail" });
    expect(missingTable.Supabase!.detail).toContain("20261022000000_init.sql");

    const probe = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("column claims.followups does not exist");
    const missingColumns = await byService(env, clients({ probeClaims: probe }));
    expect(missingColumns.Supabase!.detail).toContain("20261022010000_lifecycle.sql");
  });

  it("flags wrong, archived, recurring or tax-exclusive prices and webhook problems", async () => {
    const r = await byService(
      env,
      clients({
        stripePrice: vi.fn(async (id: string) =>
          id === "price_eur"
            ? { name: "EU261 claim", amountCents: 2500, currency: "EUR", active: true, recurring: false, taxBehavior: "inclusive" }
            : { name: "UK261 claim", amountCents: 1800, currency: "EUR", active: false, recurring: false, taxBehavior: "inclusive" },
        ),
        stripeWebhooks: vi.fn().mockResolvedValue([{ url: "https://keepitall.example/api/webhooks/stripe", events: ["checkout.session.completed"], enabled: true }]),
      }),
    );
    expect(r["Stripe · EUR price"]).toMatchObject({ status: "fail" });
    expect(r["Stripe · EUR price"]!.detail).toContain("the site shows 19.00 EUR");
    expect(r["Stripe · GBP price"]).toMatchObject({ status: "fail", detail: "Price “UK261 claim” is archived; activate it." });
    expect(r["Stripe · webhook"]).toMatchObject({
      status: "fail",
      detail: "Endpoint is missing events: checkout.session.async_payment_succeeded, charge.refunded.",
    });

    const recurring = await byService(
      env,
      clients({ stripePrice: vi.fn().mockResolvedValue({ name: "Sub", amountCents: 1900, currency: "EUR", active: true, recurring: true, taxBehavior: "inclusive" }) }),
    );
    expect(recurring["Stripe · EUR price"]!.detail).toContain("must be one-time");

    const exclusive = clients({ stripePrice: vi.fn().mockResolvedValue({ name: "P", amountCents: 1900, currency: "EUR", active: true, recurring: false, taxBehavior: "exclusive" }) });
    expect((await byService({ ...env, stripe: { ...env.stripe!, automaticTax: true } }, exclusive))["Stripe · EUR price"]!.detail).toContain("tax-inclusive");

    const allEvents = await byService(env, clients({ stripeWebhooks: vi.fn().mockResolvedValue([{ url: "https://keepitall.example/api/webhooks/stripe", events: ["*"], enabled: true }]) }));
    expect(allEvents["Stripe · webhook"]!.status).toBe("ok");

    const none = await byService(env, clients({ stripeWebhooks: vi.fn().mockResolvedValue([]) }));
    expect(none["Stripe · webhook"]!.detail).toBe("No webhook endpoint points to https://keepitall.example/api/webhooks/stripe.");
  });

  it("warns that a test-mode key only takes test payments", async () => {
    expect((await byService({ ...env, stripe: { ...env.stripe!, mode: "test" } }, clients())).Stripe).toMatchObject({ status: "warn" });
  });

  it("checks the Resend domain", async () => {
    const pending = await byService(env, clients({ resendDomains: vi.fn().mockResolvedValue([{ name: "keepitall.example", status: "pending" }]) }));
    expect(pending.Resend!.detail).toBe("Domain keepitall.example is pending; finish DNS verification.");
    const absent = await byService(env, clients({ resendDomains: vi.fn().mockResolvedValue([]) }));
    expect(absent.Resend).toMatchObject({ status: "fail" });
  });

  it("treats optional services as skipped and required ones as failed when unset", async () => {
    const bare: EnvSnapshot = { siteUrl: null, supabase: false, stripe: null, emailFrom: null, resend: false, anthropicModel: null, analyticsWebsiteId: null, cronSecretLength: 0 };
    const c = clients();
    const r = await byService(bare, c, null);
    expect(r["Site URL"]!.status).toBe("fail");
    expect(r.Supabase!.status).toBe("fail");
    expect(r.Stripe!.status).toBe("fail");
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
