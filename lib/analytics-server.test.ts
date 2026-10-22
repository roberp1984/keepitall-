import { afterEach, describe, expect, it, vi } from "vitest";
import { trackServer } from "@/lib/analytics-server";

describe("trackServer", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is a no-op without a PostHog key", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    await expect(trackServer("payment_succeeded", "claim-1")).resolves.toBeUndefined();
  });

  it("sends anonymous events without person profiles", async () => {
    const captureImmediate = vi.fn().mockResolvedValue(undefined);
    await trackServer("payment_succeeded", "claim-1", { regime: "UK261" }, { captureImmediate });
    expect(captureImmediate).toHaveBeenCalledWith({
      distinctId: "claim-1",
      event: "payment_succeeded",
      properties: { regime: "UK261", $process_person_profile: false },
    });
  });

  it("never throws", async () => {
    const captureImmediate = vi.fn().mockRejectedValue(new Error("network"));
    await expect(trackServer("payment_succeeded", "c", {}, { captureImmediate })).resolves.toBeUndefined();
  });
});
