import { describe, expect, it, vi } from "vitest";
import { getAirline } from "@/lib/airlines";
import { DISCLAIMER } from "@/lib/legal";
import {
  buildClaimFacts,
  buildClaimPack,
  buildPrompt,
  ClaimFactsError,
  draftClaimLetter,
  formatDate,
  formatDuration,
  formatMoney,
  joinNames,
  placeholderValues,
  possessive,
  SYSTEM_PROMPT,
  templateClaimBody,
  validateAndFill,
} from "@/lib/letters";
import { assessClaim } from "@/lib/rules";
import { claimInput, details, GOOD_BODY, ukLongHaulFacts } from "./fixtures";

describe("formatting", () => {
  it("formats money without spurious decimals", () => {
    expect(formatMoney({ amount: 600, currency: "EUR" })).toBe("€600");
    expect(formatMoney({ amount: 1040, currency: "GBP" })).toBe("£1,040");
    expect(formatMoney({ amount: 162.5, currency: "EUR" })).toBe("€162.50");
  });

  it("formats dates, durations and name lists", () => {
    expect(formatDate("2026-06-15")).toBe("15 June 2026");
    expect(formatDuration(300)).toBe("5 hours");
    expect(formatDuration(61)).toBe("1 hour 1 minute");
    expect(formatDuration(45)).toBe("45 minutes");
    expect(formatDuration(0)).toBe("0 minutes");
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A and B");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
    expect(possessive("Ryanair")).toBe("Ryanair's");
    expect(possessive("British Airways")).toBe("British Airways'");
  });
});

describe("buildClaimFacts", () => {
  it("copies amounts from the assessment and normalises references", () => {
    const facts = ukLongHaulFacts();
    expect(facts).toMatchObject({
      regime: "UK261",
      flightNumber: "BA117",
      bookingReference: "ABC123",
      perPassenger: { amount: 520, currency: "GBP" },
      total: { amount: 520, currency: "GBP" },
      band: "long",
      reduced: false,
      departure: { iata: "LHR", country: "GB" },
      letterDate: "2026-10-22",
      responseDeadline: "2026-11-05",
    });
    expect(facts.departure.name).toMatch(/Heathrow/);
  });

  it("totals several passengers", () => {
    expect(ukLongHaulFacts(["Alex Morgan", "Sam Morgan", "Jo Morgan"]).total).toEqual({ amount: 1560, currency: "GBP" });
  });

  it("refuses ineligible or not-covered assessments", () => {
    const short = claimInput("LHR", "JFK", "GB", { kind: "delay", arrivalDelayMinutes: 60 });
    expect(() => buildClaimFacts(short, assessClaim(short), details())).toThrow(ClaimFactsError);
    const uncovered = claimInput("JFK", "LHR", "US", { kind: "delay", arrivalDelayMinutes: 600 });
    expect(() => buildClaimFacts(uncovered, assessClaim(uncovered), details())).toThrow(ClaimFactsError);
  });

  it.each([
    ["wrong passenger count", { passengers: ["A", "B"] }],
    ["blank passenger", { passengers: ["  "] }],
    ["bad flight number", { flightNumber: "flight one" }],
    ["bad booking reference", { bookingReference: "AB" }],
    ["bad email", { claimant: { fullName: "A", email: "nope", postalAddress: "x" } }],
    ["missing address", { claimant: { fullName: "A", email: "a@b.co", postalAddress: " " } }],
  ])("rejects %s", (_label, overrides) => {
    const input = claimInput("LHR", "JFK", "GB", { kind: "delay", arrivalDelayMinutes: 300 });
    expect(() => buildClaimFacts(input, assessClaim(input), details(overrides))).toThrow(ClaimFactsError);
  });
});

