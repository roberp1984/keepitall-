import { REQUIRED_PLACEHOLDERS } from "./prompt";

export type ValidationResult = { ok: true; text: string } | { ok: false; reason: string };

const PLACEHOLDER = /\{\{\s*([A-Z_]+)\s*\}\}/g;
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";

/** Things the model must never write literally (it has placeholders for them). */
const FORBIDDEN: [RegExp, string][] = [
  [/[€£$]\s?\d/, "literal amount"],
  [/\d[\d,.]*\s?(?:€|£|EUR\b|GBP\b|euros?\b|pounds?\b)/i, "literal amount"],
  [/\b\d{4}-\d{2}-\d{2}\b/, "literal date"],
  [new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\b`, "i"), "literal date"],
  [new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}\\b`, "i"), "literal date"],
  [/\b\d+\s?(?:hours?|hrs?|minutes?|mins?)\b/i, "literal duration"],
  [/\b\d[\d,.]*\s?km\b/i, "literal distance"],
  [/[^\s@]+@[^\s@]+\.[a-z]{2,}/i, "literal email"],
  [/^\s*#|\*\*/m, "markdown"],
];

/**
 * Checks a model-written body and fills in the placeholders. Anything unexpected
 * fails validation, and the caller falls back to the static template.
 */
export function validateAndFill(raw: string, values: Record<string, string>, mustContain: string[]): ValidationResult {
  const body = raw.trim();
  if (body.length < 300) return { ok: false, reason: "too short" };
  if (body.length > 6000) return { ok: false, reason: "too long" };

  const used = new Set([...body.matchAll(PLACEHOLDER)].map((m) => m[1]!));
  for (const name of used) {
    if (!(name in values)) return { ok: false, reason: `unknown placeholder ${name}` };
  }
  for (const name of REQUIRED_PLACEHOLDERS) {
    if (!used.has(name)) return { ok: false, reason: `missing placeholder ${name}` };
  }

  const withoutPlaceholders = body.replace(PLACEHOLDER, "");
  for (const [pattern, reason] of FORBIDDEN) {
    if (pattern.test(withoutPlaceholders)) return { ok: false, reason };
  }
  if (!withoutPlaceholders.includes("261/2004")) return { ok: false, reason: "regulation not cited" };

  const text = body.replace(PLACEHOLDER, (_m, name: string) => values[name]!);
  if (text.includes("{{") || text.includes("}}")) return { ok: false, reason: "malformed placeholder" };
  for (const required of mustContain) {
    if (!text.includes(required)) return { ok: false, reason: `missing value ${required}` };
  }
  return { ok: true, text };
}
