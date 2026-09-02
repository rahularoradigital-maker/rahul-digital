// System trust (charter §8-12, applied to the intelligence itself): one honest read of how much a user should
// trust AdScale right now, from three independent signals - is the DATA reconciled (no source conflicts), are
// the DECISIONS proven (enough graded outcomes at a good hit-rate), and how active is the CRITIC (how often it
// had to lower confidence). Pure. This is the product being honest about its own reliability, not a vanity
// score: a data conflict alone drops it to "shaky" no matter how good the decisions look.

import type { ReconSummary } from "./reconcile.ts";
import type { AccuracyStats } from "./outcome.ts";

export type TrustTier = "trusted" | "watch" | "shaky";

export type SystemTrust = {
  tier: TrustTier;
  dataOk: boolean; // no source conflicts (reconciliation)
  decisionsProven: boolean; // enough graded outcomes to trust the hit-rate
  hitRate: number | null; // decision hit-rate when proven, else null
  criticDowngradeRate: number; // share of decisions the critic had to lower (0..1)
  reasons: string[];
};

const GOOD_HITRATE = 0.7; // at/above this on a proven sample = the decisions are reliable

export function systemTrust(recon: ReconSummary, accuracy: AccuracyStats, decisions: number, criticDowngrades: number): SystemTrust {
  const dataOk = recon.conflicts === 0;
  const decisionsProven = accuracy.trustworthy;
  const hitRate = accuracy.hitRate;
  const criticDowngradeRate = decisions > 0 ? criticDowngrades / decisions : 0;
  const reasons: string[] = [];

  if (!dataOk) reasons.push(`${recon.conflicts} source metric${recon.conflicts === 1 ? "" : "s"} conflict - numbers can't be fully trusted yet`);
  else if (recon.drifts > 0) reasons.push(`${recon.drifts} metric${recon.drifts === 1 ? "" : "s"} drifting between sources (minor)`);
  else reasons.push("sources reconcile - the numbers agree");

  if (!decisionsProven) reasons.push(`decision accuracy not yet proven (only ${accuracy.n} graded outcome${accuracy.n === 1 ? "" : "s"}, need more)`);
  else reasons.push(`decisions have been right ${Math.round((hitRate ?? 0) * 100)}% of the time on ${accuracy.n} graded calls`);

  if (criticDowngradeRate >= 0.5) reasons.push(`the critic lowered confidence on ${Math.round(criticDowngradeRate * 100)}% of decisions - evidence is often thin`);

  // A data conflict caps trust at "shaky" regardless of decision quality (bad data -> bad decisions).
  let tier: TrustTier;
  if (!dataOk) tier = "shaky";
  else if (decisionsProven && (hitRate ?? 0) >= GOOD_HITRATE && criticDowngradeRate < 0.5) tier = "trusted";
  else tier = "watch";

  return { tier, dataOk, decisionsProven, hitRate, criticDowngradeRate, reasons };
}