describe("template letters", () => {
  it("delay: cites Arts 6/7 and Sturgeon, with exact amounts", () => {
    const body = templateClaimBody(ukLongHaulFacts());
    expect(body).toContain("as retained in UK law (UK261)");
    expect(body).toContain("Articles 6 and 7");
    expect(body).toContain("Sturgeon");
    expect(body).toContain("Article 7(1)(c)");
    expect(body).toContain("£520 per passenger");
    expect(body).toContain("Please pay £520 by bank transfer within 14 days, by 5 November 2026");
    expect(body).toContain("5 hours after its scheduled arrival time");
    expect(body).toContain("travel vouchers");
    expect(body).not.toContain("reduced by 50%");
  });

  it("cancellation with reduction: cites Art 5 and Art 7(2), EU261 euros", () => {
    const input = claimInput("FRA", "DXB", "AE", {
      kind: "cancellation",
      noticeDays: 2,
      rerouting: { arrivalDelayMinutes: 200, departureEarlierMinutes: 0 },
    }, 2);
    const facts = buildClaimFacts(input, assessClaim(input), details({ airline: { name: "Emirates" }, flightNumber: "EK44", passengers: ["Alex Morgan", "Sam Morgan"] }));
    const body = templateClaimBody(facts);
    expect(body).toContain("Regulation (EC) No 261/2004 (EU261)");
    expect(body).toContain("Articles 5(1)(c) and 7");
    expect(body).toContain("€300 per passenger is due under Article 7(1)(c), reduced by 50% under Article 7(2)");
    expect(body).toContain("For 2 passengers (Alex Morgan and Sam Morgan) the total is €600");
    expect(body).toContain("2 days before departure");
    expect(body).toContain("on behalf of Sam Morgan");
  });

  it("denied boarding cites Art 4(3)", () => {
    const input = claimInput("CDG", "BCN", "FR", { kind: "denied_boarding", voluntary: false, rerouting: null });
    const facts = buildClaimFacts(input, assessClaim(input), details({ airline: getAirline("air-france")!, flightNumber: "AF1048" }));
    expect(templateClaimBody(facts)).toContain("Articles 4(3) and 7");
    expect(templateClaimBody(facts)).toContain("€250 per passenger is due under Article 7(1)(a)");
  });
});

describe("prompt", () => {
  it("contains no personal data, amounts, dates or references", () => {
    const facts = ukLongHaulFacts(["Alex Morgan", "Sam Morgan"]);
    const prompt = buildPrompt(facts) + SYSTEM_PROMPT;
    for (const secret of ["Alex", "Sam", "alex@example.com", "High Street", "ABC123", "BA117", "£", "1,040", "June", "5 hours", "km"]) {
      expect(prompt, secret).not.toContain(secret);
    }
    expect(prompt).toContain("{{TOTAL_AMOUNT}}");
    expect(prompt).toContain("Article 7(1)(c)");
  });
});

describe("validateAndFill", () => {
  const facts = ukLongHaulFacts();
  const values = placeholderValues(facts);
  const must = [values.TOTAL_AMOUNT!, facts.flightNumber, facts.bookingReference];

  it("fills a valid body", () => {
    const result = validateAndFill(GOOD_BODY, values, must);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("Please pay £520 by bank transfer by 5 November 2026");
      expect(result.text).toContain("flight BA117 on 15 June 2026, booking reference ABC123");
      expect(result.text).not.toContain("{{");
    }
  });

  it.each([
    ["a literal amount", GOOD_BODY.replace("{{PER_PASSENGER_AMOUNT}}", "£600"), "literal amount"],
    ["an amount in words", GOOD_BODY + "\n\nThat is 600 euros.", "literal amount"],
    ["a literal date", GOOD_BODY + " Flown on 15 June.", "literal date"],
    ["a US-style date", GOOD_BODY + " Flown on June 15.", "literal date"],
    ["an ISO date", GOOD_BODY + " 2026-11-05", "literal date"],
    ["a literal duration", GOOD_BODY.replace("{{ARRIVAL_DELAY}}", "5 hours"), "literal duration"],
    ["a literal distance", GOOD_BODY.replace("{{DISTANCE}}", "5,540 km"), "literal distance"],
    ["a literal email", GOOD_BODY.replace("{{CLAIMANT_EMAIL}}", "me@x.com"), "literal email"],
    ["a missing required placeholder", GOOD_BODY.replace("{{TOTAL_AMOUNT}}", "the amount"), "missing placeholder TOTAL_AMOUNT"],
    ["an unknown placeholder", GOOD_BODY + " {{BANK_ACCOUNT}}", "unknown placeholder BANK_ACCOUNT"],
    ["markdown", "**Claim**\n" + GOOD_BODY, "markdown"],
    ["no regulation citation", GOOD_BODY.replaceAll("261/2004", "the regulation"), "regulation not cited"],
    ["a too-short body", "{{TOTAL_AMOUNT}}", "too short"],
  ])("rejects %s", (_label, body, reason) => {
    expect(validateAndFill(body, values, must)).toEqual({ ok: false, reason });
  });
});

