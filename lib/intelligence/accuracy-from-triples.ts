// Cumulative accuracy from GRADED decision_triples (§115): reads the rows whose outcome the grade job filled
// (before/after) and re-derives the hit-rate + false-positive/negative across ALL graded history - the number
// a user actually wants: "AdScale's scale calls were right N% of the time". Pure: rows in, accuracy out; the
// route supplies the rows. Reuses the same grading discipline as the outcome engine (keep-spending gradeable,
// MIN_SAMPLE withholding) so the read and the write can never disagree.

import { evaluate, accuracyStats, gradeableFor, type Evaluation, type AccuracyStats } from "./outcome.ts";

export type GradedTripleRow = {
  ad_id: string;
  rule_id?: string | null;
  recommendation?: { action?: string | null } | null;
  outcome?: { metric?: string | null; before?: number | null; after?: number | null } | null;
};

export function accuracyFromTriples(rows: GradedTripleRow[]): AccuracyStats {
  const evals: Evaluation[] = [];
  for (const r of rows) {
    const o = r.outcome;
    if (!o || o.before == null || o.after == null || !isFinite(o.before) || !isFinite(o.after)) continue; // ungraded
    const action = r.recommendation?.action ?? "";
    const gradeable = gradeableFor(action);
    const metric = o.metric ?? "roas";
    const higherIsBetter = metric !== "cpa" && metric !== "cpc" && metric !== "cpm"; // cost metrics: lower is better
    evals.push(
      evaluate(
        { id: r.ad_id, kind: r.rule_id ?? "decision", metric, predicted: gradeable ? "stable" : "worsen", confidence: "med", gradeable },
        { before: o.before, after: o.after, higherIsBetter },
      ),
    );
  }
  return accuracyStats(evals);
}
