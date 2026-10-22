// Server-only: import this from route handlers / server actions, never from client components.
import Anthropic from "@anthropic-ai/sdk";
import type { TextGenerator } from "./draft";

export const DEFAULT_LETTER_MODEL = "claude-sonnet-5-5";

export class LetterGenerationError extends Error {
  override name = "LetterGenerationError";
}

interface GeneratorOptions {
  client?: Anthropic;
  model?: string;
  timeoutMs?: number;
}

/** A TextGenerator backed by the Anthropic API. Errors propagate; draftClaimLetter falls back to the template. */
export function anthropicGenerator(options: GeneratorOptions = {}): TextGenerator {
  return async ({ system, prompt }) => {
    const client = options.client ?? new Anthropic();
    const model = options.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_LETTER_MODEL;

    const response = await client.beta.messages.create(
      {
        model,
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { effort: "medium" },
        // Server-side refusal fallback: the API retries a declined request on another model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { timeout: options.timeoutMs ?? 60_000, maxRetries: 1 },
    );

    if (response.stop_reason === "refusal") throw new LetterGenerationError("model declined the request");
    if (response.stop_reason === "max_tokens") throw new LetterGenerationError("response truncated");

    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    if (!text) throw new LetterGenerationError("empty response");
    return text;
  };
}
