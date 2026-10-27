import { afterEach, describe, expect, it, vi } from "vitest";
import { trackServer } from "@/lib/analytics-server";

describe("trackServer", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is a no-op outside production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const fetchImpl = vi.fn();
    await trackServer("payment_succeeded", {}, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends an anonymous event to Umami in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}"));
    await trackServer("payment_succeeded", { regime: "UK261" }, fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://cloud.umami.is/api/send");
    expect(init.headers["User-Agent"]).toMatch(/Mozilla/);
    expect(JSON.parse(init.body)).toEqual({
      type: "event",
      payload: {
        website: "774a7126-36f2-4c88-908d-de459c5ad057",
        hostname: "www.getkeepitall.com",
        url: "/",
        language: "en",
        name: "payment_succeeded",
        data: { regime: "UK261" },
      },
    });
  });

  it("never throws", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(trackServer("payment_succeeded", {}, vi.fn().mockRejectedValue(new Error("network")))).resolves.toBeUndefined();
    await expect(trackServer("payment_succeeded", {}, vi.fn().mockResolvedValue(new Response("", { status: 500 })))).resolves.toBeUndefined();
  });
});
