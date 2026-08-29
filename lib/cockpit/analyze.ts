// The integration seam: runs the tested brain engines over an account and returns
// exactly what the cockpit renders. Pure, no I/O. Today the input is a SAMPLE
// account (so there is something real to click before a live Meta account is
// connected); the same function accepts live-derived ads later without changing
// the UI. Every surfaced number carries a fact label or comes straight from a
// tested engine. AI narrates, engines compute.

import { verdict, VERDICT_WEIGHTS, type Verdict, type VerdictInput, type ScoreWeights } from "../rules/verdict.ts";
export type { Verdict } from "../rules/verdict.ts";
import { wasteRollup, budgetConcentration, type ConcentrationResult, type AdSummary } from "../rules/account.ts";
import type { DiagnoseResult } from "../causality.ts";
import type { Objective } from "../rules/comparator.ts";
import { objectiveFamily, objectiveReason } from "../rules/objective-metrics.ts";
import type { FatigueRead } from "../scoring/fatigue.ts";
import { decide, type Decision } from "../scoring/decision.ts";
import type { Explanation } from "../scoring/rubrics.ts";
import { opportunityLoss, type OpportunityLoss } from "../scoring/opportunity.ts";
import { winnerScores, type WinnerScores } from "../scoring/winner.ts";

// Map the objective-aware decision to the leaderboard's verdict vocabulary + the action row.
const DECISION_VERDICT: Record<Decision["action"], Verdict> = {
  scale: "winner",
  continue: "winner",
  refresh: "refresh",
  pause: "loser",
  hold: "do_not_kill_yet",
};
const DECISION_LABEL: Record<Decision["action"], string> = {
  scale: "Scale the budget",
  continue: "Keep running",
  refresh: "Refresh the creative",
  pause: "Pause this ad",
  hold: "Hold - gather more data",
};

/** One ad as the cockpit needs it. Sub-scores are 0-100 (produced upstream by the
 *  scoring engines); the raw facts drive verdict, waste, and the action queue. */
export type CockpitAdInput = VerdictInput & {
  id: string;
  name: string;
  adSetId?: string; // parent ad set / campaign ids, for the Ads Manager deep link hierarchy
  campaignId?: string;
  adsetName?: string; // readable parent names, so money figures trace to a campaign / ad set
  campaignName?: string;
  active?: boolean; // current delivery status; false = paused/archived (hidden from suggestions)
  thumbUrl?: string | null; // best still image for the leaderboard thumbnail; null/absent when none
  objective: Objective;
  spendRs: number;
  revenueRs: number;
  wastedRs: number; // per-ad wasted spend (upstream waste calc; sample supplies it)
  // Absolute 0-100 objective score (scoring.healthScoreOf): ROAS-vs-benchmark for
  // conversion, CTR-vs-benchmark for click objectives, reach+freshness for awareness.
  // Optional so hand-built fixtures / the sample account fall back to CreativeScore.
  healthScore?: number | null;
  // Day-wise fatigue read + creative half-life (days to the fatigue floor). Optional so
  // fixtures without daily rows still type-check.
  fatigueRead?: FatigueRead;
  halfLifeDays?: number | null;
};

export type Priority = "DO_NOW" | "DO_NEXT" | "WATCH";

export type CockpitAction = { label: string; priority: Priority; why: string };

export type CockpitAd = {
  id: string;
  name: string;
  adSetId?: string; // parent ad set / campaign ids, for the Ads Manager deep link hierarchy
  campaignId?: string;
  adsetName?: string; // readable parent names, so money figures trace to a campaign / ad set
  campaignName?: string;
  active?: boolean; // current delivery status; false = paused/archived (hidden from suggestions)
  thumbUrl?: string | null; // best still image for the leaderboard thumbnail; null/absent when none
  objective: Objective;
  spendRs: number;
  revenueRs: number;
  roas: number | null; // null when spend is 0 (never a fabricated ratio)
  conversions: number; // purchases in the window (real, from the day-wise rows)
  verdict: Verdict;
  score: number;
  confidence: number;
  why: string[];
  action: CockpitAction;
  wastedRs: number;
  fatigueRead?: FatigueRead; // day-wise fatigue read (state, trajectory, evidence)
  halfLifeDays?: number | null; // creative half-life: days to the fatigue floor
  winner?: WinnerScores; // multi-factor winner rank (quality x scale x stability x opportunity)
};

