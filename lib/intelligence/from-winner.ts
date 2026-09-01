// Adapter: one ad's winner scores (CockpitAd.winner, from lib/scoring/winner) -> the §110 Output Contract,
// with the §37 winner TAXONOMY derived deterministically from the four sub-reads (quality/scale/stability/
// opportunity). New file, no engine edit. The TRUST gate is §95 "no winner without delivery": too little
// proven spend -> HOLD, we can't call it a winner yet. Thresholds are documented calibration constants (like
// winner.ts's own weights), applied to already account-relative 0-100 sub-scores - not universal benchmarks.

import type { CockpitAd } from "@/lib/cockpit/analyze";
import { hold, decide, type OutputContract, type Confidence } from "./output-contract.ts";

const HI = 60, LO = 40, MIN_PROVEN_SCALE = 25; // calibration constants (tune here, not the logic)
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
function tierOf(n: number): Confidence {
  return n >= 70 ? "high" : n >= 45 ? "med" : "low";
}

type WinnerTier = "PROVEN" | "EMERGING" | "FRAGILE" | "EFFICIENT_LOW_SCALE" | "INCONCLUSIVE";
function classify(w: { quality: number; scale: number; stability: number; opportunity: number }): WinnerTier {
  if (w.quality >= HI && w.scale >= HI && w.stability >= HI) return "PROVEN";
  if (w.quality >= HI && w.stability < LO) return "FRAGILE"; // good + scaled but shaky = concentration risk
  if (w.quality >= HI && w.opportunity >= HI && w.scale < HI) return "EMERGING";
  if (w.quality >= HI && w.scale < LO) return "EFFICIENT_LOW_SCALE";
  return "INCONCLUSIVE";
}

const DECISION: Record<Exclude<WinnerTier, "INCONCLUSIVE">, { call: string; why: string; action: string; second: string; third: string }> = {
  PROVEN: {
    call: "Scale carefully", why: "good, proven at spend, and stable",
    action: "Draft a measured budget increase (e.g. +20-30%) and watch frequency + CPA - reversible.",
    second: "A big jump can reset the learning phase, so ramp in steps rather than doubling at once.",
    third: "Concentrating more spend on one proven ad raises fragility if it later fatigues - keep backups in test.",
  },
  EMERGING: {
    call: "Give it room to prove out", why: "good and fresh with upside, but not yet proven at scale",
    action: "Draft a controlled budget bump and let it gather a proven-spend sample before judging.",
    second: "Too fast and it never gets a clean read; too slow and the window closes while it is fresh.",
    third: "An emerging winner that proves out replaces a fatiguing one - protecting future acquisition capacity.",
  },
  FRAGILE: {
    call: "Protect it - add backups", why: "good and scaled but unstable, so the account leans on a shaky pillar",
    action: "Draft 1-2 same-angle backups now; do not scale the fragile ad further until it steadies.",
    second: "Scaling an unstable winner amplifies the swing when it wobbles.",
    third: "One fragile pillar carrying the account = a single point of failure for acquisition.",
  },
  EFFICIENT_LOW_SCALE: {
    call: "Test more budget", why: "efficient but under-fed, so its true ceiling is unknown",
    action: "Draft a small budget test to learn its scale elasticity before committing more.",
    second: "Great at low spend can fall apart at high spend - measure the change in outcome vs the change in spend.",
    third: "If it holds efficiency as it scales, it becomes a proven workhorse; if not, you learned the ceiling cheaply.",
  },
};

export function winnerToContract(ad: CockpitAd): OutputContract | null {
  const w = ad.winner;
  if (!w || ad.delivering === false || ad.active === false) return null;
  const tier = classify(w);
  const data = { summary: `${ad.name}: winner score ${Math.round(w.overall)}/100 · ${inr(ad.spendRs)} spend`, source: "meta-store" as const };
  const entity = { level: "ad" as const, id: ad.id, name: ad.name };

  // §95 no winner without delivery: too little proven spend -> HOLD.
  if (w.scale < MIN_PROVEN_SCALE || tier === "INCONCLUSIVE") {
    return hold({
      id: `winner:${ad.id}`, kind: "winner", entity, data, tier: "CALCULATED",
      reason: w.scale < MIN_PROVEN_SCALE ? "too little proven spend to call it a winner yet" : "the four winner reads do not line up into a clear story",
      whatToDo: "Let it gather more proven spend before treating it as a winner to scale.",
      confidence: "low",
    });
  }

  const spec = DECISION[tier];
  const why = w.why?.[0] ?? spec.why;
  return decide({
    id: `winner:${ad.id}`, kind: "winner", entity, data, tier: "CALCULATED",
    trustReason: `proven-spend read (scale ${Math.round(w.scale)}/100) is enough to classify`,
    signal: `${tier.replace(/_/g, " ").toLowerCase()} winner (quality ${Math.round(w.quality)}, scale ${Math.round(w.scale)}, stability ${Math.round(w.stability)}, opportunity ${Math.round(w.opportunity)})`,
    diagnosis: why,
    economicImpactRs: ad.spendRs,
    secondOrder: spec.second,
    thirdOrder: spec.third,
    decision: { call: spec.call, why: spec.why },
    action: spec.action,
    whatCouldBeWrong: "Winner reads lag: a recent budget change, seasonality, or a tracking gap can make a fading ad still look strong (or hide an emerging one) for a few days.",
    confidence: tierOf(w.overall),
    sampleNote: `overall ${Math.round(w.overall)}/100`,
  });
}
