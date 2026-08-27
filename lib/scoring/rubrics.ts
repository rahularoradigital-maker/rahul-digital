// The scoring rubric registry: the single source of truth for WHY every number on the app
// is what it is. Each rubric states the question the score answers, the real inputs it uses,
// the formula, and the benchmarks. The compute path and the "Why this score?" UI both read
// from here, so a number and its explanation can never drift apart. No score ships without a
// rubric here (enforced by check:rubrics).

export type Rubric = {
  id: string;
  label: string;
  question: string; // what the score answers
  formula: string; // human-readable formula
  inputs: string[]; // the real Meta / account fields it is built from
  benchmarks?: string[]; // the anchors that make an absolute score meaningful
};

export const RUBRICS: Record<string, Rubric> = {
  account_health: {
    id: "account_health",
    label: "Account Health",
    question: "How well is this account's spend performing against each ad's own objective?",
    formula: "Spend-weighted average of every ad's absolute objective score, minus a waste penalty (25 x wasted-spend share).",
    inputs: ["per-ad objective score", "per-ad spend", "wasted spend"],
    benchmarks: ["ROAS: 1x break-even ~39, 2x ~63, 4x ~86", "CTR: ~1% ~49, ~2% ~74, ~4% ~93", "awareness blends CTR with freshness (low fatigue)"],
  },
  objective_score: {
    id: "objective_score",
    label: "Objective score",
    question: "Is this ad doing the job of ITS objective (not a blanket ROAS)?",
    formula: "Absolute 0-100 on the objective's own metric vs a benchmark: ROAS for conversion, CTR for traffic/engagement/leads/installs, reach+freshness for awareness.",
    inputs: ["objective", "ROAS or CTR from real day-wise rows", "frequency"],
    benchmarks: ["ROAS 1x->39, 2x->63, 4x->86", "CTR 1%->49, 2%->74, 4%->93"],
  },
  creative_score: {
    id: "creative_score",
    label: "CreativeScore",
    question: "How strong is this creative overall, relative to its own account?",
    formula: "0.30 performance + 0.30 trend + 0.20 (100 - fatigue) + 0.20 funnel health.",
    inputs: ["performance percentile (within objective)", "day-wise trend", "fatigue", "funnel health"],
  },
  verdict: {
    id: "verdict",
    label: "Verdict",
    question: "Scale, refresh, hold, or kill this ad?",
    formula: "Winner needs ALL gates (purchases, days, stability, healthy funnel, low fatigue, room to scale, score >= 70). Loser only after the causality ladder rules out every non-creative cause; otherwise hold.",
    inputs: ["CreativeScore", "conversions", "days", "stability", "funnel", "fatigue", "diagnosis"],
  },
  fatigue: {
    id: "fatigue",
    label: "Fatigue",
    question: "Is the creative wearing out, and how fast?",
    formula: "Day-wise trajectory: frequency saturation (0.4) + CTR decay (0.4) + CPM rise (0.2), each read as a slope over the connected window; days-to-fatigue extrapolates the CTR decline to 60% of its starting value.",
    inputs: ["daily frequency", "daily CTR", "daily CPM"],
  },
  roas: {
    id: "roas",
    label: "Blended ROAS",
    question: "For every rupee spent, how much revenue came back?",
    formula: "Total revenue / total spend across the window. Null when spend is 0 (never a fabricated ratio).",
    inputs: ["revenue", "spend"],
  },
  concentration: {
    id: "concentration",
    label: "Concentration",
    question: "How much of spend rides on a single ad?",
    formula: "Top ad's spend / total spend.",
    inputs: ["per-ad spend"],
  },
  waste: {
    id: "waste",
    label: "Wasted spend",
    question: "How much spend is returning less than it costs?",
    formula: "Sum of spend on conversion-objective ads with ROAS < 1 (other objectives were never optimised to convert, so low ROAS there is not waste).",
    inputs: ["objective", "ROAS", "spend"],
  },
};

export function rubric(id: string): Rubric | undefined {
  return RUBRICS[id];
}

// --- The explanation a scored value carries to the UI ("Why this score?"). ---
export type ExplainStep = { label: string; value: string };
export type ExplainContribution = { name: string; tag: string; metric: string; score: number; spendShare: number };
export type Explanation = {
  rubricId: string;
  headline: string; // one-line plain-English reason
  steps: ExplainStep[]; // the formula's inputs -> result, in order
  contributions?: ExplainContribution[]; // the per-item drivers (e.g. per-ad)
};
