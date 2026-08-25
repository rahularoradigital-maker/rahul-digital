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

/** One ad as the cockpit needs it. Sub-scores are 0-100 (produced upstream by the
 *  scoring engines); the raw facts drive verdict, waste, and the action queue. */
export type CockpitAdInput = VerdictInput & {
  id: string;
  name: string;
  objective: Objective;
  spendRs: number;
  revenueRs: number;
  wastedRs: number; // per-ad wasted spend (upstream waste calc; sample supplies it)
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
};

export type CockpitView = {
  dataSource: "SAMPLE" | "LIVE";
  totals: { spendRs: number; revenueRs: number; roas: number | null };
  accountHealth: { score: number; factLabel: "MODEL_ESTIMATE"; basis: string };
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
 * Account Health 0-100: one honest composite. Rewards spend sitting on winners,
 * penalises spend on losers and wasted spend. INTERNAL CALIBRATION (calibrate-at-
 * build), labelled MODEL_ESTIMATE because it is a modelled score, not a fact.
 */
function accountHealth(ads: CockpitAd[], totalSpendRs: number, totalWastedRs: number): CockpitView["accountHealth"] {
  if (ads.length === 0 || totalSpendRs <= 0) {
    return { score: 0, factLabel: "MODEL_ESTIMATE", basis: "no spend to assess" };
  }
  const shareOn = (v: Verdict) =>
    ads.filter((a) => a.verdict === v).reduce((acc, a) => acc + a.spendRs, 0) / totalSpendRs;
  const winnerShare = shareOn("winner");
  const loserShare = shareOn("loser");
  const wasteShare = totalWastedRs / totalSpendRs;
  const raw = 50 + 50 * winnerShare - 40 * loserShare - 30 * wasteShare;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return {
    score,
    factLabel: "MODEL_ESTIMATE",
    basis: `${Math.round(winnerShare * 100)}% spend on winners, ${Math.round(loserShare * 100)}% on losers, ${Math.round(wasteShare * 100)}% wasted`,
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
    accountHealth: accountHealth(scored, totalSpendRs, totalWastedRs),
    leaderboard,
    doThis,
    waste,
    concentration,
  };
}
