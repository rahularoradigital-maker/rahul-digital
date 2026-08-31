// The Google decision engine: deterministic, no AI. Given a campaign's real numbers it routes to ONE
// correct action, the way a senior Google buyer would - and, crucially, REFUSES to recommend a bid/budget
// change while a campaign is still in its Smart Bidding learning phase, because that change would reset
// learning and make things worse (correctness over a tidy-looking suggestion). Every rule traces to a
// sourced behavior (see thresholds.ts + docs/google-ads-architecture.md). Pure + node-gate-able.
//
// Ruleset (from the algorithm research): R1/R2 budget routing, R3 rank routing, R4/R5/R7 learning guards,
// R8/R9 Quality Score triage, R14 eCPC migration, R15 tROAS eligibility.

import type { GoogleAccountSnapshot, GoogleCampaignSnapshot } from "./types.ts";
import { t } from "./thresholds.ts";

export type GoogleFindingKind = "scale" | "efficiency" | "rank" | "learning" | "quality" | "eligibility" | "hygiene";
export type GoogleSeverity = "high" | "medium" | "low";

export type GoogleFinding = {
  rule: string; // "R1".."R15" - traceability to the sourced ruleset
  campaignId: string;
  campaignName: string;
  kind: GoogleFindingKind;
  severity: GoogleSeverity;
  title: string; // short, plain English (Rahul's voice: simple, shortest)
  detail: string; // why, in one line
  action: string; // exactly what to do (or explicitly: do nothing yet)
  moneyAtStake: number; // rupees, for ranking (headroom or spend exposed)
};

const SEV_RANK: Record<GoogleSeverity, number> = { high: 0, medium: 1, low: 2 };

// Is the campaign meeting its own efficiency target? value-based -> ROAS vs targetRoas; else CPA vs targetCpa.
// Unknown target -> treat as "meeting" (do not block scaling on a target the buyer never set).
function meetsTarget(c: GoogleCampaignSnapshot): boolean {
  if (c.targetRoas != null && c.roas != null) return c.roas >= c.targetRoas;
  if (c.targetCpa != null && c.cpa != null) return c.cpa <= c.targetCpa;
  return true;
}

// Learning guard: true when a bid/budget change would reset Smart Bidding learning or be judged on too-thin
// data. R4 (under-fed: <~1/4 of the ~15-conv/30d floor in the last 7 days) + R5 (a change inside the ~14-day
// learning window). While guarded, we suppress R1/R2/R3 (the levers that reset learning) for this campaign.
function learningGuard(c: GoogleCampaignSnapshot): { held: boolean; reason: string } {
  const weeklyFloor = t("tcpaMinConversions30d") / 4; // ~3.75 conv/week => clearly under-fed
  if (c.conversions7d < weeklyFloor)
    return { held: true, reason: `only ${c.conversions7d} conversions in 7 days (under the learning floor) - the algorithm is still learning` };
  if (c.daysSinceLastChange != null && c.daysSinceLastChange < t("learningWindowDays"))
    return { held: true, reason: `changed ${c.daysSinceLastChange} days ago - inside the ~${t("learningWindowDays")}-day learning window` };
  return { held: false, reason: "" };
}

