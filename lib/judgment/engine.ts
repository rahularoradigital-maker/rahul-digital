// Triple-Labelled judgment engine (P1). Every verdict shown to a user must earn THREE independent,
// deterministic labels before it is presented as an action - this is what wins a senior buyer's trust:
//   1. EVIDENCE   - is it even judgeable? (materiality, volume, days, settled data, learning phase)
//   2. AGREEMENT  - do independent signals concur? (efficiency vs peers, fatigue/wear, momentum) -> N/3
//   3. CONFIDENCE - how sure, statistically? (volume behind the read, trend sufficiency, agreement) -> High/Med/Low
// The MATH decides (auditable, reproducible); the AI layer only explains + calibrates. Pure, no I/O.
// Mirrors the corpus in docs/decision-rules/adbrain-decision-rules.json (Evidence/Agreement/Confidence axes).

import type { Objective } from "../rules/comparator.ts";
import type { FatigueState, Trajectory } from "../scoring/fatigue.ts";

// calibrate-at-build. Kept in sync with the decision engine's floors and the materiality gate.
const MIN_ADSET_SPEND_SHARE = 0.2;
const MIN_DAYS = 4;
const MIN_SETTLED_DAYS = 3;
const FLOORS = { conversions: 50, clicks: 100, impressions_rate: 1000, impressions_awareness: 1_000_000 };

export type EvidenceGate = { name: string; passed: boolean; detail: string };
export type Evidence = { judgeable: boolean; gates: EvidenceGate[]; blockingReason: string | null };
export type Agreement = { agree: number; of: number; lean: "scale" | "cut" | "neutral"; signals: { name: string; dir: "scale" | "cut" | "neutral"; note: string }[] };
export type Confidence = { tier: "high" | "med" | "low"; score: number; basis: string[] };
export type Verdict = "SCALE" | "REFRESH" | "KILL" | "WATCH" | "INSUFFICIENT";

export type JudgmentInput = {
  objective: Objective;
  spend: number;
  adSetSpend: number; // parent ad set window spend (for materiality)
  conversions: number;
  clicks: number;
  impressions: number;
  daysDelivered: number;
  settledDays: number; // delivering days after excluding the attribution tail
  metricVsMedian: number | null; // this ad's objective metric / account same-objective median (>1 better, <1 worse)
  fatigueState: FatigueState;
  fatigueTrajectory: Trajectory;
  fatigueSufficiency: "ok" | "insufficient_data" | "insufficient_spend";
  inLearning?: boolean; // optional: still in the platform's learning phase
};

export type Judgment = { verdict: Verdict; evidence: Evidence; agreement: Agreement; confidence: Confidence; headline: string };

// ---- LABEL 1: EVIDENCE -----------------------------------------------------
function volumeGate(i: JudgmentInput): EvidenceGate {
  const o = i.objective;
  if (o === "conversion" || o === "leads" || o === "app_installs") {
    const ok = i.conversions >= FLOORS.conversions;
    return { name: "volume", passed: ok, detail: `${i.conversions} conv (need >=${FLOORS.conversions})` };
  }
  if (o === "awareness") {
    const ok = i.impressions >= FLOORS.impressions_awareness;
    return { name: "volume", passed: ok, detail: `${i.impressions} impr (need >=${FLOORS.impressions_awareness})` };
  }
  const ok = i.clicks >= FLOORS.clicks && i.impressions >= FLOORS.impressions_rate;
  return { name: "volume", passed: ok, detail: `${i.clicks} clicks / ${i.impressions} impr (need >=${FLOORS.clicks}/${FLOORS.impressions_rate})` };
}

function evidence(i: JudgmentInput): Evidence {
  const share = i.adSetSpend > 0 ? i.spend / i.adSetSpend : null;
  const gates: EvidenceGate[] = [
    { name: "materiality", passed: share === null || share >= MIN_ADSET_SPEND_SHARE, detail: share === null ? "no ad-set spend to compare" : `${Math.round(share * 100)}% of ad-set spend (need >=${Math.round(MIN_ADSET_SPEND_SHARE * 100)}%)` },
    volumeGate(i),
    { name: "runtime", passed: i.daysDelivered >= MIN_DAYS, detail: `${i.daysDelivered} delivering days (need >=${MIN_DAYS})` },
    { name: "settled", passed: i.settledDays >= MIN_SETTLED_DAYS, detail: `${i.settledDays} settled days (need >=${MIN_SETTLED_DAYS})` },
    { name: "learning", passed: !i.inLearning, detail: i.inLearning ? "still in learning phase" : "exited learning" },
  ];
  const failed = gates.filter((g) => !g.passed);
  return { judgeable: failed.length === 0, gates, blockingReason: failed.length ? `${failed[0].name}: ${failed[0].detail}` : null };
}

