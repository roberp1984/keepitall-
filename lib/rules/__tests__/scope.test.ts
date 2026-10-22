import { describe, expect, it } from "vitest";
import { determineScope, isInTerritory, rulesetFor, type ScopeInput } from "@/lib/rules";
import { airport, CARRIER } from "./helpers";

function scope(from: string, to: string, carrier: string, flightDate = "2026-06-15", extra: Partial<ScopeInput> = {}) {
  const result = determineScope({
    departure: airport(from),
    arrival: airport(to),
    operatingCarrierCountry: carrier,
    flightDate,
    ...extra,
  });
  return {
    covered: result.covered,
    primary: result.primary && { regime: result.primary.regime, basis: result.primary.basis },
    regimes: result.matches.map((m) => m.regime),
  };
}

describe("EU261 scope", () => {
  it("covers any airline departing an EU airport (non-EU airline, EU → non-EU)", () => {
    expect(scope("FRA", "DXB", CARRIER.emirates)).toEqual({
      covered: true,
      primary: { regime: "EU261", basis: "departure" },
      regimes: ["EU261"],
    });
    expect(scope("CDG", "JFK", CARRIER.americanAirlines).primary).toEqual({ regime: "EU261", basis: "departure" });
    expect(scope("FRA", "IST", CARRIER.turkishAirlines).primary?.regime).toBe("EU261");
  });

  it("covers an EU airline arriving in the EU from outside", () => {
    expect(scope("DXB", "FRA", CARRIER.lufthansa)).toEqual({
      covered: true,
      primary: { regime: "EU261", basis: "arrival_on_qualifying_carrier" },
      regimes: ["EU261"],
    });
    expect(scope("JFK", "CDG", CARRIER.airFrance).primary?.regime).toBe("EU261");
  });

  it("does NOT cover a non-EU airline arriving in the EU from outside", () => {
    expect(scope("DXB", "FRA", CARRIER.emirates).covered).toBe(false);
    expect(scope("JFK", "CDG", CARRIER.americanAirlines).covered).toBe(false);
    expect(scope("IST", "FRA", CARRIER.turkishAirlines).covered).toBe(false);
  });

  it("treats EEA (NO, IS) and Swiss airports and carriers as in scope", () => {
    expect(scope("JFK", "ZRH", CARRIER.swiss).primary).toEqual({ regime: "EU261", basis: "arrival_on_qualifying_carrier" });
    expect(scope("JFK", "OSL", CARRIER.norwegian).primary?.regime).toBe("EU261");
    expect(scope("JFK", "KEF", CARRIER.icelandair).primary?.regime).toBe("EU261");
    expect(scope("ZRH", "JFK", CARRIER.americanAirlines).primary?.basis).toBe("departure");
    expect(scope("KEF", "JFK", CARRIER.americanAirlines).primary?.basis).toBe("departure");
  });

  it("covers outermost regions (Réunion, Guadeloupe, Canaries, Madeira) and Åland", () => {
    expect(scope("RUN", "JFK", CARRIER.americanAirlines).primary?.regime).toBe("EU261");
    expect(scope("PTP", "JFK", CARRIER.americanAirlines).primary?.regime).toBe("EU261");
    expect(scope("TFS", "LHR", CARRIER.easyJetUK).regimes).toContain("EU261");
    expect(scope("FNC", "LGW", CARRIER.easyJetUK).regimes).toContain("EU261");
    expect(scope("MHQ", "JFK", CARRIER.americanAirlines).primary?.regime).toBe("EU261");
  });

  it("excludes the Faroe Islands, Svalbard and Northern Cyprus", () => {
    expect(scope("FAE", "CPH", CARRIER.atlanticAirways).covered).toBe(false);
    expect(scope("CPH", "FAE", CARRIER.atlanticAirways).primary?.basis).toBe("departure");
    expect(scope("LYR", "JFK", CARRIER.norwegian).covered).toBe(false);
    expect(scope("ECN", "IST", CARRIER.turkishAirlines).covered).toBe(false);
  });

  it("does not apply inbound cover if the passenger already got benefits in the third country", () => {
    expect(scope("DXB", "FRA", CARRIER.lufthansa, "2026-06-15", { receivedBenefitsInThirdCountry: true }).covered).toBe(false);
    // Departure-based cover is unaffected
    expect(scope("FRA", "DXB", CARRIER.lufthansa, "2026-06-15", { receivedBenefitsInThirdCountry: true }).covered).toBe(true);
  });

  it("accepts lowercase country codes", () => {
    expect(scope("DXB", "FRA", "de").covered).toBe(true);
  });
});

