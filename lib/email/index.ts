import { DISCLAIMER } from "../legal";
import { SUPPORT_EMAIL } from "../site";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
  /** Where customer replies go. */
  replyTo?: string;
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
<p style="font-size:13px;color:#5b6b65">Questions? Reply to this email or write to ${escape(SUPPORT_EMAIL)}.</p>
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
    replyTo: SUPPORT_EMAIL,
    subject: "Your KeepItAll claim pack is ready to complete",
    text: `${paragraphs.join("\n\n")}\n\n${packUrl}\n\nQuestions? Reply to this email or write to ${SUPPORT_EMAIL}.\n\n${DISCLAIMER}`,
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
    replyTo: SUPPORT_EMAIL,
    subject: `Your claim pack for flight ${flightNumber}`,
    text: `${paragraphs.join("\n\n")}\n\n${packUrl}\n\nQuestions? Reply to this email or write to ${SUPPORT_EMAIL}.\n\n${DISCLAIMER}`,
    html: html(paragraphs, { href: packUrl, label: "Open your claim pack" }),
    attachments: pdf ? [{ filename: `claim-pack-${flightNumber}.pdf`, content: pdf }] : undefined,
  };
}

export function followUpEmail(
  kind: "reply_check" | "escalate",
  to: string,
  packUrl: string,
  flightNumber: string,
  escalateAfterDays: number,
  optOutUrl: string,
): EmailMessage {
  const paragraphs =
    kind === "reply_check"
      ? [
          `It's been two weeks since your claim pack for flight ${flightNumber} was ready. Has the airline replied?`,
          "If they refused because of “extraordinary circumstances”, or offered a voucher, your pack has a ready-made reply for each.",
          "If they paid, congratulations: you kept it all.",
        ]
      : [
          `If the airline still hasn't paid your claim for flight ${flightNumber}, it may be time to escalate (${escalateAfterDays} days have passed).`,
          "Your pack includes an escalation letter for the enforcement body or dispute-resolution scheme. Update the dates in it before you send it.",
        ];
  const footer = `Don't want these reminders? ${optOutUrl}`;
  return {
    to,
    replyTo: SUPPORT_EMAIL,
    subject: kind === "reply_check" ? `Has the airline replied about flight ${flightNumber}?` : `Time to escalate your claim for flight ${flightNumber}?`,
    text: `${paragraphs.join("\n\n")}\n\n${packUrl}\n\n${footer}\n\n${DISCLAIMER}`,
    html: html([...paragraphs, footer], { href: packUrl, label: "Open your claim pack" }),
  };
}
