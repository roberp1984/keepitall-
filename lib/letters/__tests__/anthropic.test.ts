import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { anthropicGenerator, DEFAULT_LETTER_MODEL, LetterGenerationError } from "@/lib/letters/anthropic";

function fakeClient(response: object) {
  const create = vi.fn().mockResolvedValue(response);
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create };
}

describe("anthropicGenerator", () => {
  it("sends the system prompt, the model and the refusal fallback, and returns the text", async () => {
    const { client, create } = fakeClient({
      stop_reason: "end_turn",
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: "  Body text  " }],
    });
    const text = await anthropicGenerator({ client, model: DEFAULT_LETTER_MODEL })({ system: "SYS", prompt: "PROMPT" });
    expect(text).toBe("Body text");
    const [params, options] = create.mock.calls[0]!;
    expect(params).toMatchObject({
      model: "claude-sonnet-5-5",
      system: "SYS",
      messages: [{ role: "user", content: "PROMPT" }],
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    expect(params).not.toHaveProperty("temperature");
    expect(options).toMatchObject({ maxRetries: 1 });
  });

  it.each([
    ["refusal", { stop_reason: "refusal", content: [] }],
    ["truncation", { stop_reason: "max_tokens", content: [{ type: "text", text: "partial" }] }],
    ["empty output", { stop_reason: "end_turn", content: [] }],
  ])("throws on %s so the template is used", async (_label, response) => {
    const { client } = fakeClient(response);
    await expect(anthropicGenerator({ client })({ system: "", prompt: "" })).rejects.toThrow(LetterGenerationError);
  });
});
