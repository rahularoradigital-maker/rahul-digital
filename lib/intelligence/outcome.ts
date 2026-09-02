// The learning loop core (charter §111/§112/§114): compare what AdScale PREDICTED against what the metric
// ACTUALLY did, so the system can say "our scale calls were right 84% of the time" and stop repeating the
// wrong ones. Pure + deterministic. Persistence fills the OUTCOME half of the EXISTING `decision_triples`
// table (lib/audit/record.ts already writes situation+recommendation; outcome was designed-but-empty) - so no
// new migration is needed (thanks @rahul-linkedin-2-46, who built + stood down a parallel version and offered
// the two rigor rules below).
//
// RIGOR (why not everything is gradeable):
//  - Grade ONLY "keep-spending" calls (scale / continue / hold): they make a testable forward claim that the
//    ad keeps performing. A PAUSE removes the counterfactual (we can't see what the paused ad would have
//    done); a REFRESH changes the creative, so the same ad_id's later metric isn't comparable. Those -> null
//    (not gradeable), never counted as a win or a loss.
//  - A hit-rate off a handful of calls is noise: below MIN_SAMPLE the accuracy is null + trustworthy=false.

import type { Confidence } from "./output-contract.ts";

export type Direction = "worsen" | "improve" | "stable";

// "keep spending" verdicts make a gradeable forward prediction; the rest don't (no honest counterfactual).
const KEEP_SPENDING = new Set(["scale", "continue", "hold", "leave", "do_not_kill_yet"]);
export function gradeableFor(verdictOrAction: string): boolean {
  return KEEP_SPENDING.has(verdictOrAction.toLowerCase().replace(/\s+/g, "_"));
}

export const MIN_SAMPLE = 20; // below this, a hit-rate is noise, not a signal (§65/§92)

export type Prediction = {
  id: string; // ties back to the decision_triples row / contract it came from
  kind: string; // "fatigue" | "winner" | "scaling" | ...
  metric: string; // the metric we predict (e.g. "roas", "cpa")
  predicted: Direction; // the business direction we called
  confidence: Confidence;
  gradeable?: boolean; // default true; false for pause/refresh/unknown (no honest counterfactual)
  economicImpactRs?: number | null;
  madeAt?: string;
};

export type Observation = {
  before: number;
  after: number;
  higherIsBetter: boolean; // ROAS true, CPA false
  minMovePct?: number; // moves under this share of |before| are noise -> "stable"
};

export type Evaluation = {
  id: string;
  kind: string;
  predicted: Direction;
  actual: Direction;
  correct: boolean | null; // null = not gradeable (never a win or a loss)
  movePct: number;
};

// Map a raw before/after into a BUSINESS direction, honouring polarity + a noise floor.
export function actualDirection(o: Observation): Direction {
  if (!isFinite(o.before) || o.before === 0) return "stable"; // no trustworthy denominator to judge a move
  const raw = (o.after - o.before) / Math.abs(o.before);
  const floor = o.minMovePct ?? 0.05;
  if (Math.abs(raw) < floor) return "stable";
  const better = o.higherIsBetter ? raw > 0 : raw < 0;
  return better ? "improve" : "worsen";
}

// Score one prediction against one observation. Not-gradeable -> correct=null (excluded from accuracy).
export function evaluate(p: Prediction, o: Observation): Evaluation {
  const actual = actualDirection(o);
  const movePct = !isFinite(o.before) || o.before === 0 ? 0 : ((o.after - o.before) / Math.abs(o.before)) * 100;
  const correct = p.gradeable === false ? null : p.predicted === actual;
  return { id: p.id, kind: p.kind, predicted: p.predicted, actual, correct, movePct };
}

export type AccuracyStats = {
  n: number; // gradeable evaluations only
  trustworthy: boolean; // n >= MIN_SAMPLE
  hitRate: number | null; // null when not trustworthy (a hit-rate off < MIN_SAMPLE calls is noise)
  byKind: Record<string, { n: number; hitRate: number | null }>;
  falsePositives: number; // predicted worsen, actually improved/stable (cried wolf)
  falseNegatives: number; // predicted improve/stable, actually worsened (missed it)
};

// Roll up gradeable evaluations into the accuracy the product can show + learn from (§115). Below MIN_SAMPLE
// the hit-rate is withheld (null) rather than shown as a confident number off too few calls.
export function accuracyStats(all: Evaluation[]): AccuracyStats {
  const evals = all.filter((e) => e.correct !== null) as (Evaluation & { correct: boolean })[];
  const n = evals.length;
  const trustworthy = n >= MIN_SAMPLE;
  const correct = evals.filter((e) => e.correct).length;
  const byKind: AccuracyStats["byKind"] = {};
  for (const e of evals) {
    const k = (byKind[e.kind] ??= { n: 0, hitRate: 0 });
    k.n++;
    (k.hitRate as number) += e.correct ? 1 : 0;
  }
  for (const key of Object.keys(byKind)) {
    const k = byKind[key];
    k.hitRate = k.n >= MIN_SAMPLE ? (k.hitRate as number) / k.n : null;
  }
  const falsePositives = evals.filter((e) => e.predicted === "worsen" && e.actual !== "worsen").length;
  const falseNegatives = evals.filter((e) => e.predicted !== "worsen" && e.actual === "worsen").length;
  return { n, trustworthy, hitRate: trustworthy ? correct / n : null, byKind, falsePositives, falseNegatives };
}
