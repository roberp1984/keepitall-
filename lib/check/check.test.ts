import { describe, expect, it } from "vitest";
import { parseAnswers, type CheckAnswers } from "@/lib/check/answers";
import { carrierCountry, OTHER_CARRIER_COUNTRY, toClaimInput } from "@/lib/check/claim-input";
import { firstIncompleteStep, STEPS, validateStep } from "@/lib/check/steps";
import { decodeAnswers, encodeAnswers } from "@/lib/check/token";
import { assessClaim } from "@/lib/rules";

const TODAY = "2026-10-22";
const delayAnswers: CheckAnswers = {
  from: "LHR",
  to: "JFK",
  carrier: { kind: "airline", slug: "british-airways" },
  flightNumber: "BA117",
  date: "2026-06-15",
  what: "delay",
  delayMinutes: 300,
  reason: "technical",
  passengers: 2,
};

describe("token", () => {
  it("round-trips answers through a URL-safe token", () => {
    const token = encodeAnswers(delayAnswers);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeAnswers(token)).toEqual(delayAnswers);
  });

  it("handles non-ASCII safely", () => {
    const token = encodeAnswers({ ...delayAnswers, flightNumber: "BA117" });
    expect(decodeAnswers(token)?.flightNumber).toBe("BA117");
  });

  it.each(["", "!!!", "not-base64-json", encodeAnswers({ ...delayAnswers, passengers: 0 }), "a".repeat(5000)])(
    "rejects invalid token %#",
    (token) => {
      expect(decodeAnswers(token)).toBeNull();
    },
  );
});

describe("parseAnswers", () => {
  it.each([
    ["same airports", { to: "LHR" }],
    ["lowercase IATA", { from: "lhr" }],
    ["bad carrier", { carrier: { kind: "airline", slug: "../etc" } }],
    ["bad region", { carrier: { kind: "region", region: "mars" } }],
    ["bad flight number", { flightNumber: "hello" }],
    ["bad date", { date: "2026-13-01" }],
    ["unknown reason", { reason: "aliens" }],
    ["too many passengers", { passengers: 10 }],
    ["missing delay", { delayMinutes: undefined }],
    ["negative delay", { delayMinutes: -5 }],
    ["fractional delay", { delayMinutes: 3.5 }],
  ])("rejects %s", (_label, overrides) => {
    expect(parseAnswers({ ...delayAnswers, ...overrides })).toBeNull();
  });

  it("requires notice and rerouting details for cancellations", () => {
    const base = { ...delayAnswers, what: "cancellation", delayMinutes: undefined };
    expect(parseAnswers(base)).toBeNull();
    expect(parseAnswers({ ...base, noticeDays: 3 })).toBeNull();
    expect(parseAnswers({ ...base, noticeDays: 3, rerouted: false })).toMatchObject({ noticeDays: 3, rerouted: false });
    expect(parseAnswers({ ...base, noticeDays: 3, rerouted: true })).toBeNull();
    expect(parseAnswers({ ...base, noticeDays: 3, rerouted: true, reroutedDelayMinutes: 150 })).toMatchObject({
      reroutedDelayMinutes: 150,
      reroutedEarlierMinutes: 0,
    });
  });

  it("requires the volunteered answer for denied boarding", () => {
    const base = { ...delayAnswers, what: "denied_boarding", delayMinutes: undefined, rerouted: false };
    expect(parseAnswers(base)).toBeNull();
    expect(parseAnswers({ ...base, volunteered: false })).toMatchObject({ volunteered: false });
  });

  it("drops fields that don't belong to the disruption kind", () => {
    expect(parseAnswers({ ...delayAnswers, noticeDays: 3, volunteered: true })).toEqual(delayAnswers);
  });
});

