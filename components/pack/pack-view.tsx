import type { ClaimPack } from "@/lib/letters/pack";
import type { ClaimFacts } from "@/lib/letters/types";
import { CopyButton } from "./copy-button";
import { DownloadPdfLink } from "./download-link";

function Letter({ title, note, text }: { title: string; note?: string; text: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <CopyButton text={text} />
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      <div className="max-h-[28rem] overflow-y-auto rounded-lg border bg-card p-4 text-sm leading-relaxed whitespace-pre-wrap">{text}</div>
    </section>
  );
}

export function PackView({ token, facts, pack }: { token: string; facts: ClaimFacts; pack: ClaimPack }) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Your claim pack is ready</h1>
        <p className="text-muted-foreground">
          Flight {facts.flightNumber} · {facts.departure.iata} → {facts.arrival.iata} · booking {facts.bookingReference}
        </p>
      </header>

      <DownloadPdfLink href={`/pack/${token}/pdf`} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">How to send it</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {pack.howToSend.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <Letter title={`Claim letter to ${facts.airline.name}`} text={pack.claimLetter.text} />

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-semibold">If the airline replies</summary>
        <div className="mt-4 flex flex-col gap-8">
          <Letter
            title="Reply: “extraordinary circumstances”"
            note="Send this if the airline refuses because of extraordinary circumstances."
            text={pack.replies.extraordinaryCircumstances}
          />
          <Letter title="Reply: voucher offer" note="Send this if the airline offers a voucher instead of money." text={pack.replies.vouchers} />
        </div>
      </details>

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-semibold">If you haven’t been paid after {pack.escalation.afterDays} days</summary>
        <div className="mt-4">
          <Letter
            title="Escalation letter"
            note={
              pack.escalation.body
                ? `Send this to ${pack.escalation.body.name}. Update the dates if you sent your claim later.`
                : "Send this to the national enforcement body or the airline's dispute-resolution scheme. Update the dates if you sent your claim later."
            }
            text={pack.escalation.letter}
          />
        </div>
      </details>
    </div>
  );
}