// Account creative half-life: the spend-weighted median of the ads' half-lives (days to the
// fatigue floor). Null when too few ads have a day-wise read to say anything honest.
export type CreativeHalfLife = {
  medianDays: number | null;
  assessedAds: number; // ads with a real day-wise half-life
  fatiguingAds: number; // ads whose fatigue state is fatiguing or fatigued
  basis: string;
};

// One ad's contribution to a money-bleeding total, so a headline rupee figure is always
// traceable to the exact ads + the calculation behind it (never an unexplained number).
export type SpendContributor = {
  adId: string;
  name: string;
  adSetId?: string;
  campaignId?: string;
  adsetName?: string; // readable campaign / ad set the ad belongs to
  campaignName?: string;
  amountRs: number; // the rupees this ad contributes to the total
  roas: number | null;
  spendRs: number;
  fatigueState?: string; // for at-risk rows
};

export type CockpitView = {
  dataSource: "SAMPLE" | "LIVE";
  totals: { spendRs: number; revenueRs: number; roas: number | null };
  accountHealth: { score: number; factLabel: "MODEL_ESTIMATE"; basis: string; explain: Explanation };
  creativeHalfLife: CreativeHalfLife;
  opportunity: OpportunityLoss; // money bleeding: wasted + at-risk (fatiguing) spend

  leaderboard: CockpitAd[]; // sorted by CreativeScore, best first
  doThis: (CockpitAction & { adId: string; adName: string })[]; // sorted by priority
  waste: ReturnType<typeof wasteRollup>;
  wasteContributors: SpendContributor[]; // which ads make up the wasted spend + the math
  atRiskContributors: SpendContributor[]; // which fatiguing/fatigued ads make up the at-risk spend
  concentration: ConcentrationResult;
};

const PRIORITY_RANK: Record<Priority, number> = { DO_NOW: 0, DO_NEXT: 1, WATCH: 2 };

/** Turn a verdict (+ any diagnosed cause) into the single next action for that ad. */
function actionFor(v: Verdict, input: CockpitAdInput): CockpitAction {
  const d = input.diagnosis;
  const cause = d !== undefined && d.status === "ok" ? d.cause : undefined;
  switch (v) {
    case "loser":
      return { label: "Kill this ad", priority: "DO_NOW", why: "Creative is spent and every non-creative cause was ruled out." };
    case "refresh":
      return { label: "Refresh the creative", priority: "DO_NEXT", why: "Fatigue is high but the funnel still converts. New creative, same offer." };
    case "do_not_kill_yet":
      if (cause !== undefined && cause !== "creative_fatigue") {
        return { label: `Fix ${cause.replace(/_/g, " ")} first`, priority: "DO_NEXT", why: "The drop traces to a non-creative cause. Do not kill the ad." };
      }
      return { label: "Hold — gather more data", priority: "WATCH", why: "Not enough signal to act without risk." };
    case "winner":
      return input.roomToScale
        ? { label: "Scale the budget", priority: "DO_NEXT", why: "All winner gates met with room to scale." }
        : { label: "Keep running", priority: "WATCH", why: "A proven winner with no headroom to scale right now." };
  }
}

function roasOf(spendRs: number, revenueRs: number): number | null {
  return spendRs > 0 ? revenueRs / spendRs : null;
}

