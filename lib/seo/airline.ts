import type { Airline } from "../airlines";

/** Plain-English coverage summary for an airline page, derived from its licensing flags. */
export function airlineCoverage(a: Airline): string[] {
  const lines: string[] = [];
  if (a.isUK) {
    lines.push(`${a.name} is a UK airline. Its flights from the UK are covered by UK261, and so are its flights into the UK from anywhere.`);
    lines.push(`Its flights from the EU, Iceland, Norway or Switzerland are covered by EU261.`);
  } else if (a.isEU) {
    lines.push(`${a.name} is based in ${a.country === "CH" ? "Switzerland" : "Europe"}. All its flights leaving the EU, Iceland, Norway or Switzerland are covered by EU261, and so are its flights into them from anywhere.`);
    lines.push(
      a.country === "CH" || a.country === "NO" || a.country === "IS"
        ? `Its flights from the UK are covered by UK261.`
        : `Its flights from the UK are covered by UK261, and so are its flights into the UK from outside the EU.`,
    );
  } else {
    lines.push(`${a.name} is not an EU or UK airline. Its flights leaving the EU, Iceland, Norway, Switzerland or the UK are covered by EU261 or UK261.`);
    lines.push(`Its flights into Europe or the UK from elsewhere are generally not covered.`);
  }
  return lines;
}