describe("validateStep", () => {
  it("passes every step for complete answers", () => {
    for (const step of STEPS) expect(validateStep(step, delayAnswers, TODAY), step).toBeNull();
    expect(firstIncompleteStep(delayAnswers, TODAY)).toBeNull();
  });

  it("guides the user through missing answers in order", () => {
    expect(firstIncompleteStep({}, TODAY)).toBe("from");
    expect(firstIncompleteStep({ from: "LHR" }, TODAY)).toBe("to");
    expect(validateStep("to", { from: "LHR", to: "LHR" }, TODAY)).toMatch(/different/);
    expect(validateStep("flight", { flightNumber: "BA117", date: "2027-01-01" }, TODAY)).toMatch(/future/);
    expect(validateStep("flight", { flightNumber: "?", date: "2026-01-01" }, TODAY)).toMatch(/flight number/);
  });

  it("asks the right detail questions per disruption", () => {
    expect(validateStep("details", { what: "delay" }, TODAY)).toMatch(/how late/);
    expect(validateStep("details", { what: "cancellation" }, TODAY)).toMatch(/notice/);
    expect(validateStep("details", { what: "cancellation", noticeDays: 2 }, TODAY)).toMatch(/another flight/);
    expect(validateStep("details", { what: "cancellation", noticeDays: 2, rerouted: true }, TODAY)).toMatch(/replacement/);
    expect(validateStep("details", { what: "cancellation", noticeDays: 2, rerouted: false }, TODAY)).toBeNull();
    expect(validateStep("details", { what: "denied_boarding" }, TODAY)).toMatch(/volunteer/);
  });
});

describe("toClaimInput", () => {
  it("resolves airports and the airline's licensing country", () => {
    const input = toClaimInput(delayAnswers, TODAY)!;
    expect(input.departure.iata).toBe("LHR");
    expect(input.operatingCarrierCountry).toBe("GB");
    expect(input.disruption).toEqual({ kind: "delay", arrivalDelayMinutes: 300 });
    expect(assessClaim(input).perPassenger?.amount).toBe(520);
  });

  it("maps 'airline not listed' regions onto the right scope groups", () => {
    expect(carrierCountry({ kind: "region", region: "other" })).toBe(OTHER_CARRIER_COUNTRY);
    const inbound = (region: "eu" | "eea_ch" | "uk" | "other", to: string) =>
      assessClaim(toClaimInput({ ...delayAnswers, from: "JFK", to, carrier: { kind: "region", region } }, TODAY)!).regime;
    expect(inbound("eu", "CDG")).toBe("EU261");
    expect(inbound("eea_ch", "CDG")).toBe("EU261");
    expect(inbound("eu", "LHR")).toBe("UK261");
    expect(inbound("eea_ch", "LHR")).toBeNull();
    expect(inbound("uk", "LHR")).toBe("UK261");
    expect(inbound("other", "CDG")).toBeNull();
  });

  it("builds cancellation and denied-boarding disruptions", () => {
    const cancel = toClaimInput(
      { ...delayAnswers, what: "cancellation", delayMinutes: undefined, noticeDays: 2, rerouted: true, reroutedDelayMinutes: 150, reroutedEarlierMinutes: 30 },
      TODAY,
    )!;
    expect(cancel.disruption).toEqual({
      kind: "cancellation",
      noticeDays: 2,
      rerouting: { arrivalDelayMinutes: 150, departureEarlierMinutes: 30 },
    });
    const denied = toClaimInput({ ...delayAnswers, what: "denied_boarding", volunteered: false, rerouted: false }, TODAY)!;
    expect(denied.disruption).toEqual({ kind: "denied_boarding", voluntary: false, rerouting: null });
  });

  it("returns null for unknown airports or airlines", () => {
    expect(toClaimInput({ ...delayAnswers, from: "ZZZ" }, TODAY)).toBeNull();
    expect(toClaimInput({ ...delayAnswers, carrier: { kind: "airline", slug: "nope" } }, TODAY)).toBeNull();
  });
});

describe("carrierName", () => {
  it("uses the airline name, or 'your airline' when it isn't listed", async () => {
    const { carrierName } = await import("@/lib/check/claim-input");
    expect(carrierName({ kind: "airline", slug: "ryanair" })).toBe("Ryanair");
    expect(carrierName({ kind: "region", region: "other" })).toBe("your airline");
  });
});
