import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createClaimForCheckout, handleOrderPaid, submitDetails } from "@/lib/claims/service";
import { detailsForm, eligibleAnswers, eligibleInput, testDeps } from "@/lib/claims/fixtures";
import { renderClaimPackPdf } from "@/lib/pdf/claim-pack";

function hasPdftotext() {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("renderClaimPackPdf", () => {
  it("renders a PDF with every letter, the amounts and the disclaimer", async () => {
    const { deps, store } = testDeps();
    const claim = await createClaimForCheckout(store, eligibleAnswers, eligibleInput());
    await handleOrderPaid(deps, { claimId: claim.id, orderId: "o", email: "a@b.co", amountCents: 1700, currency: "GBP", testMode: true });
    await submitDetails(deps, claim.packToken, detailsForm);
    const { facts, pack } = (await store.getByPackToken(claim.packToken))!.pack!;

    const pdf = await renderClaimPackPdf(facts, pack);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);

    if (!hasPdftotext()) return;
    const dir = mkdtempSync(join(tmpdir(), "pack-"));
    writeFileSync(join(dir, "p.pdf"), pdf);
    const text = execFileSync("pdftotext", ["-layout", join(dir, "p.pdf"), "-"]).toString();
    for (const expected of [
      "Your claim pack",
      "Claim letter to British Airways",
      "£1,040",
      "£520 per passenger",
      "Reply: voucher offer",
      "Escalation letter",
      "This is not legal advice.",
    ]) {
      expect(text, expected).toContain(expected);
    }
    // Every page carries the disclaimer (CLAUDE.md rule 3): 5 page footers + the cover note.
    expect(text.split("This is not legal advice.").length - 1).toBeGreaterThanOrEqual(6);
    expect(text).not.toContain("→");
  }, 30_000);
});
