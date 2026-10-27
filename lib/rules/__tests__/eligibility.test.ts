import { describe, expect, it } from "vitest";
import { assessClaim, RulesInputError, type Disruption } from "@/lib/rules";
import { airport, CARRIER, claim, delay } from "./helpers";

const cancelled = (noticeDays: number, rerouting: { arrivalDelayMinutes: number; departureEarlierMinutes?: number } | null): Disruption => ({
  kind: "cancellation",
  noticeDays,
  rerouting,
});

describe("every compensation band — full amount (arrival delay ≥ 3h)", () => {
  it.each([
    // [from, to, carrier, regime, band, amount, currency, note]
    ["CDG", "BCN", CARRIER.airFrance, "EU261", "short", 250, "EUR", "≤1,500 km"],
    ["BCN", "ATH", CARRIER.airFrance, "EU261", "medium", 400, "EUR", "intra-EU 1,500–3,500 km"],
    ["FRA", "IST", CARRIER.turkishAirlines, "EU261", "medium", 400, "EUR", "EU → non-EU 1,500–3,500 km"],
    ["FRA", "DXB", CARRIER.emirates, "EU261", "long", 600, "EUR", ">3,500 km, non-EU airline"],
    ["DXB", "FRA", CARRIER.lufthansa, "EU261", "long", 600, "EUR", "inbound on EU carrier"],
    ["HEL", "TFS", CARRIER.norwegian, "EU261", "medium", 400, "EUR", "intra-EU >3,500 km (Canaries) stays €400"],
    ["CDG", "RUN", CARRIER.airFrance, "EU261", "medium", 400, "EUR", "intra-EU >3,500 km (Réunion) stays €400"],
    ["CDG", "PTP", CARRIER.airFrance, "EU261", "medium", 400, "EUR", "intra-EU >3,500 km (Guadeloupe) stays €400"],
    ["JFK", "ZRH", CARRIER.swiss, "EU261", "long", 600, "EUR", "inbound on Swiss carrier"],
    ["LHR", "CDG", CARRIER.britishAirways, "UK261", "short", 220, "GBP", "≤1,500 km"],
    ["EDI", "LHR", CARRIER.britishAirways, "UK261", "short", 220, "GBP", "domestic"],
    ["LHR", "ATH", CARRIER.britishAirways, "UK261", "medium", 350, "GBP", "1,500–3,500 km"],
    ["STN", "AGP", CARRIER.easyJetUK, "UK261", "medium", 350, "GBP", "1,500–3,500 km"],
    ["LHR", "JFK", CARRIER.americanAirlines, "UK261", "long", 520, "GBP", ">3,500 km, non-UK airline"],
    ["JFK", "LHR", CARRIER.britishAirways, "UK261", "long", 520, "GBP", "inbound on UK carrier"],
    ["LHR", "CAI", CARRIER.britishAirways, "UK261", "long", 520, "GBP", "just over 3,500 km"],
  ] as const)("%s → %s: %s %s band = %d %s (%s)", (from, to, carrier, regime, band, amount, currency, _note) => {
    const result = assessClaim(claim(from, to, carrier, delay(4, 30)));
    expect(result.outcome).toBe("eligible");
    expect(result.regime).toBe(regime);
    expect(result.band).toBe(band);
    expect(result.perPassenger).toEqual({ currency, band, fullAmount: amount, amount, reduced: false });
    expect(result.total).toBe(amount);
    expect(result.codes).not.toContain("REDUCED_ART_7_2");
  });

  it("uses EU261 euros for UK flights before 2021", () => {
    const result = assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(5), { flightDate: "2020-12-15" }));
    expect(result.regime).toBe("EU261");
    expect(result.rulesetVersion).toBe("ec-261-2004-pre-brexit");
    expect(result.perPassenger).toMatchObject({ currency: "EUR", amount: 600 });
  });
});

describe("delay threshold", () => {
  it("2h59 is not eligible, 3h00 is", () => {
    const under = assessClaim(claim("CDG", "BCN", CARRIER.airFrance, delay(2, 59)));
    expect(under.outcome).toBe("not_eligible");
    expect(under.codes).toContain("DELAY_BELOW_THRESHOLD");
    expect(under.perPassenger).toBeNull();
    expect(under.total).toBeNull();
    expect(under.regime).toBe("EU261");

    const at = assessClaim(claim("CDG", "BCN", CARRIER.airFrance, delay(3)));
    expect(at.outcome).toBe("eligible");
    expect(at.perPassenger?.amount).toBe(250);
  });

  it("no delay at all is not eligible", () => {
    expect(assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(0))).outcome).toBe("not_eligible");
  });
});