describe("UK261 scope", () => {
  it("covers any airline departing a UK airport", () => {
    expect(scope("LHR", "JFK", CARRIER.americanAirlines)).toEqual({
      covered: true,
      primary: { regime: "UK261", basis: "departure" },
      regimes: ["UK261"],
    });
    expect(scope("MAN", "DXB", CARRIER.emirates).primary?.regime).toBe("UK261");
  });

  it("covers UK domestic flights", () => {
    expect(scope("EDI", "LHR", CARRIER.britishAirways).regimes).toEqual(["UK261"]);
  });

  it("covers a UK carrier arriving in the UK from outside", () => {
    expect(scope("JFK", "LHR", CARRIER.britishAirways).primary).toEqual({
      regime: "UK261",
      basis: "arrival_on_qualifying_carrier",
    });
  });

  it("covers an EU carrier arriving in the UK from outside the EU", () => {
    expect(scope("JFK", "LHR", CARRIER.airFrance)).toEqual({
      covered: true,
      primary: { regime: "UK261", basis: "arrival_on_qualifying_carrier" },
      regimes: ["UK261"],
    });
  });

  it("does NOT cover a non-UK/EU carrier arriving in the UK", () => {
    expect(scope("JFK", "LHR", CARRIER.americanAirlines).covered).toBe(false);
    expect(scope("DXB", "MAN", CARRIER.emirates).covered).toBe(false);
    expect(scope("TLV", "LTN", CARRIER.elAl).covered).toBe(false);
  });

  it("follows CLAUDE.md: EEA/Swiss carriers are not 'EU carriers' for UK inbound", () => {
    expect(scope("JFK", "LGW", CARRIER.norwegian).covered).toBe(false);
    expect(scope("JFK", "LHR", CARRIER.swiss).covered).toBe(false);
  });

  it("treats Jersey, Guernsey, Isle of Man and Gibraltar as outside the UK", () => {
    expect(scope("LGW", "JER", CARRIER.britishAirways).primary?.basis).toBe("departure");
    expect(scope("JER", "LGW", CARRIER.britishAirways).primary).toEqual({
      regime: "UK261",
      basis: "arrival_on_qualifying_carrier",
    });
    expect(scope("JER", "GCI", CARRIER.blueIslands).covered).toBe(false);
    expect(scope("IOM", "JER", CARRIER.blueIslands).covered).toBe(false);
    expect(scope("GIB", "LHR", CARRIER.britishAirways).primary?.basis).toBe("arrival_on_qualifying_carrier");
    expect(scope("GIB", "LHR", CARRIER.americanAirlines).covered).toBe(false);
  });
});

describe("flights covered by both EU261 and UK261", () => {
  it("UK → EU on an EU carrier: UK261 by departure, EU261 as well", () => {
    expect(scope("LHR", "CDG", CARRIER.airFrance)).toEqual({
      covered: true,
      primary: { regime: "UK261", basis: "departure" },
      regimes: ["EU261", "UK261"],
    });
  });

  it("UK → EU on a UK carrier: UK261 only", () => {
    expect(scope("LHR", "CDG", CARRIER.britishAirways).regimes).toEqual(["UK261"]);
  });

  it("EU → UK on a UK carrier: EU261 by departure, UK261 as well", () => {
    expect(scope("CDG", "LHR", CARRIER.britishAirways)).toEqual({
      covered: true,
      primary: { regime: "EU261", basis: "departure" },
      regimes: ["EU261", "UK261"],
    });
  });

  it("EU → UK on a non-UK/EU carrier: EU261 only", () => {
    expect(scope("CDG", "LHR", CARRIER.americanAirlines).regimes).toEqual(["EU261"]);
  });
});

describe("versioned territory (Brexit)", () => {
  it("applies EU261 (not UK261) to UK flights on or before 2020-12-31", () => {
    expect(scope("LHR", "JFK", CARRIER.americanAirlines, "2020-12-31")).toEqual({
      covered: true,
      primary: { regime: "EU261", basis: "departure" },
      regimes: ["EU261"],
    });
    expect(scope("JFK", "LHR", CARRIER.britishAirways, "2020-12-31").primary?.regime).toBe("EU261");
  });

  it("switches to UK261 from 2021-01-01", () => {
    expect(scope("LHR", "JFK", CARRIER.americanAirlines, "2021-01-01").regimes).toEqual(["UK261"]);
    expect(scope("JFK", "CDG", CARRIER.britishAirways, "2021-01-01").covered).toBe(false);
    expect(scope("JFK", "CDG", CARRIER.britishAirways, "2020-12-31").covered).toBe(true);
  });

  it("covers nothing before EU261 entered into force", () => {
    expect(scope("CDG", "JFK", CARRIER.airFrance, "2005-02-16").covered).toBe(false);
    expect(scope("CDG", "JFK", CARRIER.airFrance, "2005-02-17").covered).toBe(true);
  });
});

describe("not covered by either regime", () => {
  it.each([
    ["JFK", "DXB", CARRIER.emirates],
    ["JFK", "DXB", CARRIER.lufthansa],
    ["JFK", "DXB", CARRIER.britishAirways],
    ["IST", "TLV", CARRIER.turkishAirlines],
    ["GIB", "TFS", CARRIER.britishAirways],
  ])("%s → %s on carrier licensed in %s", (from, to, carrier) => {
    expect(scope(from, to, carrier)).toEqual({ covered: false, primary: null, regimes: [] });
  });
});

describe("isInTerritory", () => {
  it("is case-insensitive on airport codes and country", () => {
    const eu = rulesetFor("EU261", "2026-06-15")!;
    expect(isInTerritory({ iata: "lyr", country: "no", lat: 0, lon: 0 }, eu)).toBe(false);
    expect(isInTerritory({ iata: "osl", country: "no", lat: 0, lon: 0 }, eu)).toBe(true);
  });
});
