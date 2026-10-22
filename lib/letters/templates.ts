import type { EnforcementBody } from "../enforcement";
import { articleFor, EXTRAORDINARY_PARAGRAPH, legalBasis, PAYMENT_PARAGRAPH_SUFFIX, regulationName } from "./citations";
import { formatDate, formatDistance, formatDuration, formatMoney, joinNames } from "./format";
import config from "./config.json";
import type { ClaimFacts } from "./types";

const place = (p: ClaimFacts["departure"]) => `${p.name} (${p.iata})`;

/** What happened, stated from the facts. */
export function disruptionParagraph(f: ClaimFacts): string {
  const d = f.disruption;
  switch (d.kind) {
    case "delay":
      return `The flight arrived at ${place(f.arrival)} ${formatDuration(d.arrivalDelayMinutes)} after its scheduled arrival time.`;
    case "cancellation": {
      const notice = d.noticeDays === 0 ? "on the day of departure" : `${d.noticeDays} day${d.noticeDays === 1 ? "" : "s"} before departure`;
      const reroute = d.rerouting
        ? ` I was rerouted and reached ${place(f.arrival)} ${formatDuration(Math.max(0, d.rerouting.arrivalDelayMinutes))} after the original scheduled arrival time.`
        : "";
      return `The flight was cancelled. I was told about the cancellation ${notice}.${reroute}`;
    }
    case "denied_boarding": {
      const reroute = d.rerouting
        ? ` I was rerouted and reached ${place(f.arrival)} ${formatDuration(Math.max(0, d.rerouting.arrivalDelayMinutes))} after the original scheduled arrival time.`
        : "";
      return `I presented myself for boarding on time with valid travel documents and was denied boarding against my will.${reroute}`;
    }
  }
}

export function amountParagraph(f: ClaimFacts): string {
  const per = formatMoney(f.perPassenger);
  const reduction = f.reduced ? ", reduced by 50% under Article 7(2)" : "";
  const count = f.passengers.length;
  const total =
    count > 1 ? ` For ${count} passengers (${joinNames(f.passengers)}) the total is ${formatMoney(f.total)}.` : "";
  return `The great-circle distance of the flight is ${formatDistance(f.distanceKm)}, so compensation of ${per} per passenger is due under Article ${articleFor(f)}${reduction}.${total}`;
}

export function paymentParagraph(f: ClaimFacts): string {
  return `Please pay ${formatMoney(f.total)} by bank transfer within ${config.responseDays} days, by ${formatDate(f.responseDeadline)}, and reply to ${f.claimant.email} so that I can provide my bank details. ${PAYMENT_PARAGRAPH_SUFFIX} If I do not receive a satisfactory reply by that date, I will refer this claim to the relevant national enforcement body or alternative dispute resolution scheme, and may pursue it through the courts.`;
}

function introParagraph(f: ClaimFacts): string {
  const others = f.passengers.filter((p) => p !== f.claimant.fullName);
  const travelling = others.length > 0 ? ` I am also claiming on behalf of ${joinNames(others)}, who travelled on the same booking.` : "";
  return `I am writing to claim compensation under ${regulationName(f.regime)} for flight ${f.flightNumber} from ${place(f.departure)} to ${place(f.arrival)}, scheduled on ${formatDate(f.flightDate)}, booking reference ${f.bookingReference}.${travelling}`;
}

/** The deterministic fallback body. Also the reference the LLM body is validated against. */
export function templateClaimBody(f: ClaimFacts): string {
  return [introParagraph(f), disruptionParagraph(f), legalBasis(f), amountParagraph(f), EXTRAORDINARY_PARAGRAPH, paymentParagraph(f)].join("\n\n");
}

