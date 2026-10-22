import { describe, expect, it } from "vitest";
import { classifyReason, isReasonCode, REASON_CODES, strengthLabel } from "@/lib/rules";
import { reasons } from "@/lib/rules/config";

describe("classifyReason", () => {
  it.each([
    ["technical", "strong"],
    ["crew", "strong"],
    ["strike_airline_staff", "strong"],
    ["none", "strong"],
    ["knock_on", "disputed"],
    ["strike_unknown", "disputed"],
    ["other", "disputed"],
    ["weather", "weak"],
    ["atc", "weak"],
    ["security", "weak"],
    ["strike_third_party", "weak"],
    ["bird_strike", "weak"],
    ["medical_emergency", "weak"],
  ] as const)("%s → %s", (reason, strength) => {
    const result = classifyReason(reason);
    expect(result.reason).toBe(reason);
    expect(result.strength).toBe(strength);
    expect(result.rationale.length).toBeGreaterThan(10);
  });

  it("has a config entry for every reason code and no orphans", () => {
    expect(Object.keys(reasons).sort()).toEqual([...REASON_CODES].sort());
  });

  it("throws if the table is missing a reason", () => {
    expect(() => classifyReason("technical", {})).toThrow(/technical/);
  });
});

describe("isReasonCode", () => {
  it("accepts known codes and rejects others", () => {
    expect(isReasonCode("weather")).toBe(true);
    expect(isReasonCode("aliens")).toBe(false);
    expect(isReasonCode("")).toBe(false);
  });
});

describe("strengthLabel", () => {
  it("maps to result-screen wording", () => {
    expect(strengthLabel("strong")).toBe("strong");
    expect(strengthLabel("disputed")).toBe("possible");
    expect(strengthLabel("weak")).toBe("unlikely");
  });
});
