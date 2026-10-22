import { DISCLAIMER } from "../legal";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Used when Resend isn't configured: the pack page still works, nothing is emailed. */
export const noopEmailSender: EmailSender = { async send() {} };

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function html(paragraphs: string[], link: { href: string; label: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escape(p)}</p>`).join("");
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1a2b25;max-width:560px;margin:0 auto;padding:24px">
${body}<p style="margin:24px 0"><a href="${escape(link.href)}" style="background:#0f7a5a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escape(link.label)}</a></p>
<p style="font-size:13px;color:#5b6b65">${escape(DISCLAIMER)}</p></body></html>`;
}

export function paymentConfirmedEmail(to: string, packUrl: string): EmailMessage {
  const paragraphs = [
    "Thanks for your order. Your payment is confirmed.",
    "Open your claim pack, add the passenger names and your booking reference, and we'll prepare your letters straight away.",
    "Keep this email: the link is private to you and is how you get back to your pack.",
  ];
  return {
    to,
    subject: "Your KeepItAll claim pack is ready to complete",
    text: `${paragraphs.join("\n\n")}\n\n${packUrl}\n\n${DISCLAIMER}`,
    html: html(paragraphs, { href: packUrl, label: "Complete your claim pack" }),
  };
}

export function packReadyEmail(to: string, packUrl: string, flightNumber: string, pdf?: Buffer): EmailMessage {
  const paragraphs = [
    `Your claim pack for flight ${flightNumber} is ready. The PDF is attached.`,
    "Send the claim letter to the airline using the steps in the pack, and keep a note of the date you sent it.",
    "If the airline refuses or doesn't reply, the pack includes reply templates and an escalation letter.",
  ];
  return {
    to,
    subject: `Your claim pack for flight ${flightNumber}`,
    text: `${paragraphs.join("\n\n")}\n\n${packUrl}\n\n${DISCLAIMER}`,
    html: html(paragraphs, { href: packUrl, label: "Open your claim pack" }),
    attachments: pdf ? [{ filename: `claim-pack-${flightNumber}.pdf`, content: pdf }] : undefined,
  };
}