/**
 * Account Health 0-100: the spend-weighted ABSOLUTE objective score of the account's
 * ads (scoring.healthScoreOf: ROAS-vs-benchmark, CTR-vs-benchmark, reach+freshness),
 * then a waste penalty. Because the base is absolute (benchmark-anchored), not a within-
 * account percentile, it genuinely differs between accounts and moves with real
 * performance, instead of pinning to 50 whenever nothing is a clear winner or loser.
 * Ads with no explicit healthScore (the sample account / hand-built fixtures) fall back
 * to their CreativeScore. INTERNAL CALIBRATION, labelled MODEL_ESTIMATE.
 */
function accountHealth(ads: CockpitAd[], inputs: CockpitAdInput[], totalSpendRs: number, totalWastedRs: number): CockpitView["accountHealth"] {
  if (ads.length === 0 || totalSpendRs <= 0) {
    return {
      score: 0,
      factLabel: "MODEL_ESTIMATE",
      basis: "no spend to assess",
      explain: {
        rubricId: "account_health",
        headline: "0/100: no spend to assess yet.",
        steps: [{ label: "Account Health", value: "0/100" }],
        contributions: [],
      },
    };
  }
  // Spend-weight each ad's absolute objective score (fall back to CreativeScore). ads and
  // inputs are index-aligned: scored is inputs.map(...) upstream.
  let weighted = 0;
  let weight = 0;
  ads.forEach((a, i) => {
    const h = inputs[i]?.healthScore ?? a.score;
    if (h === null) return; // genuinely unscorable ad: leave it out of the average
    const w = Math.max(a.spendRs, 0);
    weighted += w * h;
    weight += w;
  });
  const base = weight > 0 ? weighted / weight : 0;
  const wasteShare = totalWastedRs / totalSpendRs;
  const score = Math.max(0, Math.min(100, Math.round(base - 25 * wasteShare)));
  const winnerShare = ads.filter((a) => a.verdict === "winner").reduce((acc, a) => acc + a.spendRs, 0) / totalSpendRs;
  // Top ads by spend become the per-ad drivers in the "Why this score?" drawer. Each ad's
  // absolute objective score (fall back to CreativeScore) is what the spend-weighted base is
  // built from, so these rows are the honest breakdown of the headline number.
  const contributions = ads
    .map((a, i) => {
      const h = inputs[i]?.healthScore ?? a.score;
      return { name: a.name, tag: a.objective, metric: `${h}/100`, score: h, spendShare: a.spendRs / totalSpendRs };
    })
    .sort((x, y) => y.spendShare - x.spendShare)
    .slice(0, 6);
  const explain: Explanation = {
    rubricId: "account_health",
    headline: `${score}/100: spend-weighted average of each ad's objective score (${Math.round(base)}), minus a ${Math.round(wasteShare * 100)}% waste penalty.`,
    steps: [
      { label: "Spend-weighted objective performance", value: `${Math.round(base)}/100` },
      { label: "Waste penalty", value: `-${Math.round(25 * wasteShare)}` },
      { label: "Account Health", value: `${score}/100` },
    ],
    contributions,
  };
  return {
    score,
    factLabel: "MODEL_ESTIMATE",
    basis: `${Math.round(base)}/100 objective performance, spend-weighted; ${Math.round(winnerShare * 100)}% on winners, ${Math.round(wasteShare * 100)}% wasted`,
    explain,
  };
}

