import type { Airline } from "../airlines";
import { enforcementBodyFor, escalationAfterDays, type EnforcementBody } from "../enforcement";
import { DISCLAIMER } from "../legal";
import { addDays } from "../rules/dates";
import type { ScopeBasis } from "../rules/scope";
import { draftClaimLetter, type DraftResult, type TextGenerator } from "./draft";
import { possessive } from "./format";
import { escalationLetter, replyToExtraordinaryCircumstances, replyToVoucherOffer } from "./templates";
import type { ClaimFacts } from "./types";

export interface ClaimPack {
  disclaimer: string;
  claimLetter: DraftResult;
  howToSend: string[];
  escalation: {
    afterDays: number;
    /** Only present when a human has verified the entry. */
    body: EnforcementBody | null;
    letter: string;
  };
  replies: { extraordinaryCircumstances: string; vouchers: string };
}

export interface PackOptions {
  scopeBasis: ScopeBasis;
  /** Full airline record, if we have one. Contact details are only used when verified. */
  airline?: Airline;
  generate?: TextGenerator;
}

export function howToSend(f: ClaimFacts, airline: Airline | undefined, body: EnforcementBody | null, afterDays: number): string[] {
  const steps: string[] = [];
  if (airline?.verified && airline.claimFormUrl) {
    steps.push(`Submit your claim using ${possessive(airline.name)} compensation claim form: ${airline.claimFormUrl}. Paste the letter into the form or attach it as a PDF.`);
    if (airline.claimNotes) steps.push(airline.claimNotes);
  } else if (airline?.verified && airline.claimsEmail) {
    steps.push(`Email the letter to ${airline.name} at ${airline.claimsEmail}, with the PDF attached.`);
  } else {
    steps.push(`Find the compensation claim form on ${possessive(f.airline.name)} official website (usually under Help, Refunds or Claims). Paste the letter into the form or attach it as a PDF.`);
  }
  steps.push("Attach your booking confirmation, boarding passes and any messages from the airline about the disruption.");
  steps.push("Keep a copy of everything you send and note the date.");
  const where = body ? `${body.name}${body.url ? ` (${body.url})` : ""}` : f.regime === "UK261" ? "the airline's ADR scheme or the UK Civil Aviation Authority" : "the national enforcement body for the country of departure";
  steps.push(`If the airline refuses, offers vouchers, or has not paid after ${afterDays} days, use the reply templates or send the escalation letter to ${where}.`);
  return steps;
}

export async function buildClaimPack(facts: ClaimFacts, options: PackOptions): Promise<ClaimPack> {
  const afterDays = escalationAfterDays(facts.regime);
  const found = enforcementBodyFor({
    regime: facts.regime,
    scopeBasis: options.scopeBasis,
    departureCountry: facts.departure.country,
    arrivalCountry: facts.arrival.country,
  });
  const body = found?.verified ? found : null;

  return {
    disclaimer: DISCLAIMER,
    claimLetter: await draftClaimLetter(facts, options.generate),
    howToSend: howToSend(facts, options.airline, body, afterDays),
    escalation: {
      afterDays,
      body,
      letter: escalationLetter(facts, {
        claimSentDate: facts.letterDate,
        today: addDays(facts.letterDate, afterDays),
        body,
      }),
    },
    replies: {
      extraordinaryCircumstances: replyToExtraordinaryCircumstances(facts),
      vouchers: replyToVoucherOffer(facts),
    },
  };
}

