import { buildPrompt, placeholderValues, SYSTEM_PROMPT } from "./prompt";
import { assembleLetter, templateClaimBody } from "./templates";
import type { ClaimFacts } from "./types";
import { validateAndFill } from "./validate";

export type TextGenerator = (request: { system: string; prompt: string }) => Promise<string>;

export interface DraftResult {
  text: string;
  source: "llm" | "template";
  /** Why the template was used, for logging. */
  fallbackReason?: string;
}

/**
 * Drafts the claim letter. The model writes only the body, with placeholders;
 * the header, footer and every number come from ClaimFacts. Any failure falls back
 * to the static template, so this never throws for model problems.
 */
export async function draftClaimLetter(facts: ClaimFacts, generate?: TextGenerator): Promise<DraftResult> {
  const fallback = (reason: string): DraftResult => ({
    text: assembleLetter(facts, templateClaimBody(facts)),
    source: "template",
    fallbackReason: reason,
  });
  if (!generate) return fallback("no generator configured");

  let raw: string;
  try {
    raw = await generate({ system: SYSTEM_PROMPT, prompt: buildPrompt(facts) });
  } catch (err) {
    return fallback(`generation failed: ${(err as Error).message}`);
  }

  const values = placeholderValues(facts);
  const result = validateAndFill(raw, values, [values.TOTAL_AMOUNT!, facts.flightNumber, facts.bookingReference]);
  if (!result.ok) return fallback(`validation failed: ${result.reason}`);
  return { text: assembleLetter(facts, result.text), source: "llm" };
}