describe("50% reduction — Art. 7(2)", () => {
  describe("long-haul delays between 3h and 4h (Sturgeon)", () => {
    it.each([
      [3, 0, 300, true],
      [3, 59, 300, true],
      [4, 0, 300, true],
      [4, 1, 600, false],
      [8, 0, 600, false],
    ])("EU261 FRA→DXB delayed %ih%im → €%d", (h, m, amount, reduced) => {
      const result = assessClaim(claim("FRA", "DXB", CARRIER.emirates, delay(h, m)));
      expect(result.perPassenger).toMatchObject({ amount, fullAmount: 600, reduced });
      expect(result.codes.includes("REDUCED_ART_7_2")).toBe(reduced);
    });

    it("UK261 LHR→JFK delayed 3h30 → £260", () => {
      expect(assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(3, 30))).perPassenger).toMatchObject({
        amount: 260,
        fullAmount: 520,
        reduced: true,
      });
    });

    it("short and medium delays ≥3h are never reduced", () => {
      expect(assessClaim(claim("CDG", "BCN", CARRIER.airFrance, delay(3))).perPassenger?.reduced).toBe(false);
      // Exactly 3h00 on a medium flight: full €400 / £350, not reduced
      expect(assessClaim(claim("BCN", "ATH", CARRIER.airFrance, delay(3))).perPassenger).toMatchObject({ amount: 400, reduced: false });
      expect(assessClaim(claim("LHR", "ATH", CARRIER.britishAirways, delay(3))).perPassenger).toMatchObject({ amount: 350, reduced: false });
      // Intra-EU >3,500 km uses the medium band's 3h limit, so 3h30 is not reduced
      expect(assessClaim(claim("CDG", "RUN", CARRIER.airFrance, delay(3, 30))).perPassenger).toMatchObject({
        amount: 400,
        reduced: false,
      });
    });
  });

  describe("cancellation with rerouting (notice < 7 days, so not exempt)", () => {
    it.each([
      // short band: limit 2h. Arrival exactly 2h late is not exempt (needs < 2h) but is reduced (≤ 2h).
      ["CDG", "BCN", CARRIER.airFrance, 120, 125, true],
      ["CDG", "BCN", CARRIER.airFrance, 121, 250, false],
      // medium band: limit 3h
      ["BCN", "ATH", CARRIER.airFrance, 180, 200, true],
      ["BCN", "ATH", CARRIER.airFrance, 181, 400, false],
      // long band: limit 4h
      ["FRA", "DXB", CARRIER.emirates, 240, 300, true],
      ["FRA", "DXB", CARRIER.emirates, 241, 600, false],
      // UK261 bands
      ["LHR", "CDG", CARRIER.britishAirways, 120, 110, true],
      ["LHR", "ATH", CARRIER.britishAirways, 150, 175, true],
      ["LHR", "ATH", CARRIER.britishAirways, 200, 350, false],
      ["LHR", "JFK", CARRIER.britishAirways, 230, 260, true],
      ["LHR", "JFK", CARRIER.britishAirways, 300, 520, false],
    ] as const)("%s→%s rerouted, arriving %i min late → %d", (from, to, carrier, lateMinutes, amount, reduced) => {
      const result = assessClaim(
        claim(from, to, carrier, cancelled(2, { arrivalDelayMinutes: lateMinutes, departureEarlierMinutes: 0 })),
      );
      expect(result.outcome).toBe("eligible");
      expect(result.perPassenger?.amount).toBe(amount);
      expect(result.perPassenger?.reduced).toBe(reduced);
    });
  });

  it("applies to denied boarding with rerouting", () => {
    const result = assessClaim(
      claim("CDG", "BCN", CARRIER.airFrance, { kind: "denied_boarding", voluntary: false, rerouting: { arrivalDelayMinutes: 90 } }),
    );
    expect(result.perPassenger).toMatchObject({ amount: 125, reduced: true });
  });

  it("does not apply to cancellations without rerouting", () => {
    expect(assessClaim(claim("FRA", "DXB", CARRIER.emirates, cancelled(1, null))).perPassenger).toMatchObject({
      amount: 600,
      reduced: false,
    });
  });

  it("multiplies the reduced amount by passengers", () => {
    const result = assessClaim(claim("FRA", "DXB", CARRIER.emirates, delay(3, 30), { passengers: 3 }));
    expect(result.total).toBe(900);
  });
});

