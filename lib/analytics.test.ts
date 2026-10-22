import { describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: posthog }));
vi.stubGlobal("window", {});
const { initAnalytics, track } = await import("@/lib/analytics");

describe("analytics", () => {
  it("does nothing until initialised, and without a key", () => {
    track("check_started");
    initAnalytics(undefined, undefined);
    track("check_started");
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("initialises once with privacy-first settings, then captures", () => {
    initAnalytics("phc_test", undefined);
    initAnalytics("phc_test", undefined);
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init.mock.calls[0]![1]).toMatchObject({
      api_host: "https://eu.i.posthog.com",
      cookieless_mode: "always",
      persistence: "memory",
      person_profiles: "never",
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
    });
    track("result_eligible", { regime: "UK261" });
    expect(posthog.capture).toHaveBeenCalledWith("result_eligible", { regime: "UK261" });
  });
});