/** Sender block, recipient, date, subject and salutation — never model-written. */
export function letterHeader(f: ClaimFacts): string {
  const regime = f.regime === "UK261" ? "UK261" : "EU261";
  return [
    f.claimant.fullName,
    f.claimant.postalAddress,
    f.claimant.email,
    "",
    `${f.airline.name} – Customer Relations`,
    "",
    formatDate(f.letterDate),
    "",
    `Subject: ${regime} compensation claim – flight ${f.flightNumber} on ${formatDate(f.flightDate)} – booking ${f.bookingReference}`,
    "",
    "Dear Sir or Madam,",
  ].join("\n");
}

export function letterFooter(f: ClaimFacts): string {
  return ["Yours faithfully,", "", f.claimant.fullName].join("\n");
}

export function assembleLetter(f: ClaimFacts, body: string): string {
  return [letterHeader(f), body.trim(), letterFooter(f)].join("\n\n") + "\n";
}

export interface EscalationOptions {
  /** YYYY-MM-DD the claim letter was sent. */
  claimSentDate: string;
  /** YYYY-MM-DD of the escalation letter. */
  today: string;
  /** Only pass a verified body; otherwise the letter is addressed generically. */
  body: EnforcementBody | null;
}

export function escalationLetter(f: ClaimFacts, opts: EscalationOptions): string {
  const recipient = opts.body?.verified ? opts.body.name : "The national enforcement body / ADR scheme";
  return [
    f.claimant.fullName,
    f.claimant.postalAddress,
    f.claimant.email,
    "",
    recipient,
    "",
    formatDate(opts.today),
    "",
    `Subject: Complaint against ${f.airline.name} – flight ${f.flightNumber} on ${formatDate(f.flightDate)} – booking ${f.bookingReference}`,
    "",
    "Dear Sir or Madam,",
    "",
    `I am writing to complain that ${f.airline.name} has not paid the compensation I am owed under ${regulationName(f.regime)}.`,
    "",
    `${disruptionParagraph(f)} ${amountParagraph(f)}`,
    "",
    `I sent my claim to ${f.airline.name} on ${formatDate(opts.claimSentDate)}. I have not received a satisfactory reply. I enclose a copy of my claim letter, my booking confirmation and any correspondence from the airline.`,
    "",
    `Please consider my complaint and help me obtain the ${formatMoney(f.total)} I am owed.`,
    "",
    "Yours faithfully,",
    "",
    f.claimant.fullName,
    "",
  ].join("\n");
}

export function replyToExtraordinaryCircumstances(f: ClaimFacts): string {
  return [
    `Re: flight ${f.flightNumber} on ${formatDate(f.flightDate)} – booking ${f.bookingReference}`,
    "",
    "Dear Sir or Madam,",
    "",
    "Thank you for your reply. You state that the disruption was caused by extraordinary circumstances. I do not accept this without evidence.",
    "",
    `${EXTRAORDINARY_PARAGRAPH.replace("If you consider that extraordinary circumstances apply, please provide full details and evidence.", "Please send me the specific cause of the disruption, the evidence for it, and the reasonable measures you took to avoid it.")}`,
    "",
    `Unless you provide this within ${config.responseDays} days, I ask you to pay the ${formatMoney(f.total)} I claimed. Otherwise I will refer the matter to the relevant national enforcement body or ADR scheme.`,
    "",
    "Yours faithfully,",
    "",
    f.claimant.fullName,
    "",
  ].join("\n");
}

export function replyToVoucherOffer(f: ClaimFacts): string {
  return [
    `Re: flight ${f.flightNumber} on ${formatDate(f.flightDate)} – booking ${f.bookingReference}`,
    "",
    "Dear Sir or Madam,",
    "",
    `Thank you for your offer. I do not accept a voucher. ${PAYMENT_PARAGRAPH_SUFFIX}`,
    "",
    `Please pay ${formatMoney(f.total)} by bank transfer within ${config.responseDays} days. Reply to ${f.claimant.email} and I will send my bank details.`,
    "",
    "Yours faithfully,",
    "",
    f.claimant.fullName,
    "",
  ].join("\n");
}