describe("cancellation notice exemptions — Art. 5(1)(c)", () => {
  it("≥14 days' notice: no compensation, even without rerouting", () => {
    for (const days of [14, 30]) {
      const result = assessClaim(claim("CDG", "BCN", CARRIER.airFrance, cancelled(days, null)));
      expect(result.outcome).toBe("not_eligible");
      expect(result.codes).toContain("CANCELLATION_NOTICE_SUFFICIENT");
    }
  });

  it("13 days' notice, no rerouting: compensation due", () => {
    expect(assessClaim(claim("CDG", "BCN", CARRIER.airFrance, cancelled(13, null))).outcome).toBe("eligible");
  });

  describe("7–13 days: exempt if rerouted leaving ≤2h early and arriving <4h late", () => {
    it.each([
      [7, 120, 239, false],
      [13, 0, 0, false],
      [10, 121, 60, true],
      [10, 60, 240, true],
    ])("notice %i d, left %i min early, arrived %i min late → entitled %s", (days, early, late, entitled) => {
      const result = assessClaim(
        claim("FRA", "DXB", CARRIER.emirates, cancelled(days, { arrivalDelayMinutes: late, departureEarlierMinutes: early })),
      );
      expect(result.outcome).toBe(entitled ? "eligible" : "not_eligible");
      if (!entitled) expect(result.codes).toContain("CANCELLATION_REROUTING_EXEMPT");
    });
  });

  describe("<7 days: exempt if rerouted leaving ≤1h early and arriving <2h late", () => {
    it.each([
      [0, 60, 119, false],
      [6, 0, 30, false],
      [6, 61, 30, true],
      [6, 0, 120, true],
      [6, 0, 180, true],
    ])("notice %i d, left %i min early, arrived %i min late → entitled %s", (days, early, late, entitled) => {
      const result = assessClaim(
        claim("CDG", "BCN", CARRIER.airFrance, cancelled(days, { arrivalDelayMinutes: late, departureEarlierMinutes: early })),
      );
      expect(result.outcome).toBe(entitled ? "eligible" : "not_eligible");
    });
  });

  it("assumes the rerouted flight did not leave early when unknown, and says so", () => {
    const exempt = assessClaim(claim("CDG", "BCN", CARRIER.airFrance, cancelled(3, { arrivalDelayMinutes: 60 })));
    expect(exempt.outcome).toBe("not_eligible");

    const due = assessClaim(claim("CDG", "BCN", CARRIER.airFrance, cancelled(3, { arrivalDelayMinutes: 150 })));
    expect(due.outcome).toBe("eligible");
    expect(due.codes).toContain("REROUTED_DEPARTURE_TIME_ASSUMED");
  });

  it("rerouting that arrives early is exempt", () => {
    const result = assessClaim(
      claim("CDG", "BCN", CARRIER.airFrance, cancelled(3, { arrivalDelayMinutes: -30, departureEarlierMinutes: 45 })),
    );
    expect(result.outcome).toBe("not_eligible");
  });
});

describe("denied boarding", () => {
  it("involuntary: full compensation and a strong case regardless of stated reason", () => {
    const result = assessClaim(
      claim("LHR", "JFK", CARRIER.britishAirways, { kind: "denied_boarding", voluntary: false, rerouting: null }, { reason: "weather" }),
    );
    expect(result.outcome).toBe("eligible");
    expect(result.perPassenger?.amount).toBe(520);
    expect(result.strength).toBe("strong");
  });

  it("voluntary: no compensation", () => {
    const result = assessClaim(
      claim("LHR", "JFK", CARRIER.britishAirways, { kind: "denied_boarding", voluntary: true, rerouting: null }),
    );
    expect(result.outcome).toBe("not_eligible");
    expect(result.codes).toContain("DENIED_BOARDING_VOLUNTARY");
  });
});

describe("case strength from the airline's stated reason", () => {
  it.each([
    ["technical", "strong"],
    ["crew", "strong"],
    ["strike_airline_staff", "strong"],
    ["none", "strong"],
    ["other", "disputed"],
    ["weather", "weak"],
    ["atc", "weak"],
    ["strike_third_party", "weak"],
  ] as const)("%s → %s, while the amount is unchanged", (reason, strength) => {
    const result = assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(5), { reason }));
    expect(result.outcome).toBe("eligible");
    expect(result.perPassenger?.amount).toBe(520);
    expect(result.strength).toBe(strength);
    expect(result.strengthRationale).toBeTruthy();
  });

  it("is not set when not eligible", () => {
    expect(assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(1))).strength).toBeNull();
  });
});

