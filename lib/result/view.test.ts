import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "@/lib/legal";
import { presentAssessment, type ResultContext } from "@/lib/result/view";
import { assessClaim } from "@/lib/rules";
import { claim, delay, CARRIER } from "@/lib/rules/__tests__/helpers";

const ctx: ResultContext = { airlineName: "British Airways", fromLabel: "London", toLabel: "New York", flightDate: "2026-06-15" };

describe("presentAssessment", () => {
  it("eligible: 'may be entitled' wording, totals, strength and price", () => {
    const view = presentAssessment(assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(5), { passengers: 2 })), ctx);
    expect(view).toMatchObject({
      status: "eligible",
      headline: "You may be entitled to £520 per passenger",
      perPassenger: "£520",
      total: "£1,040",
      regime: "UK261",
      coverage: "Covered by UK261 because your flight left from the UK.",
      strength: { label: "strong", title: "Strong case" },
      pack: { price: "€18", currency: "EUR" },
      disclaimer: DISCLAIMER,
      deadline: null,
    });
    expect(view.summary).toBe("London to New York with British Airways on 15 June 2026");
  });

  it("never promises an outcome", () => {
    for (const a of [
      assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(5))),
      assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(1))),
      assessClaim(claim("JFK", "LHR", CARRIER.americanAirlines, delay(5))),
    ]) {
      const text = JSON.stringify(presentAssessment(a, ctx)).toLowerCase();
      expect(text).not.toMatch(/\byou will (get|receive)\b|\bguarantee/);
    }
  });

  it("EU inbound on an EU airline, reduced amount, euro price", () => {
    const view = presentAssessment(assessClaim(claim("DXB", "FRA", CARRIER.lufthansa, delay(3, 30))), ctx);
    expect(view.coverage).toBe("Covered by EU261 because you flew into the EU, Iceland, Norway or Switzerland on an airline based there.");
    expect(view.perPassenger).toBe("€300");
    expect(view.notes.join(" ")).toMatch(/halved/);
    expect(view.pack?.price).toBe("€19");
  });

  it("weak reason → 'Hard to win'", () => {
    const view = presentAssessment(assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(5), { reason: "weather" })), ctx);
    expect(view.strength).toMatchObject({ label: "unlikely", title: "Hard to win" });
  });

  it("not eligible: explains the threshold from the ruleset", () => {
    const view = presentAssessment(assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(2))), ctx);
    expect(view.headline).toBe("Based on your answers, compensation is unlikely to be due");
    expect(view.notes).toEqual(["Compensation for delays starts when you reach your final destination 3 hours or more late."]);
    expect(view.pack).toBeNull();
    expect(view.perPassenger).toBeNull();
  });

  it("not covered: honest message and Montreal Convention alternative", () => {
    const view = presentAssessment(assessClaim(claim("JFK", "LHR", CARRIER.americanAirlines, delay(5))), ctx);
    expect(view.headline).toBe("This flight isn't covered by EU261 or UK261");
    expect(view.alternatives.map((a) => a.title)).toEqual(["Montreal Convention", "Refunds and the airline's own terms"]);
    expect(view.pack).toBeNull();
  });

  it("notes double coverage", () => {
    const view = presentAssessment(assessClaim(claim("LHR", "CDG", CARRIER.airFrance, delay(4))), ctx);
    expect(view.notes).toContain("This flight is also covered by EU261. You can only claim once, so we've used UK261.");
  });

  it("hides unverified deadlines", () => {
    const a = assessClaim(claim("LHR", "JFK", CARRIER.britishAirways, delay(5), { jurisdiction: "GB-ENG", today: "2026-10-22" }));
    expect(presentAssessment(a, ctx).deadline).toBeNull();
  });
});