export function analyzeAccount(ads: CockpitAdInput[], dataSource: "SAMPLE" | "LIVE" = "SAMPLE", weights: ScoreWeights = VERDICT_WEIGHTS): CockpitView {
  const scored: CockpitAd[] = ads.map((input) => {
    const v = verdict(input, weights);
    const roas = roasOf(input.spendRs, input.revenueRs);
    // Judge each ad on its OBJECTIVE'S metric family (rules/objective-metrics). "sales"
    // objectives (conversion / sale / catalog) keep the rigorous verdict engine (ROAS + causality
    // ladder). "awareness" objectives (awareness/engagement/traffic/leads/installs) have no ROAS
    // or purchase gate, so the verdict engine collapsed every one to Hold/35% and could flag them
    // a loser for a 0 ROAS they were never optimised to earn. Route those through the objective-
    // aware decision engine, which reads CPM/CTR/CPC/LPV (via healthScore) + the day-wise fatigue
    // trajectory, so they get real Scale/Continue/Refresh/Pause calls. Every verdict's "why" names
    // the objective-appropriate read, so the reason is explainable, never a silent ROAS judgement.
    const reason = objectiveReason(input.objective);
    let vVerdict = v.verdict;
    let confidence = v.confidence;
    let why = [reason, ...v.why];
    let action = actionFor(v.verdict, input);
    if (objectiveFamily(input.objective) === "awareness") {
      if (input.healthScore === null) {
        // No fabrication: the objective's own metric could not be formed (e.g. no impressions),
        // so there is no honest awareness read. Hold and gather more; never fall back to the
        // ROAS-led CreativeScore for an ad that was never optimised to convert.
        vVerdict = "do_not_kill_yet";
        confidence = 0.3;
        why = [reason, "Not enough signal on the objective's own metric yet - hold."];
        action = { label: "Hold - gather more data", priority: "WATCH", why: why[1] };
      } else {
        const d = decide({
          objective: input.objective,
          objectiveScore: input.healthScore ?? v.score,
          performance: input.performance,
          fatigueState: input.fatigueRead?.state ?? "watch",
          fatigueTrajectory: input.fatigueRead?.trajectory ?? "stable",
          fatigueSufficiency: input.fatigueRead?.sufficiency ?? "insufficient_data",
          roas,
          conversions: input.conversions,
          days: input.days,
          roomToScale: input.roomToScale,
        });
        vVerdict = DECISION_VERDICT[d.action];
        confidence = d.confidence;
        why = [reason, ...d.why];
        action = { label: DECISION_LABEL[d.action], priority: d.priority, why: d.why[0] ?? "" };
      }
    }
    return {
      id: input.id,
      name: input.name,
      adSetId: input.adSetId,
      campaignId: input.campaignId,
      adsetName: input.adsetName,
      campaignName: input.campaignName,
      active: input.active,
      thumbUrl: input.thumbUrl,
      objective: input.objective,
      spendRs: input.spendRs,
      revenueRs: input.revenueRs,
      roas,
      conversions: input.conversions,
      verdict: vVerdict,
      score: v.score,
      confidence,
      why,
      action,
      wastedRs: input.wastedRs,
      fatigueRead: input.fatigueRead,
      halfLifeDays: input.halfLifeDays,
    };
  });

  // Winner scores: a multi-factor rank (quality x proven scale x stability x upside) so a
  // tiny-spend high-ROAS fluke cannot outrank a scaled workhorse. Needs the account's biggest
  // spender to normalise the scale term, so it runs as a second pass once every ad is scored.
  const accountMaxSpend = scored.reduce((m, a) => Math.max(m, a.spendRs), 0);
  scored.forEach((a, i) => {
    const input = ads[i];
    a.winner = winnerScores(
      {
        objectiveScore: input.healthScore ?? a.score,
        spendRs: a.spendRs,
        roas: a.roas,
        fatigueState: input.fatigueRead?.state ?? "watch",
        stable: (input.fatigueRead?.trajectory ?? "stable") !== "worsening",
        days: input.days,
        halfLifeDays: input.halfLifeDays ?? null,
      },
      accountMaxSpend,
    );
  });

  const leaderboard = [...scored].sort((a, b) => b.score - a.score);

  // Suggestions are for ACTIVE ads only: nobody needs to be told to kill/refresh an ad that is
  // already paused (it is not wasting budget). Unknown status (active === undefined) still shows,
  // so a failed status lookup never hides a real budget leak.
  const doThis = scored
    .filter((a) => a.active !== false)
    .map((a) => ({ adId: a.id, adName: a.name, ...a.action }))
    .sort((x, y) => PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority]);

  const totalSpendRs = scored.reduce((acc, a) => acc + a.spendRs, 0);
  const totalRevenueRs = scored.reduce((acc, a) => acc + a.revenueRs, 0);
  const totalWastedRs = scored.reduce((acc, a) => acc + a.wastedRs, 0);

  const waste = wasteRollup(scored.map((a) => ({ adId: a.id, wastedRs: a.wastedRs })), totalSpendRs);

  // Per-ad drivers behind the waste + at-risk totals, so every rupee is traceable to the exact
  // ad + its math. Active ads only (a paused ad is not currently bleeding). Top 8 by amount.
  const wasteContributors: SpendContributor[] = scored
    .filter((a) => a.active !== false && a.wastedRs > 0)
    .sort((a, b) => b.wastedRs - a.wastedRs)
    .slice(0, 8)
    .map((a) => ({ adId: a.id, name: a.name, adSetId: a.adSetId, campaignId: a.campaignId, adsetName: a.adsetName, campaignName: a.campaignName, amountRs: a.wastedRs, roas: a.roas, spendRs: a.spendRs }));
  const atRiskContributors: SpendContributor[] = scored
    .filter((a) => a.active !== false && a.spendRs > 0 && (a.fatigueRead?.state === "fatiguing" || a.fatigueRead?.state === "fatigued"))
    .sort((a, b) => b.spendRs - a.spendRs)
    .slice(0, 8)
    .map((a) => ({ adId: a.id, name: a.name, adSetId: a.adSetId, campaignId: a.campaignId, adsetName: a.adsetName, campaignName: a.campaignName, amountRs: a.spendRs, roas: a.roas, spendRs: a.spendRs, fatigueState: a.fatigueRead?.state }));

  const concentration = budgetConcentration(
    scored.map<AdSummary>((a) => ({ adId: a.id, spend: a.spendRs, revenue: a.revenueRs, fatigueIndex: null })),
  );

  return {
    dataSource,
    totals: { spendRs: totalSpendRs, revenueRs: totalRevenueRs, roas: roasOf(totalSpendRs, totalRevenueRs) },
    accountHealth: accountHealth(scored, ads, totalSpendRs, totalWastedRs),
    creativeHalfLife: creativeHalfLife(scored),
    opportunity: opportunityLoss(scored),
    leaderboard,
    doThis,
    waste,
    wasteContributors,
    atRiskContributors,
    concentration,
  };
}

