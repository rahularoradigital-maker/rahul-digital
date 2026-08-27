// The integration seam: runs the tested brain engines over an account and returns
// exactly what the cockpit renders. Pure, no I/O. Today the input is a SAMPLE
// account (so there is something real to click before a live Meta account is
// connected); the same function accepts live-derived ads later without changing
// the UI. Every surfaced number carries a fact label or comes straight from a
// tested engine. AI narrates, engines compute.

import { verdict, type Verdict, type VerdictInput } from "../rules/verdict.ts";
export type { Verdict } from "../rules/verdict.ts";
import { wasteRollup, budgetConcentration, type ConcentrationResult, type AdSummary } from "../rules/account.ts";
import type { DiagnoseResult } from "../causality.ts";
import type { Objective } from "../rules/comparator.ts";
import type { FatigueRead } from "../scoring/fatigue.ts";

/** One ad as the cockpit needs it. Sub-scores are 0-100 (produced upstream by the
 *  scoring engines); the raw facts drive verdict, waste, and the action queue. */
export type CockpitAdInput = VerdictInput & {
  id: string;
  name: string;
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
  objective: Objective;
  spendRs: number;
  revenueRs: number;
  roas: number | null; // null when spend is 0 (never a fabricated ratio)
  verdict: Verdict;
  score: number;
  confidence: number;
  why: string[];
  action: CockpitAction;
  wastedRs: number;
  fatigueRead?: FatigueRead; // day-wise fatigue read (state, trajectory, evidence)
  halfLifeDays?: number | null; // creative half-life: days to the fatigue floor
};

// Account creative half-life: the spend-weighted median of the ads' half-lives (days to the
// fatigue floor). Null when too few ads have a day-wise read to say anything honest.
export type CreativeHalfLife = {
  medianDays: number | null;
  assessedAds: number; // ads with a real day-wise half-life
  fatiguingAds: number; // ads whose fatigue state is fatiguing or fatigued
  basis: string;
};

export type CockpitView = {
  dataSource: "SAMPLE" | "LIVE";
  totals: { spendRs: number; revenueRs: number; roas: number | null };
  accountHealth: { score: number; factLabel: "MODEL_ESTIMATE"; basis: string };
  creativeHalfLife: CreativeHalfLife;
  leaderboard: CockpitAd[]; // sorted by CreativeScore, best first
  doThis: (CockpitAction & { adId: string; adName: string })[]; // sorted by priority
  waste: ReturnType<typeof wasteRollup>;
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
    return { score: 0, factLabel: "MODEL_ESTIMATE", basis: "no spend to assess" };
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
  return {
    score,
    factLabel: "MODEL_ESTIMATE",
    basis: `${Math.round(base)}/100 objective performance, spend-weighted; ${Math.round(winnerShare * 100)}% on winners, ${Math.round(wasteShare * 100)}% wasted`,
  };
}

export function analyzeAccount(ads: CockpitAdInput[], dataSource: "SAMPLE" | "LIVE" = "SAMPLE"): CockpitView {
  const scored: CockpitAd[] = ads.map((input) => {
    const v = verdict(input);
    return {
      id: input.id,
      name: input.name,
      objective: input.objective,
      spendRs: input.spendRs,
      revenueRs: input.revenueRs,
      roas: roasOf(input.spendRs, input.revenueRs),
      verdict: v.verdict,
      score: v.score,
      confidence: v.confidence,
      why: v.why,
      action: actionFor(v.verdict, input),
      wastedRs: input.wastedRs,
      fatigueRead: input.fatigueRead,
      halfLifeDays: input.halfLifeDays,
    };
  });

  const leaderboard = [...scored].sort((a, b) => b.score - a.score);

  const doThis = scored
    .map((a) => ({ adId: a.id, adName: a.name, ...a.action }))
    .sort((x, y) => PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority]);

  const totalSpendRs = scored.reduce((acc, a) => acc + a.spendRs, 0);
  const totalRevenueRs = scored.reduce((acc, a) => acc + a.revenueRs, 0);
  const totalWastedRs = scored.reduce((acc, a) => acc + a.wastedRs, 0);

  const waste = wasteRollup(scored.map((a) => ({ adId: a.id, wastedRs: a.wastedRs })), totalSpendRs);
  const concentration = budgetConcentration(
    scored.map<AdSummary>((a) => ({ adId: a.id, spend: a.spendRs, revenue: a.revenueRs, fatigueIndex: null })),
  );

  return {
    dataSource,
    totals: { spendRs: totalSpendRs, revenueRs: totalRevenueRs, roas: roasOf(totalSpendRs, totalRevenueRs) },
    accountHealth: accountHealth(scored, ads, totalSpendRs, totalWastedRs),
    creativeHalfLife: creativeHalfLife(scored),
    leaderboard,
    doThis,
    waste,
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
