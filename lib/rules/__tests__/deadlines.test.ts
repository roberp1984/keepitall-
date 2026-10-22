import { describe, expect, it } from "vitest";
import { getDeadline, isDisplayable } from "@/lib/rules";
import { deadlines, type DeadlinesConfig } from "@/lib/rules/config";
import { addYears, daysBetween, parseIsoDate } from "@/lib/rules/dates";

const verifiedTable: DeadlinesConfig = {
  warnWithinDays: 180,
  jurisdictions: {
    SIX: { name: "Six years", years: 6, startsFrom: "flight_date", verified: true, source: "test", notes: "" },
    EOY: { name: "End of year + 3", years: 3, startsFrom: "end_of_year", verified: true, source: "test", notes: "" },
    UNV: { name: "Unverified", years: 2, startsFrom: "flight_date", verified: false, source: null, notes: "" },
  },
};

describe("getDeadline", () => {
  it("never exposes unverified entries", () => {
    const info = getDeadline("UNV", "2025-01-01", "2026-01-01", verifiedTable);
    expect(info).toEqual({ status: "unverified", jurisdiction: "UNV" });
    expect(isDisplayable(info)).toBe(false);
    expect(info).not.toHaveProperty("deadline");
  });

  it("reports unknown jurisdictions", () => {
    expect(getDeadline("XX", "2025-01-01", "2026-01-01", verifiedTable)).toEqual({
      status: "unknown_jurisdiction",
      jurisdiction: "XX",
    });
    expect(isDisplayable(null)).toBe(false);
  });

  it("counts from the flight date", () => {
    const info = getDeadline("SIX", "2025-03-10", "2026-03-10", verifiedTable);
    expect(info).toMatchObject({ status: "verified", deadline: "2031-03-10", expired: false, warn: false });
    expect(isDisplayable(info)).toBe(true);
  });

  it("counts from 31 December of the flight year", () => {
    expect(getDeadline("EOY", "2024-02-01", "2025-01-01", verifiedTable)).toMatchObject({
      deadline: "2027-12-31",
    });
  });

  it("warns within the configured window and flags expiry", () => {
    expect(getDeadline("SIX", "2020-06-01", "2026-01-01", verifiedTable)).toMatchObject({
      daysRemaining: 151,
      warn: true,
      expired: false,
    });
    expect(getDeadline("SIX", "2020-06-01", "2026-06-01", verifiedTable)).toMatchObject({
      daysRemaining: 0,
      expired: false,
    });
    expect(getDeadline("SIX", "2020-06-01", "2026-06-02", verifiedTable)).toMatchObject({
      daysRemaining: -1,
      expired: true,
    });
  });
});

describe("deadlines.json (launch guard)", () => {
  it("every verified entry has a source", () => {
    for (const [key, entry] of Object.entries(deadlines.jurisdictions)) {
      if (entry.verified) expect(entry.source, `${key} is verified without a source`).toBeTruthy();
    }
  });

  it("nothing is displayable until a human verifies it", () => {
    for (const key of Object.keys(deadlines.jurisdictions)) {
      const info = getDeadline(key, "2025-01-01", "2026-01-01");
      if (!deadlines.jurisdictions[key]!.verified) expect(isDisplayable(info)).toBe(false);
    }
  });

  it("has sane values", () => {
    for (const entry of Object.values(deadlines.jurisdictions)) {
      expect(Number.isInteger(entry.years) && entry.years > 0).toBe(true);
      expect(["flight_date", "end_of_year"]).toContain(entry.startsFrom);
    }
  });
});

describe("date helpers", () => {
  it("rejects malformed and impossible dates", () => {
    expect(() => parseIsoDate("2026-02-30")).toThrow(RangeError);
    expect(() => parseIsoDate("2026-2-3")).toThrow(RangeError);
    expect(() => parseIsoDate("not a date")).toThrow(RangeError);
  });

  it("maps 29 February to 28 February in non-leap years", () => {
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
  });

  it("counts days across DST and leap years", () => {
    expect(daysBetween("2024-01-01", "2025-01-01")).toBe(366);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});