// Account creative half-life: spend-weighted median of the ads that have a real day-wise
// half-life. Reported only over assessed ads; never invented for ads without enough history.
function creativeHalfLife(ads: CockpitAd[]): CreativeHalfLife {
  const assessed = ads.filter((a) => a.fatigueRead?.sufficiency === "ok" && typeof a.halfLifeDays === "number");
  const fatiguingAds = ads.filter((a) => a.fatigueRead?.state === "fatiguing" || a.fatigueRead?.state === "fatigued").length;
  if (assessed.length === 0) {
    return { medianDays: null, assessedAds: 0, fatiguingAds, basis: "Not enough day-wise history yet to estimate a half-life." };
  }
  // Spend-weighted median: order by half-life, take the day where cumulative spend crosses 50%.
  const ordered = [...assessed].sort((a, b) => (a.halfLifeDays as number) - (b.halfLifeDays as number));
  const totalSpend = ordered.reduce((s, a) => s + a.spendRs, 0) || 1;
  let cum = 0;
  let medianDays = ordered[ordered.length - 1].halfLifeDays as number;
  for (const a of ordered) {
    cum += a.spendRs;
    if (cum >= totalSpend / 2) {
      medianDays = a.halfLifeDays as number;
      break;
    }
  }
  return {
    medianDays,
    assessedAds: assessed.length,
    fatiguingAds,
    basis: `Spend-weighted median across ${assessed.length} ad${assessed.length === 1 ? "" : "s"} with day-wise history; ${fatiguingAds} fatiguing.`,
  };
}
