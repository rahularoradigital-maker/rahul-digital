// Aggregate every §110 contract the current account data can produce into ONE decision picture (charter §4
// "WHAT SHOULD WE DO", §160). Pure: takes the already-loaded CockpitData and runs the adapters whose inputs
// live in it. Returns only DECIDED contracts (things to act on) - HOLDs are "can't decide yet", not priorities.
//
// It deliberately SEPARATES two ₹ scales that must not be ranked against each other:
//   - `priorities`: per-AD decisions (fatigue / winner), ranked by that ad's money at stake - comparable.
//   - `accountReads`: account-LEVEL decisions (diversity fragility, scaling headroom) whose "at stake" is a
//     whole-account figure; mixing them into the per-ad ₹ ranking would let one account number bury every ad.
// One row per ad: the more material (higher ₹) of an ad's fatigue/winner calls wins, so nothing double-counts.

import type { CockpitData } from "@/lib/app/cockpit-data";
import type { OutputContract } from "./output-contract.ts";
import { fatigueToContract } from "./from-fatigue.ts";
import { winnerToContract } from "./from-winner.ts";
import { diversityToContract } from "./from-diversity.ts";
import { marginalToContract } from "./from-marginal.ts";
import { critiqued } from "./critic-review.ts";

export type DecisionFeed = {
  priorities: OutputContract[]; // per-ad decisions, ranked by money at stake (biggest first)
  accountReads: OutputContract[]; // account-level decisions (diversity, scaling) - context, not ₹-mixed with priorities
};

const impact = (c: OutputContract) => c.economicImpactRs ?? 0;

export function collectDecisions(data: CockpitData): DecisionFeed {
  if (!data.connected) return { priorities: [], accountReads: [] };
  const spend = data.scopeTotals.spendRs;
  const accountId = data.accountId;

  // Per-ad: fatigue + winner. Keep only decisions; one row per ad (highest ₹ wins).
  const byAd = new Map<string, OutputContract>();
  for (const ad of data.view.leaderboard) {
    for (const raw of [fatigueToContract(ad), winnerToContract(ad)]) {
      if (!raw || !raw.decision) continue;
      const c = critiqued(raw); // §53-56: the always-on critic caps confidence to the evidence tier
      const key = c.entity?.id ?? c.id;
      const prev = byAd.get(key);
      if (!prev || impact(c) > impact(prev)) byAd.set(key, c);
    }
  }
  const priorities = [...byAd.values()].sort((a, b) => impact(b) - impact(a));

  // Account-level reads (kept separate; their ₹ is whole-account, not per-ad).
  const accountReads: OutputContract[] = [];
  if (data.ownDiversity) {
    const d = diversityToContract(data.ownDiversity, { entityId: accountId, accountSpendRs: spend });
    if (d?.decision) accountReads.push(critiqued(d));
  }
  const m = marginalToContract(data.marginal, { entityId: accountId, name: data.accountName, spendRs: spend, level: "account" });
  if (m?.decision) accountReads.push(critiqued(m));

  return { priorities, accountReads };
}