function diagnoseCampaign(c: GoogleCampaignSnapshot): GoogleFinding[] {
  const out: GoogleFinding[] = [];
  const base = { campaignId: c.campaignId, campaignName: c.name };
  const guard = learningGuard(c);

  // --- R14: eCPC is deprecated (sunset 2025) - a structural fix, safe during learning ---
  if (c.bidStrategy === "ecpc") {
    out.push({ ...base, rule: "R14", kind: "hygiene", severity: "medium",
      title: "Migrate off Enhanced CPC", detail: "eCPC was sunset in 2025; the campaign is effectively running manual CPC.",
      action: "Move to Maximize Conversions (or add a target) so bidding is automated again.", moneyAtStake: c.cost });
  }

  // --- Budget / rank routing (R1/R2/R3) - HELD while learning, because these reset it ---
  if (guard.held) {
    out.push({ ...base, rule: "R5", kind: "learning", severity: "low",
      title: "Hold - still learning", detail: guard.reason,
      action: "Do not change budget, bid, or target yet. Let it settle, then re-check.", moneyAtStake: 0 });
  } else {
    const lostBudget = c.lostIsBudget ?? 0;
    const lostRank = c.lostIsRank ?? 0;
    if (lostBudget > t("lostIsBudgetConstrained")) {
      if (meetsTarget(c)) {
        // R1: winner capped by budget -> scale. Headroom proxy: the share of spend it is being denied.
        out.push({ ...base, rule: "R1", kind: "scale", severity: "high",
          title: "Raise budget - winning but capped", detail: `losing ${Math.round(lostBudget * 100)}% of impressions to budget while hitting target`,
          action: `Raise the daily budget in steps of <=${Math.round(t("budgetChangeResetPct") * 100)}% so learning is not reset.`,
          moneyAtStake: Math.round(c.cost * lostBudget) });
      } else {
        // R2: capped by budget but MISSING target -> do NOT scale
        out.push({ ...base, rule: "R2", kind: "efficiency", severity: "medium",
          title: "Do not scale - fix efficiency first", detail: `budget-capped but below target, so more budget just buys more losing clicks`,
          action: "Tighten targeting / negatives / bids to hit target before adding budget.", moneyAtStake: c.cost });
      }
    } else if (lostRank > t("lostIsRankConstrained")) {
      // R3: losing to rank, not budget -> fix Ad Rank, not spend
      out.push({ ...base, rule: "R3", kind: "rank", severity: "medium",
        title: "Fix Ad Rank, not budget", detail: `losing ${Math.round(lostRank * 100)}% of impressions to rank - more budget will not help`,
        action: "Raise bid/target or improve Quality Score and assets to compete.", moneyAtStake: Math.round(c.cost * lostRank) });
    }
  }

  // --- R8/R9: Quality Score penalty (Search). Asset/keyword work, so it can fire during learning ---
  if (c.qualityScore != null && c.qualityScore <= t("qualityScorePoor") && c.cost > 0) {
    const priority = Math.round(c.cost * (t("qualityScoreGood") - c.qualityScore)); // R9: cost * (7 - QS)
    const weak = c.expectedCtrBucket === "below_average" ? "expected CTR (rewrite the ad)"
      : c.adRelevanceBucket === "below_average" ? "ad relevance (tighten keyword-to-ad match)"
      : c.landingPageBucket === "below_average" ? "landing page experience (fix the page)"
      : "the weakest quality component";
    out.push({ ...base, rule: "R8", kind: "quality", severity: "high",
      title: "Quality Score is costing you", detail: `QS ${c.qualityScore}/10 pays a CPC premium; weakest lever is ${weak}`,
      action: `Fix ${weak}. Highest-money keyword to fix first (cost x (7-QS)).`, moneyAtStake: priority });
  }

  // --- R15: eligible to move to value bidding ---
  const valueBased = c.bidStrategy === "target_roas" || c.bidStrategy === "maximize_conversion_value";
  if (!valueBased && c.distinctConversionValues && c.conversions >= t("troasRecommendedConversions30d")) {
    out.push({ ...base, rule: "R15", kind: "eligibility", severity: "low",
      title: "Ready for value bidding (tROAS)", detail: `${c.conversions} conversions with distinct values - enough to optimise for revenue, not just count`,
      action: "Switch to Maximize Conversion Value with a Target ROAS near recent actuals.", moneyAtStake: Math.round(c.conversionValue) });
  }

  return out;
}

export type GoogleDiagnosis = {
  findings: GoogleFinding[];
  totalMoneyAtStake: number;
  counts: Record<GoogleSeverity, number>;
};

// Diagnose an account: every campaign through the engine, findings ranked by severity then money at stake.
export function diagnoseGoogleAccount(snap: GoogleAccountSnapshot): GoogleDiagnosis {
  const findings = snap.campaigns.flatMap(diagnoseCampaign)
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.moneyAtStake - a.moneyAtStake);
  const counts: Record<GoogleSeverity, number> = { high: 0, medium: 0, low: 0 };
  let total = 0;
  for (const f of findings) { counts[f.severity]++; total += f.moneyAtStake; }
  return { findings, totalMoneyAtStake: total, counts };
}
