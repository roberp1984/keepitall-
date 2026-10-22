import type { CheckAnswers } from "@/lib/check/answers";
import { toClaimInput } from "@/lib/check/claim-input";
import type { EmailMessage, EmailSender } from "@/lib/email";
import { createMemoryStore } from "./memory-store";
import type { ServiceDeps } from "./service";
import type { DetailsForm } from "./types";

export const TODAY = "2026-10-22";

export const eligibleAnswers: CheckAnswers = {
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

export const eligibleInput = () => toClaimInput(eligibleAnswers, TODAY)!;

export const detailsForm: DetailsForm = {
  claimantName: "Alex Morgan",
  email: "alex@example.com",
  postalAddress: "1 High Street\r\nLondon\r\nSW1A 1AA",
  passengers: ["Sam Morgan"],
  bookingReference: "abc123",
};

export function testDeps(overrides: Partial<ServiceDeps> = {}) {
  const sent: EmailMessage[] = [];
  const logs: string[] = [];
  const email: EmailSender = { async send(m) { sent.push(m); } };
  const store = createMemoryStore();
  const deps: ServiceDeps = {
    store,
    email,
    siteUrl: "https://keepitall.test",
    today: () => TODAY,
    renderPdf: async () => Buffer.from("%PDF-fake"),
    log: (m) => logs.push(m),
    ...overrides,
  };
  return { deps, store, sent, logs };
}
