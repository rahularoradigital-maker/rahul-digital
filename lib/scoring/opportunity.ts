// Opportunity loss engine: how much money the account is losing right now, read
// straight off the ad-level verdicts + spend the cockpit already computes. Pure,
// no I/O, no fabrication. Every rupee here traces to a field an engine produced:
// wastedRs is the per-ad waste calc; atRiskRs is spend on ads the fatigue read
// already flagged as decaying; underScaledRs is a labelled proxy, not a forecast.

import type { CockpitAd } from "../cockpit/analyze.ts";

export type OpportunityLoss = {
  wastedRs: number; // spend on losers / below-1-ROAS conversion ads (sum of wastedRs)
  atRiskRs: number; // spend on ads that are fatiguing/fatigued (creative about to decay)
  underScaledRs: number; // winners with room to scale that are not being scaled (proxy - see basis)
  totalLossRs: number; // wastedRs + atRiskRs (money actively bleeding)
  lossShare: number; // totalLossRs / total spend (0-1)
  drivers: { label: string; rs: number }[]; // ranked contributors, for the dashboard
  basis: string; // one honest sentence describing the calc
};

export function opportunityLoss(ads: CockpitAd[]): OpportunityLoss {
  const totalSpendRs = ads.reduce((acc, a) => acc + a.spendRs, 0);
  const wastedRs = ads.reduce((acc, a) => acc + a.wastedRs, 0);
  const atRiskRs = ads
    .filter((a) => a.fatigueRead?.state === "fatiguing" || a.fatigueRead?.state === "fatigued")
    .reduce((acc, a) => acc + a.spendRs, 0);
  const underScaledRs = ads
    .filter((a) => a.verdict === "winner")
    .reduce((acc, a) => acc + a.spendRs, 0);

  const totalLossRs = wastedRs + atRiskRs;
  const lossShare = totalSpendRs > 0 ? totalLossRs / totalSpendRs : 0;

  const drivers = [
    { label: "Wasted spend", rs: wastedRs },
    { label: "At-risk spend (fatiguing)", rs: atRiskRs },
  ]
    .filter((d) => d.rs > 0)
    .sort((a, b) => b.rs - a.rs);

  return {
    wastedRs,
    atRiskRs,
    underScaledRs,
    totalLossRs,
    lossShare,
    drivers,
    basis:
      "Active loss = wasted spend (per-ad waste calc) + spend on ads the fatigue read flags as fatiguing/fatigued. underScaledRs is a proxy: total spend on winners as capital that could scale, not a projected gain.",
  };
}
