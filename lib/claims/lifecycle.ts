import { followUpEmail } from "../email";
import { escalationAfterDays } from "../enforcement";
import config from "./lifecycle.json";
import { packUrl, type ServiceDeps } from "./service";
import type { ClaimRecord, FollowUpId, PurgeCutoffs, PurgeResult } from "./types";

const DAY_MS = 86_400_000;
const ORDER: FollowUpId[] = ["reply_check", "escalate"];

export function followUpDelayDays(id: FollowUpId, claim: Pick<ClaimRecord, "regime">): number {
  const after = config.followUps[id].afterDays;
  return after === "escalation" ? escalationAfterDays(claim.regime) : Number(after);
}

/** Follow-ups that are due and not yet sent, in order. */
export function dueFollowUps(claim: ClaimRecord, now: Date): FollowUpId[] {
  if (claim.status !== "pack_ready" || claim.followUpsOptOut || !claim.packReadyAt) return [];
  const ready = new Date(claim.packReadyAt).getTime();
  return ORDER.filter((id) => !claim.followUps[id] && now.getTime() - ready >= followUpDelayDays(id, claim) * DAY_MS);
}

export function purgeCutoffs(now: Date): PurgeCutoffs {
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
  return {
    unpaidBefore: ago(config.retention.unpaidClaimDays),
    refundedBefore: ago(config.retention.refundedClaimDays),
    packDetailsBefore: ago(config.retention.packDetailsDays),
  };
}

export interface DailyJobResult {
  followUpsSent: number;
  followUpsFailed: number;
  purge: PurgeResult;
}

/**
 * Daily: send due follow-ups (at most one email per claim per run — if several are
 * due, only the latest is sent and the earlier ones are marked as superseded),
 * then apply the retention policy.
 */
export async function runDailyJobs(deps: ServiceDeps, now: Date = new Date()): Promise<DailyJobResult> {
  const earliest = Math.min(...ORDER.map((id) => Number(config.followUps[id].afterDays) || Infinity));
  const readyBefore = new Date(now.getTime() - earliest * DAY_MS).toISOString();
  const at = now.toISOString();
  let followUpsSent = 0;
  let followUpsFailed = 0;

  for (const claim of await deps.store.listFollowUpCandidates(readyBefore)) {
    const due = dueFollowUps(claim, now);
    const latest = due.at(-1);
    const to = claim.details?.email;
    if (!latest || !to || !claim.pack) continue;
    try {
      const base = packUrl(deps.siteUrl, claim.packToken);
      await deps.email.send(
        followUpEmail(latest, to, base, claim.pack.facts.flightNumber, escalationAfterDays(claim.regime), `${base}/emails`),
      );
      for (const id of due) await deps.store.markFollowUpSent(claim.id, id, at);
      followUpsSent++;
    } catch (err) {
      followUpsFailed++;
      deps.log?.("follow-up email failed", { claimId: claim.id, error: (err as Error).message });
    }
  }

  return { followUpsSent, followUpsFailed, purge: await deps.store.purge(purgeCutoffs(now)) };
}
