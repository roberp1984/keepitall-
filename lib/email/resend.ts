// Server-only.
import { Resend } from "resend";
import type { EmailConfig } from "../env";
import type { EmailSender } from "./index";

export function resendSender(config: EmailConfig, client: Pick<Resend, "emails"> = new Resend(config.apiKey)): EmailSender {
  return {
    async send(message) {
      const { error } = await client.emails.send({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      });
      if (error) throw new Error(`Email failed: ${error.message}`);
    },
  };
}
