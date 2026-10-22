// Server-only: rendered with @react-pdf/renderer in a route handler / server action.
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ClaimPack } from "../letters/pack";
import type { ClaimFacts } from "../letters/types";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10.5, lineHeight: 1.45, color: "#1a2b25" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  muted: { color: "#5b6b65" },
  disclaimer: { marginTop: 8, padding: 8, backgroundColor: "#eef5f1", fontSize: 9 },
  section: { marginTop: 18 },
  step: { flexDirection: "row", marginBottom: 6 },
  stepNum: { width: 16, fontFamily: "Helvetica-Bold" },
  stepText: { flex: 1 },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#5b6b65", textAlign: "center" },
});

function Footer({ facts, disclaimer }: { facts: ClaimFacts; disclaimer: string }) {
  return (
    <Text style={styles.footer} fixed>
      {facts.flightNumber} · {disclaimer}
    </Text>
  );
}

function LetterPage({ title, note, text, facts, disclaimer }: { title: string; note?: string; text: string; facts: ClaimFacts; disclaimer: string }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h2}>{title}</Text>
      {note && <Text style={[styles.muted, { marginBottom: 12 }]}>{note}</Text>}
      <Text>{text}</Text>
      <Footer facts={facts} disclaimer={disclaimer} />
    </Page>
  );
}

export function ClaimPackDocument({ facts, pack }: { facts: ClaimFacts; pack: ClaimPack }) {
  return (
    <Document title={`Claim pack – ${facts.flightNumber}`} author="KeepItAll" language="en-GB">
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Your claim pack</Text>
        <Text style={styles.muted}>
          Flight {facts.flightNumber} · {facts.departure.iata} to {facts.arrival.iata} · booking {facts.bookingReference}
        </Text>
        <Text style={styles.disclaimer}>{pack.disclaimer}</Text>

        <View style={styles.section}>
          <Text style={styles.h2}>How to send your claim</Text>
          {pack.howToSend.map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={styles.stepNum}>{i + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>What’s in this pack</Text>
          <Text>1. Claim letter to {facts.airline.name}</Text>
          <Text>2. Reply if the airline claims “extraordinary circumstances”</Text>
          <Text>3. Reply if the airline offers vouchers</Text>
          <Text>4. Escalation letter (after {pack.escalation.afterDays} days without payment)</Text>
        </View>
        <Footer facts={facts} disclaimer={pack.disclaimer} />
      </Page>

      <LetterPage title={`1. Claim letter to ${facts.airline.name}`} text={pack.claimLetter.text} facts={facts} disclaimer={pack.disclaimer} />
      <LetterPage
        title="2. Reply: “extraordinary circumstances”"
        note="Send this if the airline refuses because of extraordinary circumstances."
        text={pack.replies.extraordinaryCircumstances}
        facts={facts}
        disclaimer={pack.disclaimer}
      />
      <LetterPage
        title="3. Reply: voucher offer"
        note="Send this if the airline offers a voucher instead of money."
        text={pack.replies.vouchers}
        facts={facts}
        disclaimer={pack.disclaimer}
      />
      <LetterPage
        title="4. Escalation letter"
        note={`Send this if you have not been paid after ${pack.escalation.afterDays} days. Update the dates if you sent your claim later.`}
        text={pack.escalation.letter}
        facts={facts}
        disclaimer={pack.disclaimer}
      />
    </Document>
  );
}

export function renderClaimPackPdf(facts: ClaimFacts, pack: ClaimPack): Promise<Buffer> {
  return renderToBuffer(<ClaimPackDocument facts={facts} pack={pack} />);
}
