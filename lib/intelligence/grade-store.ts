// Persistence glue for the learning loop (§112): turn stored decision_triples rows (the predictions AdScale
// already writes via lib/audit/record.ts) + each ad's CURRENT metric into graded outcomes + a live accuracy
// read. PURE: no I/O, no server-only - a thin route/job reads the rows + supplies the current metrics + writes
// the `outcome` payloads back (the column exists but was empty). Grades on ROAS (higher is better); grading
// discipline (keep-spending only, MIN_SAMPLE) is inherited from outcome.ts. This is the last moat piece: it
// makes "our scale calls were right N% of the time" real, not just a tested primitive.

import { evaluate, accuracyStats, gradeableFor, type Prediction, type Evaluation, type AccuracyStats } from "./outcome.ts";
import type { Confidence } from "./output-contract.ts";

// The shape record.ts writes (subset we read). situation.roas is the metric AT decision time; recommendation
// .action is the call; snapshot_day + ad_id identify the row.
export type DecisionTripleRow = {
  ad_id: string;
  snapshot_day?: string | null;
  rule_id?: string | null;
  situation?: { roas?: number | null; confidence?: number | null } | null;
  recommendation?: { action?: string | null } | null;
};

function confTier(n: number | null | undefined): Confidence {
  const v = n ?? 0;
  return v >= 0.7 ? "high" : v >= 0.4 ? "med" : "low";
}

// A stored row -> a learning-loop Prediction + its baseline ROAS. null when there's no baseline to compare
// (no ROAS at decision time = nothing gradeable).
export function rowToPrediction(row: DecisionTripleRow): { prediction: Prediction; before: number } | null {
  const before = row.situation?.roas;
  if (before == null || !isFinite(before)) return null;
  const action = row.recommendation?.action ?? "";
  const gradeable = gradeableFor(action);
  // keep-spending calls predict the ad keeps performing (stable/improve); a fix/kill warns it would worsen.
  const predicted = gradeable ? "stable" : "worsen";
  return {
    prediction: { id: `${row.ad_id}:${row.snapshot_day ?? ""}`, kind: row.rule_id ?? "decision", metric: "roas", predicted, confidence: confTier(row.situation?.confidence), gradeable },
    before,
  };
}

export type OutcomeWrite = { adId: string; snapshotDay: string | null; outcome: { metric: string; before: number; after: number; movePct: number; actual: string; correct: boolean | null } };
export type GradeResult = { evaluations: Evaluation[]; writes: OutcomeWrite[]; accuracy: AccuracyStats };

// Grade a batch of rows against each ad's CURRENT ROAS (currentRoasByAd[ad_id]). Rows with no baseline, or no
// current metric yet, are skipped (never fabricated). Returns the outcome payloads to persist + live accuracy.
export function gradeRows(rows: DecisionTripleRow[], currentRoasByAd: Record<string, number | null | undefined>): GradeResult {
  const evaluations: Evaluation[] = [];
  const writes: OutcomeWrite[] = [];
  for (const row of rows) {
    const mapped = rowToPrediction(row);
    if (!mapped) continue;
    const after = currentRoasByAd[row.ad_id];
    if (after == null || !isFinite(after)) continue; // no current metric -> can't grade yet
    const ev = evaluate(mapped.prediction, { before: mapped.before, after, higherIsBetter: true });
    evaluations.push(ev);
    writes.push({ adId: row.ad_id, snapshotDay: row.snapshot_day ?? null, outcome: { metric: "roas", before: mapped.before, after, movePct: ev.movePct, actual: ev.actual, correct: ev.correct } });
  }
  return { evaluations, writes, accuracy: accuracyStats(evaluations) };
}