describe("draftClaimLetter", () => {
  const facts = ukLongHaulFacts();

  it("uses the model body, wrapped in the deterministic header and footer", async () => {
    const generate = vi.fn().mockResolvedValue(GOOD_BODY);
    const result = await draftClaimLetter(facts, generate);
    expect(result.source).toBe("llm");
    expect(generate).toHaveBeenCalledWith({ system: SYSTEM_PROMPT, prompt: buildPrompt(facts) });
    expect(result.text.startsWith("Alex Morgan\n1 High Street")).toBe(true);
    expect(result.text).toContain("Subject: UK261 compensation claim – flight BA117 on 15 June 2026 – booking ABC123");
    expect(result.text).toContain("Dear Sir or Madam,");
    expect(result.text).toContain("£520");
    expect(result.text.trimEnd().endsWith("Yours faithfully,\n\nAlex Morgan")).toBe(true);
  });

  it.each([
    ["no generator", undefined, "no generator configured"],
    ["an API error", vi.fn().mockRejectedValue(new Error("529 overloaded")), "generation failed: 529 overloaded"],
    ["a wrong amount", vi.fn().mockResolvedValue(GOOD_BODY.replace("{{TOTAL_AMOUNT}}", "£260 {{TOTAL_AMOUNT}}")), "validation failed: literal amount"],
    ["an empty reply", vi.fn().mockResolvedValue(""), "validation failed: too short"],
  ])("falls back to the template on %s", async (_label, generate, reason) => {
    const result = await draftClaimLetter(facts, generate);
    expect(result).toMatchObject({ source: "template", fallbackReason: reason });
    expect(result.text).toContain(templateClaimBody(facts));
    expect(result.text).toContain("Subject: UK261 compensation claim");
  });
});

describe("buildClaimPack", () => {
  it("includes the disclaimer, letters, replies and generic steps while data is unverified", async () => {
    const facts = ukLongHaulFacts();
    const pack = await buildClaimPack(facts, { scopeBasis: "departure", airline: getAirline("british-airways") });
    expect(pack.disclaimer).toBe(DISCLAIMER);
    expect(pack.claimLetter.source).toBe("template");
    expect(pack.escalation.afterDays).toBe(56);
    expect(pack.escalation.body).toBeNull();
    expect(pack.escalation.letter).toContain("The national enforcement body / ADR scheme");
    expect(pack.escalation.letter).toContain("I sent my claim to British Airways on 22 October 2026");
    expect(pack.howToSend[0]).toContain("official website");
    expect(pack.howToSend.join(" ")).not.toMatch(/https?:\/\//);
    expect(pack.howToSend.at(-1)).toContain("after 56 days");
    expect(pack.replies.extraordinaryCircumstances).toContain("Article 5(3)");
    expect(pack.replies.vouchers).toContain("I do not accept a voucher");
    expect(pack.replies.vouchers).toContain("£520");
  });

  it("uses verified airline contact details and enforcement bodies", async () => {
    const facts = ukLongHaulFacts();
    const airline = { ...getAirline("british-airways")!, verified: true, claimFormUrl: "https://example.com/claim" };
    const pack = await buildClaimPack(facts, { scopeBasis: "departure", airline });
    expect(pack.howToSend[0]).toContain("https://example.com/claim");
  });
});
