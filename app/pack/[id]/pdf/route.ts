import { isPackToken } from "@/lib/claims/token";
import { supabaseConfig } from "@/lib/env";
import { renderClaimPackPdf } from "@/lib/pdf/claim-pack";
import { serviceDeps } from "@/lib/server/deps";

export async function GET(_request: Request, { params }: RouteContext<"/pack/[id]/pdf">) {
  const { id } = await params;
  if (!isPackToken(id) || !supabaseConfig()) return new Response("Not found", { status: 404 });
  const claim = await serviceDeps().store.getByPackToken(id);
  if (!claim || claim.status !== "pack_ready" || !claim.pack) return new Response("Not found", { status: 404 });

  const pdf = await renderClaimPackPdf(claim.pack.facts, claim.pack.pack);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="claim-pack-${claim.pack.facts.flightNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