describe("double coverage", () => {
  it("UK → EU on an EU carrier uses UK261 and notes EU261", () => {
    const result = assessClaim(claim("LHR", "CDG", CARRIER.airFrance, delay(4)));
    expect(result.regime).toBe("UK261");
    expect(result.scopeBasis).toBe("departure");
    expect(result.alsoCoveredBy).toEqual(["EU261"]);
    expect(result.codes).toContain("ALSO_COVERED_BY_OTHER_REGIME");
    expect(result.perPassenger).toMatchObject({ currency: "GBP", amount: 220 });
  });

  it("EU → UK on a UK carrier uses EU261 and notes UK261", () => {
    const result = assessClaim(claim("CDG", "LHR", CARRIER.britishAirways, delay(4)));
    expect(result.regime).toBe("EU261");
    expect(result.alsoCoveredBy).toEqual(["UK261"]);
    expect(result.perPassenger).toMatchObject({ currency: "EUR", amount: 250 });
  });
});

describe("not covered", () => {
  it.each([
    ["DXB", "FRA", CARRIER.emirates, "non-EU airline into the EU"],
    ["JFK", "LHR", CARRIER.americanAirlines, "non-UK/EU airline into the UK"],
    ["JFK", "DXB", CARRIER.lufthansa, "EU airline between two non-EU airports"],
    ["FAE", "CPH", CARRIER.atlanticAirways, "Faroese airline from the Faroes"],
    ["JER", "GCI", CARRIER.blueIslands, "within the Channel Islands"],
  ])("%s → %s (carrier %s): %s", (from, to, carrier, _label) => {
    const result = assessClaim(claim(from, to, carrier, delay(6)));
    expect(result).toMatchObject({
      outcome: "not_covered",
      codes: ["NOT_COVERED"],
      regime: null,
      perPassenger: null,
      total: null,
      strength: null,
      alternatives: ["MONTREAL_CONVENTION", "REFUND_RIGHTS"],
    });
  });

  it("an EU carrier inbound is not covered if third-country benefits were already received", () => {
    const result = assessClaim(claim("DXB", "FRA", CARRIER.lufthansa, delay(6), { receivedBenefitsInThirdCountry: true }));
    expect(result.outcome).toBe("not_covered");
  });
});

describe("passengers and totals", () => {
  it.each([
    [1, 400],
    [2, 800],
    [4, 1600],
  ])("%i passengers → €%d", (passengers, total) => {
    expect(assessClaim(claim("BCN", "ATH", CARRIER.airFrance, delay(5), { passengers })).total).toBe(total);
  });
});

describe("deadline passthrough", () => {
  it("attaches the deadline for the jurisdiction", () => {
    const result = assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(5), { jurisdiction: "GB-ENG", today: "2026-10-22" }));
    expect(result.deadline).toMatchObject({ status: "verified", jurisdiction: "GB-ENG", deadline: "2032-06-15" });
  });

  it("keeps unverified jurisdictions hidden", () => {
    const result = assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(5), { jurisdiction: "IT", today: "2026-10-22" }));
    expect(result.deadline).toEqual({ status: "unverified", jurisdiction: "IT" });
  });

  it("is null without a jurisdiction", () => {
    expect(assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(5))).deadline).toBeNull();
  });
});

describe("input validation", () => {
  const base = () => claim("CDG", "BCN", CARRIER.airFrance, delay(4));

  it.each([
    ["zero passengers", { passengers: 0 }],
    ["fractional passengers", { passengers: 1.5 }],
    ["bad date", { flightDate: "15/06/2026" }],
    ["impossible date", { flightDate: "2026-02-30" }],
    ["bad today", { today: "yesterday" }],
    ["unknown reason", { reason: "aliens" as never }],
    ["negative delay", { disruption: delay(-1) }],
    ["NaN delay", { disruption: { kind: "delay", arrivalDelayMinutes: Number.NaN } as Disruption }],
    ["negative notice", { disruption: cancelled(-1, null) }],
    ["negative early departure", { disruption: cancelled(2, { arrivalDelayMinutes: 0, departureEarlierMinutes: -5 }) }],
    ["same airport", { arrival: airport("CDG") }],
    ["bad coordinates", { departure: { ...airport("CDG"), lat: Number.NaN } }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => assessClaim({ ...base(), ...overrides })).toThrow(RulesInputError);
  });
});
