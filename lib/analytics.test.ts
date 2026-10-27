import { beforeEach, describe, expect, it, vi } from "vitest";
import { redactUrl } from "@/lib/analytics-path";

const win: { umami?: { track: ReturnType<typeof vi.fn> } } = {};
vi.stubGlobal("window", win);
const { flushAnalytics, track, trackPageview } = await import("@/lib/analytics");

/** Runs the payload function Umami would receive, with Umami's default props. */
const sent = (call: unknown[]) =>
  (call[0] as (p: Record<string, unknown>) => Record<string, unknown>)({
    website: "w",
    url: "/pack/SECRET_TOKEN?x=1",
    referrer: "https://www.tiktok.com/@keepitall/video/1?utm=a",
  });

describe("analytics", () => {
  beforeEach(() => {
    delete win.umami;
  });

  it("queues events until Umami loads, then sends them with redacted URLs", () => {
    track("pack_downloaded", { regime: "UK261" });
    trackPageview();
    const umami = { track: vi.fn() };
    win.umami = umami;
    flushAnalytics();

    expect(umami.track).toHaveBeenCalledTimes(2);
    expect(sent(umami.track.mock.calls[0]!)).toEqual({
      website: "w",
      url: "/pack/[id]",
      referrer: "https://www.tiktok.com/@keepitall/video/1",
      name: "pack_downloaded",
      data: { regime: "UK261" },
    });
    expect(sent(umami.track.mock.calls[1]!)).toMatchObject({ url: "/pack/[id]" });
    expect(sent(umami.track.mock.calls[1]!)).not.toHaveProperty("name");
  });

  it("sends straight away once Umami is ready", () => {
    const umami = { track: vi.fn() };
    win.umami = umami;
    track("check_started");
    expect(umami.track).toHaveBeenCalledTimes(1);
  });
});

describe("redactUrl", () => {
  it.each([
    ["/pack/abc123", "/pack/[id]"],
    ["/pack/abc123/pdf", "/pack/[id]/pdf"],
    ["/result/eyJhIjoxfQ?ref=x", "/result/[id]"],
    ["/check#step-3", "/check"],
    ["https://www.getkeepitall.com/pack/abc", "https://www.getkeepitall.com/pack/[id]"],
    ["", ""],
    [undefined, ""],
  ])("%s → %s", (input, expected) => {
    expect(redactUrl(input)).toBe(expected);
  });
});