// ---- LABEL 2: AGREEMENT ----------------------------------------------------
function agreement(i: JudgmentInput): Agreement {
  const dir = (n: number, pos: boolean, neg: boolean): "scale" | "cut" | "neutral" => (pos ? "scale" : neg ? "cut" : "neutral");
  const eff = i.metricVsMedian == null ? "neutral" : dir(0, i.metricVsMedian >= 1.1, i.metricVsMedian <= 0.9);
  const wear = i.fatigueState === "fatiguing" || i.fatigueState === "fatigued" ? "cut" : i.fatigueState === "fresh" ? "scale" : "neutral";
  const momentum = i.fatigueTrajectory === "worsening" ? "cut" : i.fatigueTrajectory === "improving" ? "scale" : "neutral";
  const signals = [
    { name: "efficiency vs peers", dir: eff as "scale" | "cut" | "neutral", note: i.metricVsMedian == null ? "no peer median" : `${i.metricVsMedian.toFixed(2)}x account median` },
    { name: "creative wear", dir: wear as "scale" | "cut" | "neutral", note: `fatigue: ${i.fatigueState}` },
    { name: "momentum", dir: momentum as "scale" | "cut" | "neutral", note: `trend: ${i.fatigueTrajectory}` },
  ];
  const scale = signals.filter((s) => s.dir === "scale").length;
  const cut = signals.filter((s) => s.dir === "cut").length;
  const lean: "scale" | "cut" | "neutral" = scale > cut ? "scale" : cut > scale ? "cut" : "neutral";
  const agree = lean === "neutral" ? 0 : signals.filter((s) => s.dir === lean).length;
  return { agree, of: signals.length, lean, signals };
}

// ---- LABEL 3: CONFIDENCE ---------------------------------------------------
function confidence(i: JudgmentInput, a: Agreement): Confidence {
  const basis: string[] = [];
  let score = 0;
  // volume behind the read (0-2)
  const volMult = i.objective === "conversion" || i.objective === "leads" || i.objective === "app_installs" ? i.conversions / FLOORS.conversions : i.clicks / FLOORS.clicks;
  const volPts = volMult >= 2 ? 2 : volMult >= 1 ? 1 : 0;
  score += volPts;
  basis.push(`volume ${volPts === 2 ? "ample" : volPts === 1 ? "adequate" : "thin"}`);
  // trend sufficiency (0-1)
  const sig = i.fatigueSufficiency === "ok" && i.daysDelivered >= 7 ? 1 : 0;
  score += sig;
  basis.push(sig ? "clean multi-day trend" : "short/noisy trend");
  // agreement (0-2)
  const agPts = a.agree >= 3 ? 2 : a.agree === 2 ? 1 : 0;
  score += agPts;
  basis.push(`${a.agree}/${a.of} signals agree`);
  const tier: "high" | "med" | "low" = score >= 4 ? "high" : score >= 2 ? "med" : "low";
  return { tier, score, basis };
}

// ---- COMBINE ---------------------------------------------------------------
export function judge(i: JudgmentInput): Judgment {
  const ev = evidence(i);
  const ag = agreement(i);
  const cf = confidence(i, ag);

  let verdict: Verdict;
  if (!ev.judgeable) {
    verdict = "INSUFFICIENT";
  } else if (ag.agree >= 2 && cf.tier !== "low") {
    // an action only when >=2/3 signals agree at Med+ confidence
    if (ag.lean === "scale") verdict = "SCALE";
    else verdict = (i.metricVsMedian ?? 1) < 0.9 ? "KILL" : "REFRESH"; // under-objective -> kill; tired-but-ok -> refresh
  } else {
    verdict = "WATCH";
  }

  const headline =
    verdict === "INSUFFICIENT"
      ? `Not enough evidence - ${ev.blockingReason}`
      : `${verdict} - confidence ${cf.tier}, ${ag.agree}/${ag.of} signals agree`;
  return { verdict, evidence: ev, agreement: ag, confidence: cf, headline };
}
