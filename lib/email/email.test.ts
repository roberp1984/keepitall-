import { describe, expect, it, vi } from "vitest";
import { packReadyEmail, paymentConfirmedEmail } from "@/lib/email";
import { resendSender } from "@/lib/email/resend";

describe("email templates", () => {
  it("payment confirmation links to the private pack and includes the disclaimer", () => {
    const m = paymentConfirmedEmail("a@b.co", "https://k.test/pack/TOKEN");
    expect(m.to).toBe("a@b.co");
    expect(m.text).toContain("https://k.test/pack/TOKEN");
    expect(m.html).toContain('href="https://k.test/pack/TOKEN"');
    expect(m.html).toContain("This is not legal advice.");
    expect(m.replyTo).toBe("support@getkeepitall.com");
    expect(m.text).toContain("support@getkeepitall.com");
  });

  it("pack email attaches the PDF and escapes HTML", () => {
    const m = packReadyEmail("a@b.co", 'https://k.test/pack/"><script>', "BA117", Buffer.from("%PDF"));
    expect(m.subject).toBe("Your claim pack for flight BA117");
    expect(m.attachments?.[0]?.filename).toBe("claim-pack-BA117.pdf");
    expect(m.html).not.toContain("<script>");
    expect(packReadyEmail("a@b.co", "u", "BA1").attachments).toBeUndefined();
  });
});

describe("resendSender", () => {
  it("sends from the configured address and throws on API errors", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "1" }, error: null });
    const sender = resendSender({ apiKey: "k", from: "KeepItAll <c@k.test>" }, { emails: { send } } as never);
    await sender.send(paymentConfirmedEmail("a@b.co", "u"));
    expect(send.mock.calls[0]![0]).toMatchObject({ from: "KeepItAll <c@k.test>", to: "a@b.co", replyTo: "support@getkeepitall.com" });

    send.mockResolvedValue({ data: null, error: { message: "bad domain" } });
    await expect(sender.send(paymentConfirmedEmail("a@b.co", "u"))).rejects.toThrow(/bad domain/);
  });
});
